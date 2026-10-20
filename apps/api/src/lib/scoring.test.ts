import { describe, it, expect } from "vitest";
import { Listing } from "../types";
import {
  budgetScore,
  recencyScore,
  scoreListing,
  rankListings,
  compareScored,
} from "./scoring";

const NOW = new Date("2026-09-01T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "A1",
    source: "MLS_A",
    address: "123 Main St",
    city: "Springfield",
    state: "VA",
    zip: "22150",
    price: 450000,
    bedrooms: 2,
    bathrooms: 1.5,
    sqft: 980,
    latitude: 38.7893,
    longitude: -77.1873,
    listedDate: "2026-08-29T00:00:00.000Z",
    status: "active",
    description: "Bright condo",
    ...overrides,
  };
}

describe("budgetScore", () => {
  it("scores 1.0 when the price is exactly on budget", () => {
    expect(budgetScore(450000, 450000)).toBe(1);
  });

  it("decays linearly with the relative deviation", () => {
    expect(budgetScore(675000, 450000)).toBeCloseTo(0.5, 5); // 50% over
    expect(budgetScore(225000, 450000)).toBeCloseTo(0.5, 5); // 50% under
  });

  it("is symmetric above and below budget", () => {
    expect(budgetScore(550000, 500000)).toBeCloseTo(
      budgetScore(450000, 500000),
      10,
    );
  });

  it("floors at 0 once the price is 100% off or more", () => {
    expect(budgetScore(1_000_000, 450000)).toBe(0);
  });

  it("returns 0 for a non-positive target budget", () => {
    expect(budgetScore(450000, 0)).toBe(0);
  });
});

describe("recencyScore", () => {
  it("scores 1.0 for a listing posted exactly now", () => {
    expect(recencyScore(NOW, NOW)).toBe(1);
  });

  it("decays with age (30-day time constant)", () => {
    const thirtyDaysAgo = new Date(NOW.getTime() - 30 * DAY_MS);
    expect(recencyScore(thirtyDaysAgo, NOW)).toBeCloseTo(Math.exp(-1), 5);
  });

  it("is higher for newer listings", () => {
    const newer = new Date(NOW.getTime() - 5 * DAY_MS);
    const older = new Date(NOW.getTime() - 50 * DAY_MS);
    expect(recencyScore(newer, NOW)).toBeGreaterThan(recencyScore(older, NOW));
  });

  it("clamps future dates to an age of zero", () => {
    const future = new Date(NOW.getTime() + 10 * DAY_MS);
    expect(recencyScore(future, NOW)).toBe(1);
  });

  it("returns 0 for an unparseable listedDate", () => {
    expect(recencyScore("not-a-date", NOW)).toBe(0);
  });
});

describe("scoreListing", () => {
  it("combines budget and recency with 60/40 weights", () => {
    const scored = scoreListing(
      makeListing({ listedDate: NOW.toISOString() }),
      {
        targetBudget: 450000,
        now: NOW,
      },
    );
    // budget = 1.0, recency = 1.0 -> weighted average = 1.0
    expect(scored.score).toBeCloseTo(1, 5);
  });

  it("weights a 30-day-old, on-budget listing as 0.6 + 0.4*exp(-1)", () => {
    const listed = new Date(NOW.getTime() - 30 * DAY_MS).toISOString();
    const scored = scoreListing(makeListing({ listedDate: listed }), {
      targetBudget: 450000,
      now: NOW,
    });
    expect(scored.score).toBeCloseTo(0.6 + 0.4 * Math.exp(-1), 5);
  });

  it("ranks by recency alone when no target budget is given", () => {
    const listing = makeListing({ listedDate: NOW.toISOString() });
    const scored = scoreListing(listing, { now: NOW });
    expect(scored.score).toBeCloseTo(1, 5);
  });

  it("keeps the score within [0, 1]", () => {
    const scored = scoreListing(
      makeListing({
        price: 10_000_000,
        listedDate: "2000-01-01T00:00:00.000Z",
      }),
      { targetBudget: 100000, now: NOW },
    );
    expect(scored.score).toBeGreaterThanOrEqual(0);
    expect(scored.score).toBeLessThanOrEqual(1);
  });
});

describe("rankListings", () => {
  it("orders results by descending score", () => {
    const nearBudget = makeListing({
      id: "near",
      source: "MLS_A",
      price: 450000,
      listedDate: NOW.toISOString(),
    });
    const farFromBudget = makeListing({
      id: "far",
      source: "MLS_A",
      price: 900000,
      listedDate: "2025-01-01T00:00:00.000Z",
    });

    const ranked = rankListings([farFromBudget, nearBudget], {
      targetBudget: 450000,
      now: NOW,
    });

    expect(ranked.map((l) => l.id)).toEqual(["near", "far"]);
  });

  it("breaks exact score ties deterministically by id then source", () => {
    const identical = { price: 450000, listedDate: NOW.toISOString() };
    const listings = [
      makeListing({ ...identical, id: "B", source: "MLS_A" }),
      makeListing({ ...identical, id: "A", source: "MLS_B" }),
      makeListing({ ...identical, id: "A", source: "MLS_A" }),
    ];

    const ranked = rankListings(listings, { targetBudget: 450000, now: NOW });

    // Equal scores, so ordering falls back to (id, source).
    expect(ranked.map((l) => `${l.id}:${l.source}`)).toEqual([
      "A:MLS_A",
      "A:MLS_B",
      "B:MLS_A",
    ]);
    expect(ranked[0].score).toBeCloseTo(ranked[1].score, 10);
  });

  it("is stable regardless of input order for tied scores", () => {
    const identical = { price: 450000, listedDate: NOW.toISOString() };
    const a = makeListing({ ...identical, id: "A", source: "MLS_A" });
    const b = makeListing({ ...identical, id: "B", source: "MLS_A" });

    const forward = rankListings([a, b], { targetBudget: 450000, now: NOW });
    const reversed = rankListings([b, a], { targetBudget: 450000, now: NOW });

    expect(forward.map((l) => l.id)).toEqual(reversed.map((l) => l.id));
  });
});

describe("compareScored", () => {
  it("returns 0 for identical id and source with equal scores", () => {
    const a = { ...makeListing(), score: 0.5 };
    const b = { ...makeListing(), score: 0.5 };
    expect(compareScored(a, b)).toBe(0);
  });
});

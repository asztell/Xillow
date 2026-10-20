import { describe, expect, it } from "vitest";
import {
  distinctKeyCount,
  findDuplicateKeys,
  toTimestamp,
  type SampleListing,
} from "./seeding";

function listing(overrides: Partial<SampleListing> = {}): SampleListing {
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
    listedDate: "2026-08-29",
    status: "active",
    description: "Bright condo near transit",
    ...overrides,
  };
}

describe("toTimestamp", () => {
  it("expands a date-only value to midnight UTC", () => {
    expect(toTimestamp("2026-08-29")).toBe("2026-08-29T00:00:00.000Z");
  });

  it("passes a full timestamp through unchanged", () => {
    expect(toTimestamp("2026-08-29T12:34:56.000Z")).toBe(
      "2026-08-29T12:34:56.000Z",
    );
  });
});

describe("findDuplicateKeys", () => {
  it("returns nothing for a batch of unique keys", () => {
    const rows = [listing(), listing({ id: "B7", source: "MLS_B" })];
    expect(findDuplicateKeys(rows)).toEqual([]);
  });

  it("flags a repeated key with identical payloads (no conflict)", () => {
    expect(findDuplicateKeys([listing(), listing()])).toEqual([
      { id: "A1", source: "MLS_A", count: 2, conflicting: false },
    ]);
  });

  it("flags a repeated key whose payloads disagree (last wins on upsert)", () => {
    const rows = [listing({ price: 450000 }), listing({ price: 465000 })];
    expect(findDuplicateKeys(rows)).toEqual([
      { id: "A1", source: "MLS_A", count: 2, conflicting: true },
    ]);
  });

  it("does not treat the same id under a different source as a duplicate", () => {
    expect(
      findDuplicateKeys([listing(), listing({ source: "MLS_B" })]),
    ).toEqual([]);
  });

  it("counts every occurrence and sorts the report by id then source", () => {
    const rows = [
      listing({ id: "B7", source: "MLS_B" }),
      listing({ id: "A1", source: "MLS_A" }),
      listing({ id: "A1", source: "MLS_A", price: 465000 }),
      listing({ id: "A1", source: "MLS_A", price: 470000 }),
      listing({ id: "B7", source: "MLS_B" }),
    ];
    expect(findDuplicateKeys(rows)).toEqual([
      { id: "A1", source: "MLS_A", count: 3, conflicting: true },
      { id: "B7", source: "MLS_B", count: 2, conflicting: false },
    ]);
  });

  it("ignores field order when comparing payloads", () => {
    const reordered = Object.fromEntries(
      Object.entries(listing()).reverse(),
    ) as SampleListing;
    expect(findDuplicateKeys([listing(), reordered])).toEqual([
      { id: "A1", source: "MLS_A", count: 2, conflicting: false },
    ]);
  });
});

describe("distinctKeyCount", () => {
  it("counts distinct (id, source) pairs", () => {
    const rows = [listing(), listing(), listing({ source: "MLS_B" })];
    expect(distinctKeyCount(rows)).toBe(2);
  });
});

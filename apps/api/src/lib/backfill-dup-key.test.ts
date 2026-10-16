import { describe, it, expect } from "vitest";
import type { Listing } from "../types";
import { duplicateKey } from "./dedupe";

function listing(overrides: Partial<Listing> = {}): Listing {
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

describe("backfill dup_key logic", () => {
  it("computes matching keys for known duplicate pairs", () => {
    const a1 = listing();
    const b7 = listing({
      id: "B7",
      source: "MLS_B",
      address: "123 Main Street",
    });
    expect(duplicateKey(a1)).toBe(duplicateKey(b7));
  });

  it("returns null for rows with neither geocode nor usable address", () => {
    const noGeo = listing({
      latitude: null,
      longitude: null,
      address: "",
    });
    expect(duplicateKey(noGeo)).toBeNull();
  });

  it("groups identical geocode rows into the same key", () => {
    const rows = [
      listing(),
      listing({ id: "B7", source: "MLS_B", address: "123 Main Street" }),
      listing({ id: "C8", source: "MLS_C", address: "123 Main St" }),
    ];
    const keys = rows.map((r) => duplicateKey(r));
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).not.toBeNull();
  });
});
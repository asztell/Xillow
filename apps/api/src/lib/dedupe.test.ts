import { describe, it, expect } from "vitest";
import type { Listing } from "../types";
import {
  annotateDuplicates,
  duplicateKey,
  normalizeAddress,
} from "./dedupe";

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "A1",
    source: "MLS_A",
    address: "123 Main St, Apt 4B",
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

describe("normalizeAddress", () => {
  it("expands street-type abbreviations to a canonical form", () => {
    expect(normalizeAddress("123 Main St")).toMatchObject({
      number: "123",
      street: "main street",
      unit: null,
    });
    expect(normalizeAddress("55 Elm Ct").street).toBe("elm court");
    expect(normalizeAddress("456 Oak Ave").street).toBe("oak avenue");
  });

  it("lifts the unit out and drops punctuation", () => {
    expect(normalizeAddress("123 Main St, Apt 4B").unit).toBe("4b");
    expect(normalizeAddress("123 Main Street, Unit 4B").unit).toBe("4b");
    expect(normalizeAddress("9 Palm Dr #12").unit).toBe("12");
    expect(normalizeAddress("9 Palm Dr #12").street).toBe("palm drive");
  });

  it("normalizes two spellings of the same address to equal parts", () => {
    expect(normalizeAddress("123 Main St, Apt 4B")).toEqual(
      normalizeAddress("123 Main Street, Unit 4B"),
    );
  });

  it("returns a null number when the street number is absent", () => {
    expect(normalizeAddress("Main St").number).toBeNull();
  });
});

describe("duplicateKey", () => {
  it("groups rows that share a geocode", () => {
    const a1 = listing();
    const b7 = listing({ id: "B7", source: "MLS_B", address: "123 Main Street, Unit 4B" });
    expect(duplicateKey(a1)).toBe(duplicateKey(b7));
  });

  it("keeps different units in one building apart (unit guard)", () => {
    const unit4b = listing({ address: "1 Elm St, Apt 4B" });
    const unit5c = listing({ id: "B1", source: "MLS_B", address: "1 Elm St, Apt 5C" });
    expect(duplicateKey(unit4b)).not.toBe(duplicateKey(unit5c));
  });

  it("falls back to the normalized address when coordinates are missing", () => {
    const noGeo = listing({ latitude: null, longitude: null });
    const noGeoOther = listing({
      id: "B7",
      source: "MLS_B",
      address: "123 Main Street, Unit 4B",
      latitude: null,
      longitude: null,
    });
    expect(duplicateKey(noGeo)).toBe(duplicateKey(noGeoOther));
    expect(duplicateKey(noGeo)).toMatch(/^addr:/);
  });

  it("returns null when there is neither a geocode nor a usable address", () => {
    expect(duplicateKey(listing({ latitude: null, longitude: null, address: "" }))).toBeNull();
  });
});

describe("annotateDuplicates", () => {
  // The four duplicate pairs in sample_listings.json, plus two non-duplicates
  // that share a city/zip but differ on both address and geocode.
  function sample(): Listing[] {
    return [
      listing(),
      listing({
        id: "B7",
        source: "MLS_B",
        address: "123 Main Street, Unit 4B",
        price: 452000,
        listedDate: "2026-08-27T00:00:00.000Z",
      }),
      listing({
        id: "A2",
        address: "456 Oak Ave",
        latitude: 38.7791,
        longitude: -77.1901,
        price: 525000,
        listedDate: "2026-09-02T00:00:00.000Z",
      }),
      listing({
        id: "B8",
        source: "MLS_B",
        address: "456 Oak Avenue",
        zip: "22151",
        latitude: 38.7791,
        longitude: -77.1901,
        price: 527500,
        listedDate: "2026-08-30T00:00:00.000Z",
      }),
      listing({
        id: "A3",
        address: "789 Pine Rd",
        latitude: 38.8462,
        longitude: -77.3064,
        price: 399000,
        listedDate: "2026-09-01T00:00:00.000Z",
      }),
      listing({
        id: "B9",
        source: "MLS_B",
        address: "789 Pine Rd",
        latitude: 38.8462,
        longitude: -77.3064,
        price: 399500,
        listedDate: "2026-08-25T00:00:00.000Z",
      }),
      listing({
        id: "A5",
        address: "55 Elm Ct",
        latitude: 38.9012,
        longitude: -77.2653,
        price: 470000,
        listedDate: "2026-09-04T00:00:00.000Z",
      }),
      listing({
        id: "B11",
        source: "MLS_B",
        address: "55 Elm Court",
        latitude: 38.9012,
        longitude: -77.2653,
        price: 465000,
        listedDate: "2026-08-15T00:00:00.000Z",
      }),
      // Same city/zip as the pair above, but a different home.
      listing({
        id: "A4",
        address: "22 Birch Ln",
        latitude: 38.9586,
        longitude: -77.357,
      }),
      listing({
        id: "B10",
        source: "MLS_B",
        address: "100 Maple Dr",
        latitude: 38.9601,
        longitude: -77.3499,
      }),
    ];
  }

  function annotated() {
    const result = annotateDuplicates(sample());
    return new Map(result.map((row) => [row.id, row]));
  }

  it("keeps every row (does not collapse) and preserves order", () => {
    const input = sample();
    const result = annotateDuplicates(input);
    expect(result).toHaveLength(input.length);
    expect(result.map((row) => row.id)).toEqual(input.map((row) => row.id));
  });

  it("links the rows of each duplicate pair and marks the newest as primary", () => {
    const rows = annotated();

    expect(rows.get("A1")!.duplicateGroupId).not.toBeNull();
    expect(rows.get("A1")!.duplicateGroupId).toBe(rows.get("B7")!.duplicateGroupId);
    expect(rows.get("A1")!.isPrimary).toBe(true);
    expect(rows.get("B7")!.isPrimary).toBe(false);
    expect(rows.get("A1")!.potentialDuplicates).toEqual([
      {
        id: "B7",
        source: "MLS_B",
        address: "123 Main Street, Unit 4B",
        city: "Springfield",
        state: "VA",
        zip: "22150",
        price: 452000,
        listedDate: "2026-08-27T00:00:00.000Z",
      },
    ]);
  });

  it("groups on normalized address even when the zip differs", () => {
    const rows = annotated();
    expect(rows.get("A2")!.duplicateGroupId).toBe(rows.get("B8")!.duplicateGroupId);
  });

  it("groups identical address strings", () => {
    const rows = annotated();
    expect(rows.get("A3")!.duplicateGroupId).toBe(rows.get("B9")!.duplicateGroupId);
  });

  it("prefers the newer listedDate even when it is the more expensive row", () => {
    const rows = annotated();
    // A5 (09-04, $470k) is newer but pricier than B11 (08-15, $465k).
    expect(rows.get("A5")!.isPrimary).toBe(true);
    expect(rows.get("B11")!.isPrimary).toBe(false);
    expect(rows.get("A5")!.price).toBeGreaterThan(rows.get("B11")!.price);
  });

  it("gives each pair a distinct group id", () => {
    const rows = annotated();
    const ids = new Set(
      ["A1", "A2", "A3", "A5"].map((id) => rows.get(id)!.duplicateGroupId),
    );
    expect(ids.size).toBe(4);
    expect(ids.has(null)).toBe(false);
  });

  it("leaves non-duplicates unannotated", () => {
    const rows = annotated();
    for (const id of ["A4", "B10"]) {
      expect(rows.get(id)!.duplicateGroupId).toBeNull();
      expect(rows.get(id)!.potentialDuplicates).toEqual([]);
      expect(rows.get(id)!.isPrimary).toBe(false);
    }
  });
});

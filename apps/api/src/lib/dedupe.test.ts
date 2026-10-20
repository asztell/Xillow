import { describe, it, expect } from "vitest";
import type { Listing } from "../types";
import { duplicateKey, normalizeAddress } from "./dedupe";

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
    const b7 = listing({
      id: "B7",
      source: "MLS_B",
      address: "123 Main Street, Unit 4B",
    });
    expect(duplicateKey(a1)).toBe(duplicateKey(b7));
  });

  it("keeps different units in one building apart (unit guard)", () => {
    const unit4b = listing({ address: "1 Elm St, Apt 4B" });
    const unit5c = listing({
      id: "B1",
      source: "MLS_B",
      address: "1 Elm St, Apt 5C",
    });
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
    expect(
      duplicateKey(listing({ latitude: null, longitude: null, address: "" })),
    ).toBeNull();
  });
});

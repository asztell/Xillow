import { describe, expect, it } from "vitest";
import { SORT_KEYS, isSortKey, sortListings } from "./sorting";
import type { SortKey } from "../types";

interface Row {
  id: string;
  source: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  listedDate: string;
  score: number;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "A1",
    source: "MLS_A",
    price: 450000,
    bedrooms: 2,
    bathrooms: 1.5,
    sqft: 980,
    listedDate: "2026-08-29T00:00:00.000Z",
    score: 0.5,
    ...overrides,
  };
}

describe("SORT_KEYS / isSortKey", () => {
  it("accepts every SortKey", () => {
    const all: SortKey[] = [
      "recommended",
      "price_desc",
      "price_asc",
      "newest",
      "bedrooms_desc",
      "bathrooms_desc",
      "sqft_desc",
    ];
    for (const key of all) {
      expect(isSortKey(key)).toBe(true);
    }
    expect(SORT_KEYS).toHaveLength(all.length);
  });

  it("rejects anything outside the whitelist", () => {
    expect(isSortKey("popular")).toBe(false);
    expect(isSortKey("bedrooms_asc")).toBe(false);
    expect(isSortKey("")).toBe(false);
  });
});

describe("sortListings", () => {
  it("sorts by price low to high", () => {
    const rows = [
      row({ id: "A1", price: 450000 }),
      row({ id: "A2", price: 525000 }),
      row({ id: "A3", price: 399000 }),
    ];
    expect(sortListings(rows, "price_asc").map((r) => r.id)).toEqual([
      "A3",
      "A1",
      "A2",
    ]);
  });

  it("sorts by price high to low", () => {
    const rows = [
      row({ id: "A1", price: 450000 }),
      row({ id: "A2", price: 525000 }),
      row({ id: "A3", price: 399000 }),
    ];
    expect(sortListings(rows, "price_desc").map((r) => r.id)).toEqual([
      "A2",
      "A1",
      "A3",
    ]);
  });

  it("sorts by newest listedDate first", () => {
    const rows = [
      row({ id: "A1", listedDate: "2026-08-29T00:00:00.000Z" }),
      row({ id: "A2", listedDate: "2026-09-02T00:00:00.000Z" }),
      row({ id: "A3", listedDate: "2026-07-01T00:00:00.000Z" }),
    ];
    expect(sortListings(rows, "newest").map((r) => r.id)).toEqual([
      "A2",
      "A1",
      "A3",
    ]);
  });

  it("sorts bedrooms high to low with missing values last", () => {
    const rows = [
      row({ id: "A1", bedrooms: 2 }),
      row({ id: "A2", bedrooms: 4 }),
      row({ id: "A3", bedrooms: null }),
    ];
    expect(sortListings(rows, "bedrooms_desc").map((r) => r.id)).toEqual([
      "A2",
      "A1",
      "A3",
    ]);
  });

  it("sorts bathrooms high to low with missing values last", () => {
    const rows = [
      row({ id: "A1", bathrooms: 1.5 }),
      row({ id: "A2", bathrooms: 3 }),
      row({ id: "A3", bathrooms: null }),
    ];
    expect(sortListings(rows, "bathrooms_desc").map((r) => r.id)).toEqual([
      "A2",
      "A1",
      "A3",
    ]);
  });

  it("sorts square feet high to low with missing values last", () => {
    const rows = [
      row({ id: "A1", sqft: 980 }),
      row({ id: "A2", sqft: 2100 }),
      row({ id: "A3", sqft: null }),
    ];
    expect(sortListings(rows, "sqft_desc").map((r) => r.id)).toEqual([
      "A2",
      "A1",
      "A3",
    ]);
  });

  it("breaks exact ties deterministically by id then source", () => {
    const rows = [
      row({ id: "B2", source: "MLS_B", price: 500000 }),
      row({ id: "A9", source: "MLS_A", price: 500000 }),
    ];
    expect(sortListings(rows, "price_desc").map((r) => `${r.id}:${r.source}`)).toEqual([
      "A9:MLS_A",
      "B2:MLS_B",
    ]);
  });

  it("keeps the recommended (score) ordering", () => {
    const rows = [
      row({ id: "A1", score: 0.3 }),
      row({ id: "A2", score: 0.9 }),
      row({ id: "A3", score: 0.6 }),
    ];
    expect(sortListings(rows, "recommended").map((r) => r.id)).toEqual([
      "A2",
      "A3",
      "A1",
    ]);
  });

  it("does not mutate the input array", () => {
    const rows = [
      row({ id: "A1", price: 450000 }),
      row({ id: "A2", price: 525000 }),
    ];
    const before = rows.map((r) => r.id);
    sortListings(rows, "price_asc");
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});
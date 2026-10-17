import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  filtersKey,
  parseListingsQuery,
  toSearchParams,
  toUrlSearchParams,
} from "./query";

describe("parseListingsQuery", () => {
  it("applies defaults for an empty query string", () => {
    expect(parseListingsQuery(new URLSearchParams())).toMatchObject({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("reads valid values", () => {
    const query = parseListingsQuery(
      new URLSearchParams(
        "minPrice=400000&maxPrice=600000&minBedrooms=2&city=Springfield&keyword=pets&targetBudget=475000&page=2&pageSize=25",
      ),
    );
    expect(query).toEqual({
      minPrice: 400000,
      maxPrice: 600000,
      minBedrooms: 2,
      city: "Springfield",
      keyword: "pets",
      targetBudget: 475000,
      page: 2,
      pageSize: 25,
    });
  });

  it("drops invalid values rather than throwing", () => {
    const query = parseListingsQuery(
      new URLSearchParams("minPrice=cheap&page=0&pageSize=9999&minBedrooms=1.5"),
    );
    expect(query.minPrice).toBeUndefined();
    expect(query.minBedrooms).toBeUndefined();
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("treats blank values as absent", () => {
    const query = parseListingsQuery(new URLSearchParams("city=%20%20&keyword="));
    expect(query.city).toBeUndefined();
    expect(query.keyword).toBeUndefined();
  });

  it("reads a valid sort value", () => {
    const query = parseListingsQuery(
      new URLSearchParams("sort=price_asc&page=1&pageSize=10"),
    );
    expect(query.sort).toBe("price_asc");
  });

  it("drops an invalid sort value rather than throwing", () => {
    const query = parseListingsQuery(
      new URLSearchParams("sort=popular&page=1&pageSize=10"),
    );
    expect(query.sort).toBeUndefined();
  });
});

describe("toSearchParams", () => {
  it("omits empty filters and always includes pagination", () => {
    expect(toSearchParams({ page: 1, pageSize: 10 }).toString()).toBe(
      "page=1&pageSize=10",
    );
  });

  it("round-trips through parse", () => {
    const query = {
      minPrice: 100,
      city: "Fairfax",
      targetBudget: 200,
      page: 3,
      pageSize: 5,
    };
    expect(parseListingsQuery(toSearchParams(query))).toEqual(query);
  });

  it("omits the recommended (default) sort and includes non-default sorts", () => {
    expect(toSearchParams({ page: 1, pageSize: 10 }).has("sort")).toBe(false);
    expect(
      toSearchParams({ page: 1, pageSize: 10, sort: "recommended" }).has("sort"),
    ).toBe(false);
    expect(
      toSearchParams({ page: 1, pageSize: 10, sort: "price_asc" }).get("sort"),
    ).toBe("price_asc");
  });
});

describe("filtersKey", () => {
  it("ignores pagination so the form does not reset on page changes", () => {
    expect(filtersKey({ city: "Reston", page: 1, pageSize: 10 })).toBe(
      filtersKey({ city: "Reston", page: 4, pageSize: 25 }),
    );
  });

  it("changes when filters change", () => {
    expect(filtersKey({ city: "Reston", page: 1, pageSize: 10 })).not.toBe(
      filtersKey({ city: "Vienna", page: 1, pageSize: 10 }),
    );
  });

  it("ignores the sort so the form does not reset when sorting changes", () => {
    expect(filtersKey({ city: "Reston", page: 1, pageSize: 10 })).toBe(
      filtersKey({ city: "Reston", sort: "price_asc", page: 2, pageSize: 10 }),
    );
  });

  it("ignores the detail selection so the form does not reset when the modal opens", () => {
    expect(filtersKey({ city: "Reston", page: 1, pageSize: 10 })).toBe(
      filtersKey({
        city: "Reston",
        page: 1,
        pageSize: 10,
        detail: { source: "MLS_A", id: "A1" },
      }),
    );
  });
});

describe("detail selection", () => {
  it("reads listingSource + listingId into a detail ref", () => {
    const query = parseListingsQuery(
      new URLSearchParams(
        "listingSource=MLS_A&listingId=A1&page=2&pageSize=10",
      ),
    );
    expect(query.detail).toEqual({ source: "MLS_A", id: "A1" });
  });

  it("ignores a partial selection rather than opening a half-formed ref", () => {
    expect(
      parseListingsQuery(new URLSearchParams("listingSource=MLS_A")).detail,
    ).toBeUndefined();
    expect(
      parseListingsQuery(new URLSearchParams("listingId=A1")).detail,
    ).toBeUndefined();
  });

  it("keeps detail out of the search params the API receives", () => {
    const params = toSearchParams({
      page: 1,
      pageSize: 10,
      detail: { source: "MLS_A", id: "A1" },
    });
    expect(params.has("listingSource")).toBe(false);
    expect(params.has("listingId")).toBe(false);
    expect(params.toString()).toBe("page=1&pageSize=10");
  });

  it("carries detail in the URL params and round-trips through parse", () => {
    const query = {
      page: 2,
      pageSize: 10,
      city: "Reston",
      detail: { source: "MLS_B", id: "B7" },
    };
    expect(parseListingsQuery(toUrlSearchParams(query))).toEqual(query);
  });
});

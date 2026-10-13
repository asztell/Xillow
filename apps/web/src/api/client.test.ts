import { describe, expect, it, vi } from "vitest";
import { buildListingsUrl, fetchListings, ListingApiError } from "./client";

describe("buildListingsUrl", () => {
  it("omits empty filters and includes pagination", () => {
    expect(buildListingsUrl({ page: 1, pageSize: 10 }, "")).toBe(
      "/api/listings?page=1&pageSize=10",
    );
  });

  it("includes filters and respects a base URL", () => {
    const url = buildListingsUrl(
      { minPrice: 1, city: "Fairfax", page: 2, pageSize: 5 },
      "https://api.example.com",
    );
    expect(url).toBe(
      "https://api.example.com/api/listings?minPrice=1&city=Fairfax&page=2&pageSize=5",
    );
  });

  it("includes the sort parameter when it is not the default", () => {
    const url = buildListingsUrl(
      { sort: "price_asc", page: 1, pageSize: 10 },
      "",
    );
    expect(url).toContain("sort=price_asc");
  });

  it("omits the default sort from the URL", () => {
    const url = buildListingsUrl(
      { sort: "recommended", page: 1, pageSize: 10 },
      "",
    );
    expect(url).not.toContain("sort");
  });
});

describe("fetchListings", () => {
  it("parses a successful response", async () => {
    const body = {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
      results: [],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchListings({ page: 1, pageSize: 10 })).resolves.toEqual(body);
  });

  it("rejects a malformed success body at the boundary", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: "nope" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchListings({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      name: "ListingApiError",
      code: "INVALID_RESPONSE",
    });
  });

  it("maps a 400 to a ListingApiError carrying the field", async () => {
    const body = {
      error: {
        code: "INVALID_QUERY",
        message: "minPrice must be less than or equal to maxPrice",
        field: "minPrice",
      },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(body), { status: 400 }),
    );

    await expect(fetchListings({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      name: "ListingApiError",
      status: 400,
      field: "minPrice",
      code: "INVALID_QUERY",
      message: "minPrice must be less than or equal to maxPrice",
    });
  });

  it("maps a 500 with a non-JSON body to a generic API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("boom", { status: 500 }),
    );
    await expect(fetchListings({ page: 1, pageSize: 10 })).rejects.toBeInstanceOf(
      ListingApiError,
    );
  });

  it("maps a transport failure to a NETWORK_ERROR", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchListings({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });
});

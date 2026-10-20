import { describe, expect, it, vi } from "vitest";
import {
  buildListingDetailUrl,
  buildListingsUrl,
  fetchListingDetail,
  fetchListings,
  ListingApiError,
} from "./client";

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

  it("never sends the web-only detail selection to the API", () => {
    const url = buildListingsUrl(
      { page: 1, pageSize: 10, detail: { source: "MLS_A", id: "A1" } },
      "",
    );
    expect(url).toBe("/api/listings?page=1&pageSize=10");
  });
});

describe("buildListingDetailUrl", () => {
  it("builds a detail URL from the (source, id) pair", () => {
    expect(buildListingDetailUrl("MLS_A", "A1", "")).toBe(
      "/api/listings/MLS_A/A1",
    );
  });

  it("respects a base URL and escapes unsafe characters", () => {
    expect(
      buildListingDetailUrl("MLS A", "a/b", "https://api.example.com"),
    ).toBe("https://api.example.com/api/listings/MLS%20A/a%2Fb");
  });
});

describe("fetchListingDetail", () => {
  it("parses a successful response, sources included", async () => {
    const body = {
      id: "A1",
      source: "MLS_A",
      price: 450000,
      photos: [],
      sources: [
        { id: "C8", source: "MLS_C", price: 448000, isCurrent: true },
        { id: "A1", source: "MLS_A", price: 450000, isCurrent: false },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchListingDetail("MLS_A", "A1")).resolves.toEqual(body);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/listings/MLS_A/A1",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("rejects a payload without a non-empty sources list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ id: "A1", source: "MLS_A", price: 1, sources: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(fetchListingDetail("MLS_A", "A1")).rejects.toMatchObject({
      name: "ListingApiError",
      code: "INVALID_RESPONSE",
    });
  });

  it("maps a 404 to a NOT_FOUND error carrying the message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "NOT_FOUND", message: "Listing not found." },
        }),
        { status: 404 },
      ),
    );

    await expect(fetchListingDetail("MLS_A", "NOPE")).rejects.toMatchObject({
      name: "ListingApiError",
      status: 404,
      code: "NOT_FOUND",
      message: "Listing not found.",
    });
  });

  it("maps a transport failure to a NETWORK_ERROR", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    await expect(fetchListingDetail("MLS_A", "A1")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
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

    await expect(fetchListings({ page: 1, pageSize: 10 })).resolves.toEqual(
      body,
    );
  });

  it("rejects a malformed success body at the boundary", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: "nope" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      fetchListings({ page: 1, pageSize: 10 }),
    ).rejects.toMatchObject({
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

    await expect(
      fetchListings({ page: 1, pageSize: 10 }),
    ).rejects.toMatchObject({
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
    await expect(
      fetchListings({ page: 1, pageSize: 10 }),
    ).rejects.toBeInstanceOf(ListingApiError);
  });

  it("maps a transport failure to a NETWORK_ERROR", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    await expect(
      fetchListings({ page: 1, pageSize: 10 }),
    ).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });
});

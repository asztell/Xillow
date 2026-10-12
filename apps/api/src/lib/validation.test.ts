import { describe, it, expect } from "vitest";
import { parseSearchParams, MAX_PAGE_SIZE } from "./validation";

describe("parseSearchParams", () => {
  it("applies defaults when no parameters are supplied", () => {
    const result = parseSearchParams({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params).toMatchObject({
      page: 1,
      pageSize: 10,
      minPrice: undefined,
      maxPrice: undefined,
      minBedrooms: undefined,
      city: undefined,
      keyword: undefined,
      targetBudget: undefined,
    });
  });

  it("parses valid values into numbers and strings", () => {
    const result = parseSearchParams({
      minPrice: "400000",
      maxPrice: "600000",
      minBedrooms: "2",
      city: "Springfield",
      keyword: "pet friendly",
      targetBudget: "475000",
      page: "2",
      pageSize: "25",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params).toEqual({
      minPrice: 400000,
      maxPrice: 600000,
      minBedrooms: 2,
      city: "Springfield",
      keyword: "pet friendly",
      targetBudget: 475000,
      page: 2,
      pageSize: 25,
    });
  });

  it("treats empty and whitespace-only values as absent", () => {
    const result = parseSearchParams({ city: "  ", minPrice: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params.city).toBeUndefined();
    expect(result.params.minPrice).toBeUndefined();
  });

  it("allows minPrice equal to maxPrice", () => {
    const result = parseSearchParams({ minPrice: "500000", maxPrice: "500000" });
    expect(result.ok).toBe(true);
  });

  it("rejects minPrice greater than maxPrice", () => {
    const result = parseSearchParams({ minPrice: "600000", maxPrice: "400000" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("minPrice");
    expect(result.message).toMatch(/less than or equal/i);
  });

  it("rejects non-numeric prices", () => {
    const result = parseSearchParams({ minPrice: "cheap" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("minPrice");
  });

  it("rejects negative prices", () => {
    const result = parseSearchParams({ maxPrice: "-1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("maxPrice");
  });

  it("rejects a pageSize of zero or less", () => {
    const zero = parseSearchParams({ pageSize: "0" });
    const negative = parseSearchParams({ pageSize: "-5" });
    expect(zero.ok).toBe(false);
    expect(negative.ok).toBe(false);
  });

  it("rejects a pageSize above the maximum", () => {
    const result = parseSearchParams({ pageSize: String(MAX_PAGE_SIZE + 1) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("pageSize");
  });

  it("accepts the pageSize boundary values", () => {
    const min = parseSearchParams({ pageSize: "1" });
    const max = parseSearchParams({ pageSize: String(MAX_PAGE_SIZE) });
    expect(min.ok).toBe(true);
    expect(max.ok).toBe(true);
  });

  it("rejects a page below 1", () => {
    const result = parseSearchParams({ page: "0" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("page");
  });

  it("rejects non-integer pagination values", () => {
    const result = parseSearchParams({ page: "1.5" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("page");
  });

  it("rejects negative minBedrooms", () => {
    const result = parseSearchParams({ minBedrooms: "-1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("minBedrooms");
  });

  it("rejects repeated parameters instead of silently choosing one", () => {
    const result = parseSearchParams({ minPrice: ["100", "200"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("minPrice");
  });

  it("ignores unknown parameters", () => {
    const result = parseSearchParams({ sortBy: "price", foo: "bar" });
    expect(result.ok).toBe(true);
  });
});

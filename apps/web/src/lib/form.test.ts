import { describe, expect, it } from "vitest";
import {
  emptyForm,
  formFromQuery,
  hasErrors,
  queryFromForm,
  validateFilters,
} from "./form";

describe("validateFilters", () => {
  it("accepts an empty form", () => {
    expect(validateFilters(emptyForm())).toEqual({});
  });

  it("rejects minPrice greater than maxPrice", () => {
    const errors = validateFilters({
      ...emptyForm(),
      minPrice: "600000",
      maxPrice: "400000",
    });
    expect(errors.minPrice).toMatch(/less than or equal/i);
  });

  it("allows minPrice equal to maxPrice", () => {
    expect(
      validateFilters({ ...emptyForm(), minPrice: "500000", maxPrice: "500000" }),
    ).toEqual({});
  });

  it("rejects negative prices", () => {
    expect(validateFilters({ ...emptyForm(), minPrice: "-1" }).minPrice).toBeDefined();
  });

  it("rejects non-numeric prices", () => {
    expect(validateFilters({ ...emptyForm(), maxPrice: "cheap" }).maxPrice).toBeDefined();
  });

  it("rejects a pageSize of zero or less", () => {
    expect(validateFilters({ ...emptyForm(), pageSize: "0" }).pageSize).toBeDefined();
  });

  it("rejects a pageSize above the maximum", () => {
    expect(validateFilters({ ...emptyForm(), pageSize: "101" }).pageSize).toBeDefined();
  });

  it("rejects non-integer minBedrooms", () => {
    expect(
      validateFilters({ ...emptyForm(), minBedrooms: "2.5" }).minBedrooms,
    ).toBeDefined();
  });
});

describe("form/query conversion", () => {
  it("seeds a form from a query and converts back", () => {
    const values = formFromQuery({
      minPrice: 400000,
      minBedrooms: 2,
      city: "Springfield",
      page: 3,
      pageSize: 25,
    });

    expect(values).toMatchObject({
      minPrice: "400000",
      minBedrooms: "2",
      city: "Springfield",
      pageSize: "25",
    });

    expect(queryFromForm(values, 1)).toMatchObject({
      minPrice: 400000,
      minBedrooms: 2,
      city: "Springfield",
      page: 1,
      pageSize: 25,
    });
  });

  it("trims strings and drops blanks", () => {
    const values = { ...emptyForm(), city: "  Reston  ", keyword: "   " };
    const query = queryFromForm(values, 1);
    expect(query.city).toBe("Reston");
    expect(query.keyword).toBeUndefined();
    expect(query.minPrice).toBeUndefined();
  });
});

describe("hasErrors", () => {
  it("reports whether any errors are present", () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ minPrice: "boom" })).toBe(true);
  });
});

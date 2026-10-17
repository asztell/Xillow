import { describe, expect, it } from "vitest";
import {
  emptyForm,
  formFromQuery,
  hasErrors,
  isFormDirty,
  queryFromForm,
  validateFilters,
  type FilterFormValues,
} from "./form";
import type { ListingsQuery } from "./query";

const APPLIED: ListingsQuery = { page: 1, pageSize: 10 };

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

describe("isFormDirty", () => {
  it("is clean for a form seeded from the applied query", () => {
    expect(isFormDirty(formFromQuery(APPLIED), APPLIED)).toBe(false);
  });

  it("detects a changed page size on its own", () => {
    const values: FilterFormValues = { ...emptyForm(), pageSize: "25" };
    expect(isFormDirty(values, APPLIED)).toBe(true);
  });

  it("is clean when the page size is typed differently but means the same", () => {
    const values: FilterFormValues = { ...emptyForm(), pageSize: " 10 " };
    expect(isFormDirty(values, APPLIED)).toBe(false);
  });

  it("treats a cleared page size as a change back to the default", () => {
    const values: FilterFormValues = { ...emptyForm(), pageSize: "" };
    expect(isFormDirty(values, { page: 1, pageSize: 25 })).toBe(true);
    expect(isFormDirty(values, APPLIED)).toBe(false);
  });

  it("detects changed and cleared facets", () => {
    const applied: ListingsQuery = { page: 1, pageSize: 10, city: "Reston" };
    expect(isFormDirty({ ...emptyForm(), city: "Vienna" }, applied)).toBe(true);
    expect(isFormDirty(emptyForm(), applied)).toBe(true);
  });

  it("ignores page and sort, which the form does not own", () => {
    const values = formFromQuery(APPLIED);
    expect(isFormDirty(values, { page: 4, pageSize: 10 })).toBe(false);
    expect(isFormDirty(values, { page: 1, pageSize: 10, sort: "price_asc" })).toBe(
      false,
    );
  });

  it("stays dirty while the page size is not a valid number", () => {
    // An unparseable draft still differs from the applied value, so Apply stays
    // reachable and submit can surface the validation error.
    expect(isFormDirty({ ...emptyForm(), pageSize: "abc" }, APPLIED)).toBe(true);
  });
});

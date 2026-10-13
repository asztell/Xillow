import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  FILTER_LABELS,
  countActiveFilters,
  countActiveFormFilters,
  emptyForm,
  formFromQuery,
  hasErrors,
  queryFromForm,
  validateFilters,
  type FilterField,
  type FilterFormValues,
  type FormErrors,
} from "../lib/form";
import type { ListingsQuery } from "../lib/query";
import { useFilterPanel } from "../hooks/useFilterPanel";
import { ChevronIcon, FilterIcon } from "./icons";

const FIELDS: FilterField[] = [
  "minPrice",
  "maxPrice",
  "minBedrooms",
  "city",
  "keyword",
  "targetBudget",
  "pageSize",
];

const NUMERIC_FIELDS = new Set<FilterField>([
  "minPrice",
  "maxPrice",
  "minBedrooms",
  "targetBudget",
  "pageSize",
]);

const PLACEHOLDERS: Partial<Record<FilterField, string>> = {
  minPrice: "e.g. 400000",
  maxPrice: "e.g. 600000",
  minBedrooms: "e.g. 2",
  city: "e.g. Springfield",
  keyword: "e.g. pets",
  targetBudget: "e.g. 475000",
  pageSize: "10",
};

interface SearchFormProps {
  /** The applied query; used to seed the draft. */
  query: ListingsQuery;
  /** Called with a fresh query (page reset to 1) when the form is submitted. */
  onSubmit: (next: ListingsQuery) => void;
  disabled?: boolean;
}

/**
 * Controlled search form. Holds a *draft* of the filters; only on submit does
 * it validate and promote the draft into the applied query (which lives in the
 * URL). The parent re-mounts this form when the applied filters change so the
 * draft stays in sync with back/forward navigation.
 *
 * The facet inputs sit behind a collapsible "Filters" toggle (open/closed is
 * remembered across loads); the Apply/Reset actions are pinned to the bottom
 * right and stay visible either way.
 */
export function SearchForm({
  query,
  onSubmit,
  disabled = false,
}: SearchFormProps) {
  const [values, setValues] = useState<FilterFormValues>(() =>
    formFromQuery(query),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const { open, toggleOpen } = useFilterPanel();

  const activeCount = countActiveFilters(query);
  // Nothing to apply or clear when the draft is empty *and* the URL already has
  // no filters. If the URL does have filters, keep the actions live so the user
  // can still clear them.
  const hasFilters = countActiveFormFilters(values) > 0 || activeCount > 0;

  const handleChange =
    (field: FilterField) => (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateFilters(values);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    // Preserve the current sort across filter changes, like the major portals.
    onSubmit({ ...queryFromForm(values, 1), sort: query.sort });
  };

  // Clear every facet and apply immediately. `pageSize` is a display setting,
  // not a filter, so it is carried over.
  const handleReset = () => {
    const cleared: FilterFormValues = {
      ...emptyForm(),
      pageSize: values.pageSize,
    };
    setValues(cleared);
    setErrors({});
    onSubmit({ ...queryFromForm(cleared, 1), sort: query.sort });
  };

  return (
    <form
      className="search-form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Listing search"
    >
      <div className="filter-toolbar">
        <button
          type="button"
          className="filter-toggle"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-controls="filter-fields"
          aria-label={
            activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"
          }
        >
          <FilterIcon />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="filter-count" aria-hidden="true">
              {activeCount}
            </span>
          )}
          <ChevronIcon open={open} />
        </button>

        <div className="form-actions">
          <button
            type="button"
            className="reset-button"
            onClick={handleReset}
            disabled={disabled || !hasFilters}
          >
            Reset all filters
          </button>
          <button type="submit" disabled={disabled || !hasFilters}>
            {disabled ? "Applying…" : "Apply Filters"}
          </button>
        </div>
      </div>

      <div id="filter-fields" className="filter-fields" hidden={!open}>
        {FIELDS.map((field) => {
          const error = errors[field];
          const inputId = `filter-${field}`;
          const errorId = `${inputId}-error`;
          return (
            <div className="field" key={field}>
              <label htmlFor={inputId}>{FILTER_LABELS[field]}</label>
              <input
                id={inputId}
                name={field}
                type={NUMERIC_FIELDS.has(field) ? "number" : "text"}
                inputMode={NUMERIC_FIELDS.has(field) ? "numeric" : undefined}
                placeholder={PLACEHOLDERS[field]}
                value={values[field]}
                onChange={handleChange(field)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
              {error ? (
                <p className="field-error" id={errorId} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </form>
  );
}


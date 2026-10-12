import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  FILTER_LABELS,
  formFromQuery,
  hasErrors,
  queryFromForm,
  validateFilters,
  type FilterField,
  type FilterFormValues,
  type FormErrors,
} from "../lib/form";
import type { ListingsQuery } from "../lib/query";

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
 */
export function SearchForm({ query, onSubmit, disabled = false }: SearchFormProps) {
  const [values, setValues] = useState<FilterFormValues>(() => formFromQuery(query));
  const [errors, setErrors] = useState<FormErrors>({});

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
    onSubmit(queryFromForm(values, 1));
  };

  return (
    <form
      className="search-form"
      onSubmit={handleSubmit}
      noValidate
      aria-label="Listing search"
    >
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

      <div className="form-actions">
        <button type="submit" disabled={disabled}>
          {disabled ? "Searching…" : "Search"}
        </button>
      </div>
    </form>
  );
}

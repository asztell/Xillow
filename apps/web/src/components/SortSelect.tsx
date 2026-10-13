import type { SortKey } from "@xillow/types";

/** The sort options in display (dropdown) order. */
export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "newest", label: "Newest" },
  { value: "bedrooms_desc", label: "Bedrooms" },
  { value: "bathrooms_desc", label: "Bathrooms" },
  { value: "sqft_desc", label: "Square Feet" },
];

interface SortSelectProps {
  /** The applied sort; undefined means the default ("recommended"). */
  value?: SortKey;
  onChange: (sort: SortKey) => void;
  disabled?: boolean;
}

/**
 * Zillow-style sort dropdown. Placed at the top of the results and kept in the
 * URL (`?sort=price_asc`) so the choice survives reloads and back/forward.
 */
export function SortSelect({ value, onChange, disabled = false }: SortSelectProps) {
  return (
    <div className="sort-select">
      <span className="sort-select-label">Sort</span>
      <select
        aria-label="Sort results"
        value={value ?? "recommended"}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as SortKey)}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
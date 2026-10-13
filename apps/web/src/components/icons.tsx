/**
 * Small inline SVG glyphs used by the search form.
 *
 * Kept in one file (rather than pulling in an icon package) so they inherit
 * `currentColor` and add no runtime dependency.
 */

/** Funnel/"filters" glyph shown to the left of the toggle label. */
export function FilterIcon() {
  return (
    <svg
      className="filter-toggle-icon"
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

/** Down-pointing chevron on the right that flips up when the panel is open. */
export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="filter-toggle-chevron"
      data-open={open}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

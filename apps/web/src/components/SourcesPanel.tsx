import type { ListingSource } from "@xillow/types";
import { formatDate, formatPrice } from "../lib/format";

interface SourcesPanelProps {
  /** Every feed row for the property, newest first. */
  sources: ListingSource[];
}

/**
 * Provenance for a listing: the feeds it came from and how each row compares.
 *
 * Siblings only surface here (and only when there are any) - the search grid
 * stays one card per property. The newest row is tagged so it is obvious which
 * one the results represent.
 */
export function SourcesPanel({ sources }: SourcesPanelProps) {
  if (sources.length <= 1) {
    return (
      <section
        className="sources-panel is-solo"
        aria-labelledby="sources-heading"
      >
        <h2 className="sources-heading" id="sources-heading">
          Sources
        </h2>
        <p className="sources-note">Listed on {sources[0].source}.</p>
      </section>
    );
  }

  return (
    <section className="sources-panel" aria-labelledby="sources-heading">
      <h2 className="sources-heading" id="sources-heading">
        Sources &amp; listing history
      </h2>
      <p className="sources-note">
        This property appears on {sources.length} feeds, newest first.
      </p>
      <ul className="sources-list">
        {sources.map((row) => (
          <li
            key={`${row.source}:${row.id}`}
            className="source-row"
            data-current={row.isCurrent}
          >
            <span className="source-name">{row.source}</span>
            <span className="source-price">{formatPrice(row.price)}</span>
            <time className="source-date" dateTime={row.listedDate}>
              {formatDate(row.listedDate)}
            </time>
            <span className="source-status">{row.status}</span>
            {row.isCurrent && (
              <span className="source-current-tag">Current listing</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

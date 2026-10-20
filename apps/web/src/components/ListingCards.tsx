import type { ScoredListing } from "@xillow/types";
import { formatPrice } from "../lib/format";
import { PhotoCarousel } from "./PhotoCarousel";

const DASH = "—";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="listing-stat">
      <span className="listing-stat-value">{value}</span>
      <span className="listing-stat-label">{label}</span>
    </div>
  );
}

interface ListingCardsProps {
  listings: ScoredListing[];
  /** Opens the detail overlay for a listing, keyed by its `(source, id)` pair. */
  onSelect: (source: string, id: string) => void;
}

/**
 * Property cards - the industry-standard way to show listings. Each card is an
 * `<article>` that leads with a full-width landscape photo strip, then a
 * price/provenance row, a single-line address (street fused with city, state
 * and zip), and the key stats.
 *
 * The whole card opens the detail overlay. The address heading stays a real
 * `<button>` so the action is keyboard-reachable and named for screen readers;
 * the carousel's chevrons and that button stop propagation so they keep their
 * own behaviour instead of triggering the card.
 */
export function ListingCards({ listings, onSelect }: ListingCardsProps) {
  return (
    <div className="listing-grid" aria-label="Listings">
      {listings.map((listing) => (
        // The card body is a pointer convenience, not a control: the address
        // `<button>` below is the keyboard-reachable, named affordance for the
        // same action. Giving the article `role="button"` would nest it around
        // that real button, which is worse for screen readers than leaving the
        // article non-interactive.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <article
          className="listing-card"
          key={`${listing.source}:${listing.id}`}
          onClick={() => onSelect(listing.source, listing.id)}
        >
          <div className="listing-card-media">
            <PhotoCarousel
              photos={listing.photos ?? []}
              alt={`${listing.address}, ${listing.city}`}
            />
          </div>

          <div className="listing-card-top">
            <span className="listing-price">{formatPrice(listing.price)}</span>
            <span className="listing-card-tags">
              {listing.status !== "active" && (
                <span className="status-tag">{listing.status}</span>
              )}
              <span className="source-tag">{listing.source}</span>
            </span>
          </div>

          <div className="listing-address-line">
            <h3 className="listing-address">
              <button
                type="button"
                className="listing-address-link"
                onClick={(event) => {
                  // Already handled by the card, but stop here so the click is
                  // not dispatched twice.
                  event.stopPropagation();
                  onSelect(listing.source, listing.id);
                }}
              >
                {listing.address}
              </button>
            </h3>
            <span className="listing-locality">
              {listing.city}, {listing.state} {listing.zip}
            </span>
          </div>

          <div className="listing-stats">
            <Stat
              label="beds"
              value={
                listing.bedrooms === null ? DASH : String(listing.bedrooms)
              }
            />
            <Stat
              label="baths"
              value={
                listing.bathrooms === null ? DASH : String(listing.bathrooms)
              }
            />
            <Stat
              label="sqft"
              value={
                listing.sqft === null ? DASH : listing.sqft.toLocaleString()
              }
            />
          </div>
        </article>
      ))}
    </div>
  );
}

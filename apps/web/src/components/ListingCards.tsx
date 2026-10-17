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
 * and zip), and the key stats. The address opens the detail overlay.
 */
export function ListingCards({ listings, onSelect }: ListingCardsProps) {
  return (
    <div className="listing-grid" aria-label="Listings">
      {listings.map((listing) => (
        <article className="listing-card" key={`${listing.source}:${listing.id}`}>
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
                onClick={() => onSelect(listing.source, listing.id)}
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
              value={listing.bedrooms === null ? DASH : String(listing.bedrooms)}
            />
            <Stat
              label="baths"
              value={listing.bathrooms === null ? DASH : String(listing.bathrooms)}
            />
            <Stat
              label="sqft"
              value={listing.sqft === null ? DASH : listing.sqft.toLocaleString()}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
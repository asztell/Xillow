import type { ScoredListing } from "@xillow/types";
import { formatFullAddress, formatPrice, formatScore } from "../lib/format";

const DASH = "—";

export function ResultsTable({ listings }: { listings: ScoredListing[] }) {
  return (
    <table className="results-table">
      <caption className="sr-only">Ranked listings for the current search</caption>
      <thead>
        <tr>
          <th scope="col">Address</th>
          <th scope="col">City</th>
          <th scope="col">Price</th>
          <th scope="col">Beds</th>
          <th scope="col">Baths</th>
          <th scope="col">Sqft</th>
          <th scope="col">Score</th>
        </tr>
      </thead>
      <tbody>
        {listings.map((listing) => (
          <tr key={`${listing.source}:${listing.id}`}>
            <td>
              <div className="address-line">
                {listing.address}
                <span className="source-tag">{listing.source}</span>
              </div>
              {listing.isPrimary && (
                <span className="primary-tag">most recent</span>
              )}
              {listing.potentialDuplicates.length > 0 && (
                <span className="duplicate-note">
                  Possible duplicate of{" "}
                  {listing.potentialDuplicates
                    .map(
                      (dup) =>
                        `${formatFullAddress(dup)} (${dup.source} ${formatPrice(dup.price)})`,
                    )
                    .join("; ")}
                </span>
              )}
            </td>
            <td>
              {listing.city}, {listing.state}
            </td>
            <td className="numeric">{formatPrice(listing.price)}</td>
            <td className="numeric">{listing.bedrooms ?? DASH}</td>
            <td className="numeric">{listing.bathrooms ?? DASH}</td>
            <td className="numeric">
              {listing.sqft === null ? DASH : listing.sqft.toLocaleString()}
            </td>
            <td className="numeric score">{formatScore(listing.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

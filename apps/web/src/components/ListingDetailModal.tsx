import type { ListingDetail } from "@xillow/types";
import { ListingApiError } from "../api/client";
import { useListingDetail } from "../hooks/useListingDetail";
import { formatPrice } from "../lib/format";
import { Modal } from "./Modal";
import { PhotoGallery } from "./PhotoGallery";
import { SourcesPanel } from "./SourcesPanel";

const DASH = "—";
const TITLE_ID = "listing-detail-title";

interface ListingDetailModalProps {
  source: string;
  id: string;
  /**
   * Switches the open modal to a different listing (e.g. the newer sibling).
   * The parent replaces the URL so closing still returns to the grid.
   */
  onSelect: (source: string, id: string) => void;
  onClose: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/** Body shared by the loading, error and loaded states of the modal. */
function DetailContent({
  detail,
  onSelect,
}: {
  detail: ReturnType<typeof useListingDetail>;
  onSelect: (source: string, id: string) => void;
}) {
  const data = detail.data;

  if (detail.isPending) {
    return (
      <p className="state" role="status">
        Loading listing…
      </p>
    );
  }

  if (detail.isError) {
    const message =
      detail.error instanceof ListingApiError
        ? detail.error.message
        : "Unable to load the listing.";
    return (
      <div className="state state-error" role="alert">
        <p>{message}</p>
        <button
          type="button"
          className="retry-button"
          onClick={() => void detail.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return <LoadedDetail data={data} onSelect={onSelect} />;
}

function LoadedDetail({
  data,
  onSelect,
}: {
  data: ListingDetail;
  onSelect: (source: string, id: string) => void;
}) {
  const current = data.sources.find((row) => row.isCurrent);
  const isNewest =
    current !== undefined && current.id === data.id && current.source === data.source;

  return (
    <>
      <PhotoGallery
        photos={data.photos ?? []}
        alt={`${data.address}, ${data.city}`}
      />

      <div className="detail-main">
        <div className="detail-heading">
          <span className="detail-price">{formatPrice(data.price)}</span>
          {data.status !== "active" && (
            <span className="status-tag">{data.status}</span>
          )}
        </div>
        <h2 className="detail-address" id={TITLE_ID}>
          {data.address}
        </h2>
        <p className="detail-locality">
          {data.city}, {data.state} {data.zip}
        </p>

        <div className="detail-stats">
          <Stat label="beds" value={data.bedrooms === null ? DASH : String(data.bedrooms)} />
          <Stat
            label="baths"
            value={data.bathrooms === null ? DASH : String(data.bathrooms)}
          />
          <Stat label="sqft" value={data.sqft === null ? DASH : String(data.sqft)} />
          <Stat label="listed" value={new Date(data.listedDate).toLocaleDateString()} />
        </div>

        {data.description && (
          <p className="detail-description">{data.description}</p>
        )}

        {current && !isNewest && (
          <p className="detail-newer">
            A newer listing for this property is available from {current.source}.
            <button
              type="button"
              className="detail-newer-link"
              onClick={() => onSelect(current.source, current.id)}
            >
              View the current listing
            </button>
          </p>
        )}

        <SourcesPanel sources={data.sources} />
      </div>
    </>
  );
}

/**
 * Detail view for one listing, shown as an overlay on the search grid so the
 * results stay mounted behind it. The requested listing is the main content;
 * its cross-source siblings appear in the Sources panel. Deep-linking an older
 * sibling still resolves, and points to the newer listing that the grid shows.
 */
export function ListingDetailModal({
  source,
  id,
  onSelect,
  onClose,
}: ListingDetailModalProps) {
  const detail = useListingDetail(source, id);

  return (
    <Modal
      onClose={onClose}
      className="listing-detail"
      labelledBy={detail.data ? TITLE_ID : undefined}
      label="Listing details"
    >
      <div className="detail-body">
        <button
          type="button"
          className="detail-close"
          aria-label="Close listing details"
          onClick={onClose}
        >
          ×
        </button>

        <DetailContent detail={detail} onSelect={onSelect} />
      </div>
    </Modal>
  );
}

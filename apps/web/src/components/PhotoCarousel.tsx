import { useState } from "react";
import {
  PLACEHOLDER_IMAGE_URL,
  photoPlaceholder,
} from "../lib/photoPlaceholder";

interface PhotoCarouselProps {
  /** Remote image URLs for this listing; may be empty. */
  photos: string[];
  /** Human-readable name used in alt text (e.g. "123 Main St, Springfield"). */
  alt: string;
}

/**
 * A compact photo strip for one listing card.
 *
 * Shows the first photo with prev/next controls and a position counter when
 * several photos exist. A listing with no photos (or one whose remote image
 * fails to load) falls back first to the branded `PLACEHOLDER_IMAGE_URL` and,
 * if even that cannot be fetched, to a generated, network-free SVG - so the
 * media slot is never empty and the card layout stays stable.
 */
export function PhotoCarousel({ photos, alt }: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);
  const count = photos.length;
  // Clamp (rather than reset) if the listing changes while mounted.
  const current = count === 0 ? 0 : Math.min(index, count - 1);
  const generated = photoPlaceholder(alt);

  // Staged fallback: listing photo -> branded placeholder -> generated SVG.
  const onImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    // Already showing the last resort - stop so a failing image cannot loop.
    if (img.src === generated) return;
    img.alt = "";
    img.src = img.src === PLACEHOLDER_IMAGE_URL ? generated : PLACEHOLDER_IMAGE_URL;
  };

  if (count === 0) {
    return (
      <div
        className="listing-photo is-empty"
        role="img"
        aria-label={`Photo placeholder for ${alt}`}
      >
        <img
          className="listing-photo-img"
          src={PLACEHOLDER_IMAGE_URL}
          alt=""
          loading="lazy"
          onError={onImageError}
        />
      </div>
    );
  }

  const prev = () => setIndex((i) => (i - 1 + count) % count);
  const next = () => setIndex((i) => (i + 1) % count);
  const altText = count > 1 ? `${alt} – photo ${current + 1} of ${count}` : alt;

  return (
    <div className="listing-photo">
      <img
        key={current}
        className="listing-photo-img"
        src={photos[current]}
        alt={altText}
        loading="lazy"
        onError={onImageError}
      />
      {count > 1 && (
        <>
          <button
            type="button"
            className="photo-nav photo-prev"
            aria-label="Previous photo"
            onClick={prev}
          >
            ‹
          </button>
          <button
            type="button"
            className="photo-nav photo-next"
            aria-label="Next photo"
            onClick={next}
          >
            ›
          </button>
          <span className="photo-count" aria-hidden="true">
            {current + 1} / {count}
          </span>
        </>
      )}
    </div>
  );
}
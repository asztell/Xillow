import { useState } from "react";
import { PLACEHOLDER_IMAGE_URL } from "../lib/photoPlaceholder";
import { ListingPhoto } from "./ListingPhoto";
import { PhotoLightbox } from "./PhotoLightbox";

interface PhotoGalleryProps {
  /** Remote image URLs; may be empty for a listing with no photos. */
  photos: string[];
  /** Human-readable property name used in alt text. */
  alt: string;
}

/** How many small tiles sit beside the hero; the rest open in the lightbox. */
const THUMB_COUNT = 4;

/**
 * Zillow-style photo mosaic for the detail view: one hero with a 2x2 tile grid
 * beside it, plus a "See all" button. Clicking any tile (or "See all") opens
 * the full-screen lightbox. A listing with no photos gets a stable placeholder
 * so the detail layout never collapses.
 */
export function PhotoGallery({ photos, alt }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const count = photos.length;

  if (count === 0) {
    return (
      <div className="photo-gallery is-empty">
        <div
          className="gallery-img is-empty"
          role="img"
          aria-label={`Photo placeholder for ${alt}`}
        >
          <ListingPhoto
            className="gallery-img"
            src={PLACEHOLDER_IMAGE_URL}
            alt=""
          />
        </div>
      </div>
    );
  }

  return (
    <div className="photo-gallery">
      <button
        type="button"
        className="gallery-hero"
        onClick={() => setLightboxIndex(0)}
        aria-label={`Open photo gallery for ${alt}`}
      >
        <ListingPhoto
          className="gallery-img"
          src={photos[0]}
          alt={alt}
          loading="eager"
        />
      </button>

      {count > 1 && (
        <div className="gallery-thumbs">
          {photos.slice(1, 1 + THUMB_COUNT).map((photo, offset) => (
            <button
              key={`${photo}-${offset}`}
              type="button"
              className="gallery-thumb"
              onClick={() => setLightboxIndex(offset + 1)}
              aria-label={`Open photo ${offset + 2} of ${count} for ${alt}`}
            >
              <ListingPhoto
                className="gallery-img"
                src={photo}
                alt={`${alt} – photo ${offset + 2}`}
              />
            </button>
          ))}
        </div>
      )}

      {count > 1 && (
        <button
          type="button"
          className="see-all-photos"
          onClick={() => setLightboxIndex(0)}
        >
          See all {count} photos
        </button>
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          alt={alt}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

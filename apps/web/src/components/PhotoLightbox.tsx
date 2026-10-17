import { useEffect } from "react";
import { Modal } from "./Modal";
import { ListingPhoto } from "./ListingPhoto";

interface PhotoLightboxProps {
  photos: string[];
  alt: string;
  /** Index of the photo currently shown. */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * Full-screen photo viewer opened from the detail gallery.
 *
 * Renders as a second `<dialog>` on top of the detail modal: the top layer
 * makes the background inert, and Esc closes only this dialog. Arrow keys move
 * through the photos while it is open; the counter keeps the position readable.
 */
export function PhotoLightbox({
  photos,
  alt,
  index,
  onIndexChange,
  onClose,
}: PhotoLightboxProps) {
  const count = photos.length;
  const go = (delta: number) => onIndexChange((index + delta + count) % count);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // `go` closes over index/count, so re-binding on each change is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count, onIndexChange]);

  return (
    <Modal
      onClose={onClose}
      className="lightbox"
      labelledBy="lightbox-counter"
    >
      <div className="lightbox-header">
        <span id="lightbox-counter" className="lightbox-counter">
          {index + 1} of {count}
        </span>
        <button
          type="button"
          className="lightbox-close"
          aria-label="Close photo gallery"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="lightbox-stage">
        <button
          type="button"
          className="lightbox-nav lightbox-prev"
          aria-label="Previous photo"
          onClick={() => go(-1)}
        >
          ‹
        </button>
        <ListingPhoto
          className="lightbox-img"
          src={photos[index]}
          alt={`${alt} – photo ${index + 1} of ${count}`}
          loading="eager"
        />
        <button
          type="button"
          className="lightbox-nav lightbox-next"
          aria-label="Next photo"
          onClick={() => go(1)}
        >
          ›
        </button>
      </div>
    </Modal>
  );
}

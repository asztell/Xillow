import { useCallback, useEffect, useRef, useState } from "react";
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
 *
 * Directly under the enlarged photo sits a filmstrip of every photo, matched to
 * the photo's rendered width. The current one is marked with `aria-current` and
 * a soft ring; clicking any other opens it in place, so a 14-photo gallery can
 * be jumped around without arrowing through it. A long strip grows chevrons on
 * both edges, disabled at whichever end has nothing left to scroll.
 */
export function PhotoLightbox({
  photos,
  alt,
  index,
  onIndexChange,
  onClose,
}: PhotoLightboxProps) {
  const count = photos.length;
  const imageRef = useRef<HTMLImageElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [stripWidth, setStripWidth] = useState<number | null>(null);
  const [scroll, setScroll] = useState({
    overflowing: false,
    left: false,
    right: false,
  });

  const go = (delta: number) => onIndexChange((index + delta + count) % count);

  const syncScroll = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    setScroll({
      overflowing: strip.scrollWidth > strip.clientWidth,
      left: strip.scrollLeft > 1,
      right: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
    });
  }, []);

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

  // The strip tracks the enlarged photo's real width, so the two always line up
  // regardless of the photo's aspect ratio or the viewport size.
  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const measure = () => {
      const width = image.getBoundingClientRect().width;
      setStripWidth(width > 0 ? width : null);
    };

    measure();
    // Before the photo loads there is no intrinsic ratio to derive a width from,
    // so also re-measure when it lands.
    image.addEventListener("load", measure);
    if (typeof ResizeObserver === "undefined") {
      return () => image.removeEventListener("load", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(image);
    return () => {
      image.removeEventListener("load", measure);
      observer.disconnect();
    };
  }, [index]);

  // Keep the selected thumbnail in view while arrowing through a long gallery.
  useEffect(() => {
    const selected = stripRef.current?.querySelector('[aria-current="true"]');
    selected?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    syncScroll();
  }, [index, stripWidth, syncScroll]);

  const scrollStrip = (direction: -1 | 1) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollBy?.({
      left: direction * strip.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  return (
    <Modal onClose={onClose} className="lightbox" labelledBy="lightbox-counter">
      <div className="lightbox-body">
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
          <div className="lightbox-figure">
            <button
              type="button"
              className="lightbox-nav lightbox-prev"
              aria-label="Previous photo"
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <ListingPhoto
              ref={imageRef}
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

          {count > 1 && (
            <div
              className="lightbox-filmstrip-wrap"
              style={stripWidth === null ? undefined : { width: stripWidth }}
            >
              {scroll.overflowing && (
                <>
                  <button
                    type="button"
                    className="filmstrip-nav filmstrip-prev"
                    aria-label="Scroll photos left"
                    disabled={!scroll.left}
                    onClick={() => scrollStrip(-1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="filmstrip-nav filmstrip-next"
                    aria-label="Scroll photos right"
                    disabled={!scroll.right}
                    onClick={() => scrollStrip(1)}
                  >
                    ›
                  </button>
                </>
              )}

              <div
                ref={stripRef}
                className="lightbox-filmstrip"
                role="group"
                aria-label={`All ${count} photos`}
                onScroll={syncScroll}
              >
                {photos.map((photo, i) => (
                  <button
                    key={`${photo}-${i}`}
                    type="button"
                    className={
                      i === index
                        ? "lightbox-thumb is-selected"
                        : "lightbox-thumb"
                    }
                    aria-label={`Show photo ${i + 1} of ${count}`}
                    aria-current={i === index ? "true" : undefined}
                    onClick={() => onIndexChange(i)}
                  >
                    <ListingPhoto
                      className="lightbox-thumb-img"
                      src={photo}
                      alt=""
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

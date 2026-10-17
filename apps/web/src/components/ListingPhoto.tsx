import {
  PLACEHOLDER_IMAGE_URL,
  photoPlaceholder,
} from "../lib/photoPlaceholder";

interface ListingPhotoProps {
  /** Remote image URL; may fail to load, in which case we fall back. */
  src: string;
  /** Human-readable name used in alt text (e.g. "123 Main St, Springfield"). */
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}

/**
 * A listing photo with the staged fallback chain shared by the card carousel,
 * the detail mosaic and the lightbox: listing photo -> branded placeholder ->
 * generated, network-free SVG. It is keyed by the caller when the image should
 * remount (e.g. on carousel advance) so `onError` state cannot leak across
 * images. Alt text is cleared on the fallback images because they carry no
 * meaningful content.
 */
export function ListingPhoto({
  src,
  alt,
  className,
  loading = "lazy",
}: ListingPhotoProps) {
  const generated = photoPlaceholder(alt);

  const onImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    // Already showing the last resort - stop so a failing image cannot loop.
    if (img.src === generated) return;
    img.alt = "";
    img.src = img.src === PLACEHOLDER_IMAGE_URL ? generated : PLACEHOLDER_IMAGE_URL;
  };

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={loading}
      onError={onImageError}
    />
  );
}

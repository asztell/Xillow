/**
 * Deterministic, network-free placeholder image for a listing with no photos.
 *
 * Rendered as an SVG data URI so the `<img>` slot stays occupied (stable card
 * layout) and loads instantly even offline. Each placeholder is a small flat
 * illustration - gradient sky, sun, clouds and a pitched-roof house on a
 * hillside - drawn in a palette picked from a hash of the label, so every
 * property gets a stable look that is still visually distinct from its
 * neighbours.
 *
 * Cards prefer the branded remote placeholder (`PLACEHOLDER_IMAGE_URL`) and
 * only fall back to this generated SVG when that image cannot be fetched.
 */

/**
 * Branded placeholder image served from the feed's CDN. Used for listings with
 * no photos and as the first step of the fallback chain when a listing photo
 * fails to load. If this URL is ever unreachable, `photoPlaceholder` still
 * renders a generated replacement, so the card never shows a broken image.
 */
export const PLACEHOLDER_IMAGE_URL =
  "https://wp-cdn.milocloud.com/pardee-prop-wp/wp-content/uploads/2022/12/property-placeholder.png";

interface Palette {
  sky: readonly [string, string];
  ground: string;
  house: string;
  roof: string;
  door: string;
  bush: string;
  glow: string;
}

const PALETTES: readonly Palette[] = [
  {
    // Dusk terracotta
    sky: ["#f6e7d7", "#e6b088"],
    ground: "#c98d5f",
    house: "#fdf4e8",
    roof: "#9c6140",
    door: "#6f4326",
    bush: "#7d9a6d",
    glow: "#ffd97a",
  },
  {
    // Misty slate
    sky: ["#e5eef7", "#bfd4e6"],
    ground: "#9db8cc",
    house: "#fbf8f1",
    roof: "#4d5f7e",
    door: "#35404f",
    bush: "#6c8a72",
    glow: "#ffe9a3",
  },
  {
    // Spring sage
    sky: ["#edf1de", "#cfdab0"],
    ground: "#a7bb8b",
    house: "#faf5e8",
    roof: "#75865a",
    door: "#4d5a3c",
    bush: "#7d9770",
    glow: "#ffe28a",
  },
  {
    // Plum dusk
    sky: ["#f0e2ee", "#d5b6ce"],
    ground: "#b294ab",
    house: "#fdf5f7",
    roof: "#83607a",
    door: "#594459",
    bush: "#8d7f99",
    glow: "#ffe0a6",
  },
  {
    // Coastal aqua
    sky: ["#dcf0ef", "#a8cfd3"],
    ground: "#88b4ba",
    house: "#fbfcf7",
    roof: "#4e7a80",
    door: "#33585c",
    bush: "#6f9c8d",
    glow: "#ffe79a",
  },
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function houseSvg(p: Palette): string {
  const { sky, ground, house, roof, door, bush, glow } = p;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${sky[0]}"/>
          <stop offset="1" stop-color="${sky[1]}"/>
        </linearGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0.08"/>
        </linearGradient>
      </defs>

      <rect width="640" height="480" fill="url(#sky)"/>

      <!-- sun + clouds -->
      <circle cx="516" cy="112" r="46" fill="#ffffff" opacity="0.4"/>
      <g fill="#ffffff" opacity="0.55">
        <ellipse cx="150" cy="118" rx="34" ry="12"/>
        <ellipse cx="178" cy="108" rx="24" ry="10"/>
        <ellipse cx="472" cy="196" rx="26" ry="9"/>
        <ellipse cx="498" cy="190" rx="18" ry="8"/>
      </g>

      <!-- hillside -->
      <path d="M0 356 Q320 320 640 356 V480 H0 Z" fill="${ground}"/>

      <!-- house -->
      <g>
        <!-- chimney + smoke -->
        <circle cx="400" cy="112" r="7" fill="#ffffff" opacity="0.35"/>
        <circle cx="394" cy="100" r="5" fill="#ffffff" opacity="0.25"/>
        <rect x="374" y="126" width="26" height="54" fill="${roof}"/>
        <rect x="370" y="120" width="34" height="9" rx="3" fill="${door}" opacity="0.55"/>

        <!-- body -->
        <rect x="252" y="196" width="136" height="156" rx="4" fill="${house}"/>
        <rect x="252" y="196" width="136" height="10" fill="#ffffff" opacity="0.35"/>

        <!-- roof -->
        <path d="M320 116 L406 202 H234 Z" fill="${roof}"/>
        <path d="M320 116 L368 202 H296 Z" fill="#ffffff" opacity="0.18"/>
        <path d="M234 202 H406 V210 H234 Z" fill="#2b1c12" opacity="0.14"/>

        <!-- windows -->
        <g>
          <rect x="266" y="244" width="30" height="32" rx="4" fill="${glow}"/>
          <rect x="344" y="244" width="30" height="32" rx="4" fill="${glow}"/>
          <path d="M281 246 V274 M266 259 H296" stroke="#b0712c" stroke-width="3" opacity="0.5"/>
          <path d="M359 246 V274 M344 259 H374" stroke="#b0712c" stroke-width="3" opacity="0.5"/>
        </g>

        <!-- door -->
        <path d="M298 352 V288 a22 22 0 0 1 44 0 V352 Z" fill="${door}"/>
        <circle cx="334" cy="320" r="4" fill="${glow}"/>
      </g>

      <!-- bushes + walkway -->
      <circle cx="206" cy="350" r="30" fill="${bush}"/>
      <circle cx="196" cy="338" r="18" fill="${bush}"/>
      <circle cx="438" cy="342" r="26" fill="${bush}"/>
      <circle cx="202" cy="330" r="9" fill="#ffffff" opacity="0.35"/>
      <ellipse cx="320" cy="356" rx="26" ry="7" fill="#000000" opacity="0.08"/>

      <!-- grounding vignette -->
      <rect y="330" width="640" height="150" fill="url(#fade)"/>
    </svg>`.replace(/\s*\n\s*/g, " ");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function photoPlaceholder(label: string): string {
  const palette = PALETTES[hash(label) % PALETTES.length];
  return houseSvg(palette);
}
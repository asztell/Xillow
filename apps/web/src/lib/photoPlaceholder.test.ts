import { describe, expect, it } from "vitest";
import { photoPlaceholder } from "./photoPlaceholder";

describe("photoPlaceholder", () => {
  it("returns an SVG data URI", () => {
    const placeholder = photoPlaceholder("123 Main St, Springfield");
    expect(placeholder).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    // The SVG body is URL-encoded inside the data URI.
    expect(decodeURIComponent(placeholder)).toContain("<svg");
    expect(decodeURIComponent(placeholder)).toContain("<rect");
  });

  it("is deterministic for the same label", () => {
    expect(photoPlaceholder("7800 Old Keene Mill Rd, Springfield")).toBe(
      photoPlaceholder("7800 Old Keene Mill Rd, Springfield"),
    );
  });

  it("varies between distinct addresses", () => {
    const a = photoPlaceholder("123 Main St, Springfield");
    const b = photoPlaceholder("456 Oak Ave, Springfield");
    // Every palette is distinct, so two different labels must not share a
    // placeholder unless the hash collided - which 5 palettes over two
    // arbitrary labels will not.
    expect(a).not.toBe(b);
  });
});

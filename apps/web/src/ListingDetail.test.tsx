import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type {
  Listing,
  ListingDetail,
  ListingSource,
  ScoredListing,
  SearchResult,
} from "@xillow/types";
import { renderApp } from "./test/renderApp";
import { server } from "./test/server";

const LISTINGS_URL = "http://localhost/api/listings";
const DETAIL_URL = "http://localhost/api/listings/:source/:id";

const ADDRESS = "123 Main St, Apt 4B";

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "A1",
    source: "MLS_A",
    address: ADDRESS,
    city: "Springfield",
    state: "VA",
    zip: "22150",
    price: 450000,
    bedrooms: 2,
    bathrooms: 1.5,
    sqft: 980,
    latitude: 38.7893,
    longitude: -77.1873,
    listedDate: "2026-08-29T00:00:00.000Z",
    status: "active",
    description: "Bright condo near transit",
    photos: ["https://example.test/photo-1.jpg"],
    ...overrides,
  };
}

function scored(overrides: Partial<ScoredListing> = {}): ScoredListing {
  return { ...listing(), score: 0.693, ...overrides };
}

function page(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
    results: [scored()],
    ...overrides,
  };
}

/** One feed row for a property's provenance list. */
function feed(overrides: Partial<ListingSource> = {}): ListingSource {
  return {
    id: "A1",
    source: "MLS_A",
    address: ADDRESS,
    city: "Springfield",
    state: "VA",
    zip: "22150",
    price: 450000,
    listedDate: "2026-08-29T00:00:00.000Z",
    status: "active",
    isCurrent: true,
    ...overrides,
  };
}

function detail(overrides: Partial<ListingDetail> = {}): ListingDetail {
  return { ...listing(), sources: [feed()], ...overrides };
}

/** Registers a listings handler; returns the URLs it was asked for. */
function handleListings(build: () => SearchResult = () => page()): URL[] {
  const requests: URL[] = [];
  server.use(
    http.get(LISTINGS_URL, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(build());
    }),
  );
  return requests;
}

/**
 * Registers a detail handler. `build` returns the payload, or a status code to
 * simulate a failure (e.g. `404`). The requested `(source, id)` pairs are
 * recorded so tests can assert which listing was fetched.
 */
function handleDetail(
  build: (source: string, id: string) => ListingDetail | number,
): Array<{ source: string; id: string }> {
  const calls: Array<{ source: string; id: string }> = [];
  server.use(
    http.get(DETAIL_URL, ({ params }) => {
      const source = String(params.source);
      const id = String(params.id);
      calls.push({ source, id });
      const result = build(source, id);
      if (typeof result === "number") {
        return HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "Listing not found." } },
          { status: result },
        );
      }
      return HttpResponse.json(result);
    }),
  );
  return calls;
}

/** Opens the detail overlay by clicking the address on the (only) card. */
async function openFromCard() {
  await screen.findByRole("article");
  await userEvent.click(screen.getByRole("button", { name: ADDRESS }));
  return screen.findByRole("dialog", { name: new RegExp(ADDRESS) });
}

describe("listing detail overlay", () => {
  it("opens from a card, shows the listing and its provenance, and keeps the grid mounted", async () => {
    handleListings();
    handleDetail(() =>
      detail({
        sources: [
          feed({ source: "MLS_C", id: "C8", price: 448000, isCurrent: true }),
          feed({ source: "MLS_A", id: "A1", price: 450000, isCurrent: false }),
          feed({ source: "MLS_B", id: "B7", price: 452000, isCurrent: false }),
        ],
      }),
    );

    renderApp();
    const dialog = await openFromCard();

    expect(within(dialog).getByText(ADDRESS)).toBeInTheDocument();
    expect(
      within(dialog).getByText("$450,000", { selector: ".detail-price" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/appears on 3 feeds/i)).toBeInTheDocument();
    expect(within(dialog).getByText("Current listing")).toBeInTheDocument();

    // The overlay is a layer: the results behind it never unmount.
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("opens from anywhere on the card, not just the address", async () => {
    handleListings();
    handleDetail(() => detail());

    renderApp();
    const card = await screen.findByRole("article");
    await userEvent.click(card);

    expect(
      await screen.findByRole("dialog", { name: new RegExp(ADDRESS) }),
    ).toBeInTheDocument();
  });

  it("does not open the overlay from the carousel chevrons", async () => {
    handleListings(() =>
      page({
        results: [
          scored({
            photos: [
              "https://example.test/1.jpg",
              "https://example.test/2.jpg",
              "https://example.test/3.jpg",
            ],
          }),
        ],
      }),
    );
    const calls = handleDetail(() => detail());

    renderApp();
    await screen.findByRole("article");

    await userEvent.click(screen.getByRole("button", { name: /next photo/i }));

    // The carousel advanced...
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    // ...without asking for the detail or opening the overlay.
    expect(calls).toHaveLength(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deep-links straight to the overlay and closes on Escape", async () => {
    handleListings();
    handleDetail(() => detail());

    renderApp({ initialEntries: ["/?listingSource=MLS_A&listingId=A1"] });
    const dialog = await screen.findByRole("dialog", { name: new RegExp(ADDRESS) });

    // `cancel` is the event a native <dialog> fires on Escape.
    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("closes from the close control", async () => {
    handleListings();
    handleDetail(() => detail());

    renderApp({ initialEntries: ["/?listingSource=MLS_A&listingId=A1"] });
    const dialog = await screen.findByRole("dialog", { name: new RegExp(ADDRESS) });

    await userEvent.click(
      within(dialog).getByRole("button", { name: /close listing details/i }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("shows a single-source note for a listing with no duplicates", async () => {
    handleListings();
    handleDetail(() => detail());

    renderApp();
    const dialog = await openFromCard();

    expect(within(dialog).getByText(/listed on MLS_A/i)).toBeInTheDocument();
    expect(within(dialog).queryByText("Current listing")).not.toBeInTheDocument();
  });

  it("points an older sibling at the newer listing and can switch to it", async () => {
    handleListings();
    const calls = handleDetail((source, id) =>
      detail({
        id,
        source,
        sources: [
          feed({ source: "MLS_C", id: "C8", price: 448000, isCurrent: true }),
          feed({ source: "MLS_A", id: "A1", price: 450000, isCurrent: false }),
        ],
      }),
    );

    renderApp({ initialEntries: ["/?listingSource=MLS_A&listingId=A1"] });
    const dialog = await screen.findByRole("dialog", { name: new RegExp(ADDRESS) });

    expect(within(dialog).getByText(/newer listing/i)).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: /view the current listing/i }),
    );

    await waitFor(() =>
      expect(calls).toContainEqual({ source: "MLS_C", id: "C8" }),
    );
  });

  it("shows a not-found error inside the overlay", async () => {
    handleListings();
    handleDetail(() => 404);

    renderApp({ initialEntries: ["/?listingSource=MLS_A&listingId=NOPE"] });
    const dialog = await screen.findByRole("dialog", { name: /listing details/i });

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/not found/i);
  });
});

describe("detail photo gallery", () => {
  const photos = [
    "https://example.test/1.jpg",
    "https://example.test/2.jpg",
    "https://example.test/3.jpg",
  ];

  it("shows a mosaic and opens a full-screen lightbox with prev/next and a counter", async () => {
    handleListings();
    handleDetail(() => detail({ photos }));

    renderApp();
    const dialog = await openFromCard();

    expect(
      within(dialog).getByRole("button", { name: /see all 3 photos/i }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: /see all 3 photos/i }),
    );

    const lightbox = await screen.findByRole("dialog", { name: "1 of 3" });
    await userEvent.click(
      within(lightbox).getByRole("button", { name: /next photo/i }),
    );
    expect(within(lightbox).getByText("2 of 3")).toBeInTheDocument();

    // Arrow keys are wired globally while the lightbox is open.
    await userEvent.keyboard("{ArrowLeft}");
    expect(within(lightbox).getByText("1 of 3")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowLeft}");
    expect(within(lightbox).getByText("3 of 3")).toBeInTheDocument();
  });

  it("closes only the lightbox, leaving the detail overlay open", async () => {
    handleListings();
    handleDetail(() => detail({ photos }));

    renderApp();
    const dialog = await openFromCard();

    await userEvent.click(
      within(dialog).getByRole("button", { name: /see all 3 photos/i }),
    );

    const lightbox = await screen.findByRole("dialog", { name: "1 of 3" });
    await userEvent.click(
      within(lightbox).getByRole("button", { name: /close photo gallery/i }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /of 3/ })).not.toBeInTheDocument(),
    );
    // The detail overlay is still there.
    expect(
      screen.getByRole("dialog", { name: new RegExp(ADDRESS) }),
    ).toBeInTheDocument();
  });

  it("renders a stable placeholder when a listing has no photos", async () => {
    handleListings();
    handleDetail(() => detail({ photos: [] }));

    renderApp();
    const dialog = await openFromCard();

    expect(
      within(dialog).getByRole("img", { name: /photo placeholder for/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /see all/i }),
    ).not.toBeInTheDocument();
  });
});

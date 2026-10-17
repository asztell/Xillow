import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ScoredListing, SearchResult } from "@xillow/types";
import { renderApp } from "./test/renderApp";
import { server } from "./test/server";
import { PLACEHOLDER_IMAGE_URL } from "./lib/photoPlaceholder";

const LISTINGS_URL = "http://localhost/api/listings";

function listing(overrides: Partial<ScoredListing> = {}): ScoredListing {
  return {
    id: "A1",
    source: "MLS_A",
    address: "123 Main St, Apt 4B",
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
    score: 0.693,
    ...overrides,
  };
}

function page(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
    results: [listing()],
    ...overrides,
  };
}

/** Registers a listings handler and records the request URLs it receives. */
function handleListings(build: (page: number) => SearchResult): URL[] {
  const requests: URL[] = [];
  server.use(
    http.get(LISTINGS_URL, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const requestedPage = Number(url.searchParams.get("page") ?? "1");
      return HttpResponse.json(build(requestedPage));
    }),
  );
  return requests;
}

describe("App", () => {
  it("shows a loading state, then renders the required result fields on cards", async () => {
    handleListings(() => page());
    renderApp();

    expect(screen.getByText(/loading listings/i)).toBeInTheDocument();

    const card = await screen.findByRole("article");
    expect(within(card).getByText("123 Main St, Apt 4B")).toBeInTheDocument();
    expect(within(card).getByText("$450,000")).toBeInTheDocument();
    expect(within(card).getByText("2")).toBeInTheDocument(); // bedrooms
    expect(within(card).getByText("Springfield, VA 22150")).toBeInTheDocument();
  });

  it("renders one card per result with no duplicate bookkeeping", async () => {
    handleListings(() =>
      page({
        total: 2,
        results: [listing({ id: "A1" }), listing({ id: "A2", address: "456 Oak Ave" })],
      }),
    );
    renderApp();

    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(2);
    // The API returns one row per property; the card shows no duplicate hint.
    expect(screen.queryByText(/possible duplicate/i)).not.toBeInTheDocument();
  });

  it("toggles the theme between light and dark", async () => {
    handleListings(() => page());
    renderApp();

    const toDark = await screen.findByRole("button", {
      name: /switch to dark mode/i,
    });
    await userEvent.click(toDark);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    const toLight = screen.getByRole("button", { name: /switch to light mode/i });
    await userEvent.click(toLight);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("shows a no-results message when nothing matches", async () => {
    handleListings(() => page({ total: 0, totalPages: 0, results: [] }));
    renderApp();

    expect(await screen.findByText(/no listings match your search/i)).toBeInTheDocument();
  });

  it("surfaces a server validation error and recovers on retry", async () => {
    let calls = 0;
    server.use(
      http.get(LISTINGS_URL, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            {
              error: {
                code: "INVALID_QUERY",
                message: "minPrice must be less than or equal to maxPrice",
                field: "minPrice",
              },
            },
            { status: 400 },
          );
        }
        return HttpResponse.json(page());
      }),
    );

    renderApp();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/minPrice/i);
    expect(alert).toHaveTextContent(/less than or equal/i);

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("123 Main St, Apt 4B")).toBeInTheDocument();
  });

  it("moves between pages and disables the controls at the boundaries", async () => {
    const requests = handleListings((requestedPage) =>
      requestedPage === 2
        ? page({
            page: 2,
            total: 3,
            totalPages: 2,
            hasNext: false,
            hasPrev: true,
            results: [listing({ id: "A3", address: "789 Pine Rd", score: 0.42 })],
          })
        : page({
            page: 1,
            total: 3,
            totalPages: 2,
            hasNext: true,
            hasPrev: false,
          }),
    );

    renderApp();
    expect(await screen.findByText("123 Main St, Apt 4B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByText("789 Pine Rd")).toBeInTheDocument();
    expect(requests.at(-1)?.searchParams.get("page")).toBe("2");
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /previous/i })).toBeEnabled();
  });

  it("applies filters from the form and resets to page 1", async () => {
    const requests = handleListings((requestedPage) => page({ page: requestedPage }));
    renderApp();
    await screen.findByText("123 Main St, Apt 4B");

    await userEvent.type(screen.getByLabelText(/^city$/i), "Fairfax");
    await userEvent.click(screen.getByRole("button", { name: /^apply filters$/i }));

    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.get("city")).toBe("Fairfax"),
    );
    expect(requests.at(-1)?.searchParams.get("page")).toBe("1");
  });

  it("blocks submission and shows a field error when minPrice exceeds maxPrice", async () => {
    const requests = handleListings(() => page());
    renderApp();
    await screen.findByText("123 Main St, Apt 4B");
    const requestsBefore = requests.length;

    await userEvent.type(screen.getByLabelText(/min price/i), "600000");
    await userEvent.type(screen.getByLabelText(/max price/i), "400000");
    await userEvent.click(screen.getByRole("button", { name: /^apply filters$/i }));

    expect(await screen.findByText(/less than or equal/i)).toBeInTheDocument();
    expect(requests).toHaveLength(requestsBefore);
  });

  it("collapses and expands the filter panel, remembering the choice", async () => {
    handleListings(() => page());
    renderApp();
    await screen.findByText("123 Main St, Apt 4B");

    const toggle = screen.getByRole("button", { name: /^filters$/i });
    const fields = document.getElementById("filter-fields");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(fields).not.toBeNull();
    expect(fields).toBeVisible();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("filter-fields")).not.toBeVisible();
    // The submit action stays available while the panel is collapsed.
    expect(
      screen.getByRole("button", { name: /^apply filters$/i }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("xillow-filters-open")).toBe("closed");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("filter-fields")).toBeVisible();
    expect(window.localStorage.getItem("xillow-filters-open")).toBe("open");
  });

  it("defaults the filter panel to collapsed on narrow screens", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    handleListings(() => page());
    renderApp();
    await screen.findByText("123 Main St, Apt 4B");

    const toggle = screen.getByRole("button", { name: /^filters$/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("filter-fields")).not.toBeVisible();
    // A viewport default is not an explicit choice, so nothing is persisted.
    expect(window.localStorage.getItem("xillow-filters-open")).toBeNull();
  });

  it("disables Apply Filters and Reset until a filter is present", async () => {
    handleListings(() => page());
    renderApp();
    await screen.findByText("123 Main St, Apt 4B");

    const apply = screen.getByRole("button", { name: /^apply filters$/i });
    const reset = screen.getByRole("button", { name: /^reset all filters$/i });
    expect(apply).toBeDisabled();
    expect(reset).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/^city$/i), "Fairfax");
    expect(apply).toBeEnabled();
    expect(reset).toBeEnabled();

    await userEvent.clear(screen.getByLabelText(/^city$/i));
    expect(apply).toBeDisabled();
    expect(reset).toBeDisabled();
  });

  it("resets every filter (but keeps results per page) from the bottom action", async () => {
    const requests = handleListings((requestedPage) => page({ page: requestedPage }));
    renderApp({
      initialEntries: ["/?city=Fairfax&minBedrooms=2&page=1&pageSize=25"],
    });
    await screen.findByText("123 Main St, Apt 4B");

    await userEvent.click(
      screen.getByRole("button", { name: /^reset all filters$/i }),
    );

    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.get("city")).toBeNull(),
    );
    const last = requests.at(-1)!.searchParams;
    expect(last.get("minBedrooms")).toBeNull();
    expect(last.get("page")).toBe("1");
    expect(last.get("pageSize")).toBe("25");
    expect(screen.getByLabelText(/^city$/i)).toHaveValue("");
  });

  it("keeps Apply Filters enabled when the URL has filters, so they can be cleared", async () => {
    handleListings(() => page());
    renderApp({ initialEntries: ["/?city=Fairfax&page=1"] });
    await screen.findByText("123 Main St, Apt 4B");

    const apply = screen.getByRole("button", { name: /^apply filters$/i });
    expect(apply).toBeEnabled();

    await userEvent.clear(screen.getByLabelText(/^city$/i));
    expect(apply).toBeEnabled();
  });

  it("enables Apply Filters when only the results per page is changed, and applies it", async () => {
    const requests = handleListings(() => page());
    renderApp();
    await screen.findByText("123 Main St, Apt 4B");

    const apply = screen.getByRole("button", { name: /^apply filters$/i });
    // "Results per page" is a display setting, not a filter, so with no other
    // facet in play the active-filter count stays 0 and only the draft change
    // can enable this.
    expect(apply).toBeDisabled();

    const perPage = screen.getByLabelText(/^results per page$/i);
    await userEvent.clear(perPage);
    await userEvent.type(perPage, "25");
    expect(apply).toBeEnabled();

    await userEvent.click(apply);

    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.get("pageSize")).toBe("25"),
    );
    const last = requests.at(-1)!.searchParams;
    expect(last.get("page")).toBe("1");
    expect(last.get("city")).toBeNull();
    // The draft now matches what was applied, so there is nothing left to apply.
    expect(apply).toBeDisabled();
  });

  it("badges the toggle with the number of active filters", async () => {
    handleListings((requestedPage) => page({ page: requestedPage }));
    renderApp({ initialEntries: ["/?city=Fairfax&minBedrooms=2&page=1"] });
    await screen.findByText("123 Main St, Apt 4B");

    expect(
      screen.getByRole("button", { name: /filters, 2 active/i }),
    ).toBeInTheDocument();
  });

  it("defaults the sort dropdown to Recommended", async () => {
    handleListings(() => page());
    renderApp();
    await screen.findByText("123 Main St, Apt 4B");

    expect(screen.getByRole("combobox", { name: /sort results/i })).toHaveValue(
      "recommended",
    );
  });

  it("applies a new sort, updating the URL and resetting to page 1", async () => {
    const requests = handleListings((requestedPage) => page({ page: requestedPage }));
    renderApp({ initialEntries: ["/?page=2"] });
    await screen.findByText("123 Main St, Apt 4B");

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /sort results/i }),
      "price_asc",
    );

    await waitFor(() =>
      expect(requests.at(-1)?.searchParams.get("sort")).toBe("price_asc"),
    );
    expect(requests.at(-1)?.searchParams.get("page")).toBe("1");
  });

  it("re-orders the cards when a price sort is chosen", async () => {
    const fixtures = [
      listing({ id: "A1", address: "123 Main St, Apt 4B", price: 450000 }),
      listing({ id: "A2", address: "456 Oak Ave", price: 525000 }),
      listing({ id: "A3", address: "789 Pine Rd", price: 399000 }),
    ];
    server.use(
      http.get(LISTINGS_URL, ({ request }) => {
        const url = new URL(request.url);
        const sort = url.searchParams.get("sort");
        const sorted = [...fixtures].sort((a, b) =>
          sort === "price_asc" ? a.price - b.price : b.price - a.price,
        );
        return HttpResponse.json(
          page({ total: fixtures.length, totalPages: 1, results: sorted }),
        );
      }),
    );
    renderApp();
    await screen.findByText("123 Main St, Apt 4B");

    const addresses = () =>
      screen
        .getAllByRole("article")
        .map((card) => within(card).getByRole("heading").textContent);

    // The stub serves "recommended" as price high to low.
    expect(addresses()).toEqual([
      "456 Oak Ave",
      "123 Main St, Apt 4B",
      "789 Pine Rd",
    ]);

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /sort results/i }),
      "price_asc",
    );

    await waitFor(() =>
      expect(addresses()).toEqual([
        "789 Pine Rd",
        "123 Main St, Apt 4B",
        "456 Oak Ave",
      ]),
    );
  });

  it("carousels through multiple photos with prev/next controls", async () => {
    handleListings(() =>
      page({
        results: [
          listing({
            photos: [
              "https://picsum.photos/seed/xillow-A1/640/480",
              "https://picsum.photos/seed/xillow-A2/640/480",
              "https://picsum.photos/seed/xillow-A3/640/480",
            ],
          }),
        ],
      }),
    );
    renderApp();

    const first = await screen.findByAltText(/photo 1 of 3/i);
    expect(first).toHaveAttribute(
      "src",
      "https://picsum.photos/seed/xillow-A1/640/480",
    );

    await userEvent.click(screen.getByRole("button", { name: /next photo/i }));
    expect(screen.getByAltText(/photo 2 of 3/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /previous photo/i }));
    expect(screen.getByAltText(/photo 1 of 3/i)).toBeInTheDocument();

    // Wraps around from the last photo back to the first.
    const next = screen.getByRole("button", { name: /next photo/i });
    await userEvent.click(next);
    await userEvent.click(next);
    await userEvent.click(next);
    expect(screen.getByAltText(/photo 1 of 3/i)).toBeInTheDocument();
  });

  it("shows a placeholder when a listing has no photos", async () => {
    handleListings(() => page()); // listing() carries no photos field
    renderApp();

    const placeholder = await screen.findByRole("img", {
      name: /photo placeholder for 123 Main St, Apt 4B, Springfield/i,
    });
    expect(placeholder).toBeInTheDocument();
    // The no-photo slot starts on the branded placeholder image.
    expect(placeholder.querySelector("img")).toHaveAttribute(
      "src",
      PLACEHOLDER_IMAGE_URL,
    );
    expect(
      screen.queryByRole("button", { name: /next photo/i }),
    ).not.toBeInTheDocument();
  });

  it("walks the fallback chain when photos fail to load", async () => {
    handleListings(() =>
      page({
        results: [listing({ photos: ["https://example.com/broken.jpg"] })],
      }),
    );
    renderApp();

    const img = await screen.findByAltText(/123 Main St, Apt 4B, Springfield/i);
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", PLACEHOLDER_IMAGE_URL);
    fireEvent.error(img);
    expect(img).toHaveAttribute("src", expect.stringContaining("data:image/svg+xml"));
  });
});

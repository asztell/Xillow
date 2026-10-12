import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ScoredListing, SearchResult } from "@xillow/types";
import { renderApp } from "./test/renderApp";
import { server } from "./test/server";

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
  it("shows a loading state, then renders the required result fields", async () => {
    handleListings(() => page());
    renderApp();

    expect(screen.getByText(/loading listings/i)).toBeInTheDocument();

    const row = await screen.findByRole("row", { name: /123 Main St, Apt 4B/i });
    expect(within(row).getByText("$450,000")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument(); // bedrooms
    expect(within(row).getByText("0.693")).toBeInTheDocument(); // relevance score
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
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));

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
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));

    expect(await screen.findByText(/less than or equal/i)).toBeInTheDocument();
    expect(requests).toHaveLength(requestsBefore);
  });
});

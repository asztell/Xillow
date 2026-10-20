import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "../routes";

interface RenderAppOptions {
  /** Initial history entries for the memory router (default `["/"]`). */
  initialEntries?: string[];
}

/** Renders the real route tree inside a fresh QueryClient and a memory router. */
export function renderApp({ initialEntries = ["/"] }: RenderAppOptions = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createMemoryRouter(routes, { initialEntries });

  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

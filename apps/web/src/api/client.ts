import type { SearchResult } from "@xillow/types";
import { toSearchParams, type ListingsQuery } from "../lib/query";

/** Empty by default: in dev the browser calls same-origin `/api` via the Vite proxy. */
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/** Error carrying the API's structured error shape (`code`/`message`/`field`). */
export class ListingApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly field?: string;

  constructor(
    message: string,
    options: { code: string; status?: number; field?: string },
  ) {
    super(message);
    this.name = "ListingApiError";
    this.code = options.code;
    this.status = options.status;
    this.field = options.field;
  }
}

/** Builds the request URL, omitting empty filters. */
export function buildListingsUrl(query: ListingsQuery, base: string = API_BASE): string {
  const qs = toSearchParams(query).toString();
  return `${base}/api/listings${qs ? `?${qs}` : ""}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validates the payload the UI relies on. TypeScript types are erased at
 * runtime, so a server/version mismatch would otherwise surface as a confusing
 * crash deep inside a component; this turns it into one clear error at the
 * trust boundary. Only the discriminants the UI depends on are checked - being
 * stricter would reject additive server changes for no benefit.
 */
function parseSearchResult(payload: unknown): SearchResult {
  const results = isRecord(payload) ? payload.results : undefined;
  const shapeOk =
    isRecord(payload) &&
    Array.isArray(results) &&
    results.every(
      (row) =>
        isRecord(row) &&
        typeof row.id === "string" &&
        typeof row.source === "string" &&
        typeof row.price === "number",
    ) &&
    Number.isInteger(payload.page) &&
    Number.isInteger(payload.pageSize) &&
    Number.isInteger(payload.total) &&
    Number.isInteger(payload.totalPages) &&
    typeof payload.hasNext === "boolean" &&
    typeof payload.hasPrev === "boolean";

  if (!shapeOk) {
    throw new ListingApiError(
      "The listings service returned an unexpected response.",
      { code: "INVALID_RESPONSE" },
    );
  }

  return payload as unknown as SearchResult;
}

/**
 * Fetches a page of ranked listings.
 *
 * Maps both transport failures and non-2xx responses onto `ListingApiError` so
 * the UI can render a single, predictable error state.
 */
export async function fetchListings(
  query: ListingsQuery,
  signal?: AbortSignal,
  base: string = API_BASE,
): Promise<SearchResult> {
  let response: Response;
  try {
    response = await fetch(buildListingsUrl(query, base), {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ListingApiError(
      "Could not reach the listings service. Is the API running?",
      { code: "NETWORK_ERROR" },
    );
  }

  if (!response.ok) {
    let code = "HTTP_ERROR";
    let message = `The request failed (HTTP ${response.status}).`;
    let field: string | undefined;

    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string; field?: string };
      };
      if (body.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
        field = body.error.field;
      }
    } catch {
      // Non-JSON error body - keep the generic message.
    }

    throw new ListingApiError(message, { code, status: response.status, field });
  }

  return parseSearchResult(await response.json());
}

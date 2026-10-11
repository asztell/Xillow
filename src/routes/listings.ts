import { Router, Request, Response } from "express";
import { ApiError } from "../types";
import { ListingRepository } from "../repositories/listingRepository";
import { parseSearchParams } from "../lib/validation";
import { searchListings } from "../lib/search";

/**
 * `GET /listings` - search and rank listings.
 *
 * Query params: minPrice, maxPrice, minBedrooms, city, keyword, targetBudget,
 * page, pageSize.
 */
export function createListingsRouter(repo: ListingRepository): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    const parsed = parseSearchParams(req.query as Record<string, unknown>);

    if (!parsed.ok) {
      const body: ApiError = {
        error: {
          code: parsed.code,
          message: parsed.message,
          ...(parsed.field ? { field: parsed.field } : {}),
        },
      };
      res.status(400).json(body);
      return;
    }

    try {
      const result = await searchListings(repo, parsed.params);
      res.json(result);
    } catch (err) {
      console.error("GET /listings failed:", err);
      const body: ApiError = {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to search listings right now.",
        },
      };
      res.status(500).json(body);
    }
  });

  return router;
}

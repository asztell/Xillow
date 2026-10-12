import express, { Express } from "express";
import { ListingRepository } from "./repositories/listingRepository";
import { createListingsRouter } from "./routes/listings";

/**
 * Builds the Express application. Takes the repository as a dependency so the
 * app can be constructed with a fake repository in tests.
 */
export function createApp(repo: ListingRepository): Express {
  const app = express();

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/listings", createListingsRouter(repo));

  return app;
}

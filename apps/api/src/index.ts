import "./env";
import { createApp } from "./app";
import { createDb, createPool } from "./db";
import { KyselyListingRepository } from "./repositories/listingRepository";

const port = Number(process.env.PORT ?? 3000);

const pool = createPool();
const db = createDb(pool);
const repo = new KyselyListingRepository(db);
const app = createApp(repo);

const server = app.listen(port, () => {
  console.log(`Xillow API listening on http://localhost:${port}`);
});

// Close the database connection cleanly on shutdown.
const shutdown = (signal: string): void => {
  console.log(`\n${signal} received, shutting down.`);
  server.close(() => {
    void db
      .destroy()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

import { config } from "dotenv";
import { resolve } from "node:path";

/**
 * Loads the repo-root `.env` for local development.
 *
 * From `apps/api/{src,dist}` the repo root is three levels up. In Docker the
 * configuration is supplied via environment variables, so a missing file here
 * is harmless.
 */
config({ path: resolve(__dirname, "../../../.env"), quiet: true });

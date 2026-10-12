import { setupServer } from "msw/node";

/**
 * MSW server shared by the UI tests. Handlers are registered per-test with
 * `server.use(...)`; unhandled requests fail the test so tests stay explicit
 * about the network they expect.
 */
export const server = setupServer();

import type { RouteObject } from "react-router";
import App from "./App";

/**
 * Route table. A single view today, but the router is in place so a listing
 * detail route (e.g. `/listings/:id`) can be added without restructuring.
 */
export const routes: RouteObject[] = [{ path: "/", element: <App /> }];

import { ConvexClient } from "convex/browser";

const url =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_CONVEX_URL
    ? String(import.meta.env.VITE_CONVEX_URL).trim()
    : "";

export const convexClient = url ? new ConvexClient(url) : null;

export function isConvexReady(): boolean {
  return Boolean(url && convexClient);
}

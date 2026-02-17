import { ConvexClient } from "convex/browser";

function getConvexUrl(): string {
  if (typeof import.meta === "undefined" || !import.meta.env) return "";
  const envUrl = import.meta.env.VITE_CONVEX_URL;
  if (!envUrl) return "";
  const url = String(envUrl).trim();
  return url || "";
}

let convexClient: ConvexClient | null = null;

function getClient(): ConvexClient | null {
  if (convexClient) return convexClient;
  const url = getConvexUrl();
  if (!url) return null;
  try {
    convexClient = new ConvexClient(url);
    return convexClient;
  } catch (error) {
    console.error("❌ [CONVEX] Erreur lors de la création du client:", error);
    return null;
  }
}

export function isConvexReady(): boolean {
  const url = getConvexUrl();
  if (!url) return false;
  const client = getClient();
  return Boolean(client);
}

export function getConvexClient(): ConvexClient | null {
  return getClient();
}

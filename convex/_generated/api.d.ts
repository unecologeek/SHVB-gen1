import type { FunctionReference } from "convex/server";

export const api: {
  teams: {
    list: FunctionReference<"query", "public">;
    create: FunctionReference<"mutation", "public">;
    update: FunctionReference<"mutation", "public">;
    remove: FunctionReference<"mutation", "public">;
    setLocal: FunctionReference<"mutation", "public">;
  };
  settings: {
    get: FunctionReference<"query", "public">;
    update: FunctionReference<"mutation", "public">;
  };
};

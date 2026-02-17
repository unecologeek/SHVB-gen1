import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

const SETTINGS_FIELDS = [
  "title",
  "subtitle",
  "victory_photo_focus_x",
  "victory_photo_focus_y",
  "main_color",
  "visual_type",
  "category",
  "match_date",
  "location",
] as const;

export const get = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db.query("settings").first();
    return doc ?? null;
  },
});

export const update = mutation({
  args: {
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    victory_photo_focus_x: v.optional(v.union(v.number(), v.null())),
    victory_photo_focus_y: v.optional(v.union(v.number(), v.null())),
    main_color: v.optional(v.string()),
    visual_type: v.optional(v.string()),
    category: v.optional(v.string()),
    match_date: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("settings").first();
    const patch: Record<string, string | number | null> = {};
    for (const key of SETTINGS_FIELDS) {
      if (args[key] !== undefined) {
        patch[key] = args[key] as string | number | null;
      }
    }
    if (Object.keys(patch).length === 0 && existing) return existing._id;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    await ctx.db.insert("settings", patch as Record<string, unknown>);
    return null;
  },
});

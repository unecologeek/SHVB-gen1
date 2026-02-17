import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

export type BackgroundImageType = "results" | "preview" | "victory";

export const get = query({
  args: {
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("background_images")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .first();
    return doc?.image_data ?? null;
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("background_images").collect();
    const result: Record<string, string> = {};
    for (const doc of docs) {
      result[doc.type] = doc.image_data;
    }
    return result;
  },
});

export const set = mutation({
  args: {
    type: v.string(),
    image_data: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("background_images")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, { image_data: args.image_data });
      return existing._id;
    } else {
      const id = await ctx.db.insert("background_images", {
        type: args.type,
        image_data: args.image_data,
      });
      return id;
    }
  },
});

import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

const query = queryGeneric;
const mutation = mutationGeneric;

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teams").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    logo: v.string(),
    is_local: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("teams", {
      name: args.name,
      logo: args.logo,
      is_local: args.is_local ?? false,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("teams"),
    name: v.optional(v.string()),
    logo: v.optional(v.string()),
    is_local: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.logo !== undefined) patch.logo = updates.logo;
    if (updates.is_local !== undefined) patch.is_local = updates.is_local;
    if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
    return await ctx.db.get("teams", id);
  },
});

export const remove = mutation({
  args: { id: v.id("teams") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const setLocal = mutation({
  args: { id: v.id("teams") },
  handler: async (ctx, args) => {
    const teams = await ctx.db.query("teams").collect();
    for (const team of teams) {
      await ctx.db.patch(team._id, { is_local: team._id === args.id });
    }
  },
});

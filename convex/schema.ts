import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  teams: defineTable({
    name: v.string(),
    logo: v.string(),
    is_local: v.boolean(),
  }),
  settings: defineTable({
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    results_bg: v.optional(v.string()),
    preview_bg: v.optional(v.string()),
    victory_bg: v.optional(v.string()),
    main_color: v.optional(v.string()),
    visual_type: v.optional(v.string()),
    category: v.optional(v.string()),
    match_date: v.optional(v.string()),
    location: v.optional(v.string()),
  }),
});

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
    victory_photo_focus_x: v.optional(v.number()),
    victory_photo_focus_y: v.optional(v.number()),
    main_color: v.optional(v.string()),
    visual_type: v.optional(v.string()),
    category: v.optional(v.string()),
    match_date: v.optional(v.string()),
    location: v.optional(v.string()),
  }),
  background_images: defineTable({
    type: v.string(), // 'results', 'preview', 'victory'
    image_data: v.string(), // base64 encoded image
  }).index("by_type", ["type"]),
});

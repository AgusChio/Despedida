import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    isBride: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  photos: defineTable({
    itinerarySlug: v.union(
      v.literal("tarde"),
      v.literal("escapada"),
      v.literal("cafe"),
    ),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    uploadedBy: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    driveFileId: v.optional(v.string()),
    driveLink: v.optional(v.string()),
    driveStatus: v.union(
      v.literal("pendiente"),
      v.literal("en_drive"),
      v.literal("sin_carpeta"),
      v.literal("error"),
    ),
    driveError: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_itinerary", ["itinerarySlug"]),
  rsvps: defineTable({
    userId: v.id("users"),
    itinerarySlug: v.union(
      v.literal("tarde"),
      v.literal("escapada"),
      v.literal("cafe"),
    ),
    going: v.boolean(),
  })
    .index("by_itinerary", ["itinerarySlug"])
    .index("by_user_itinerary", ["userId", "itinerarySlug"]),
  reveal: defineTable({
    key: v.string(),
    scheduled: v.boolean(),
    at: v.optional(v.number()),
  }).index("by_key", ["key"]),
});

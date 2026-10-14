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
    storageId: v.optional(v.id("_storage")),
    fileName: v.string(),
    contentType: v.string(),
    uploadedBy: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    driveFileId: v.optional(v.string()),
    driveLink: v.optional(v.string()),
    r2Key: v.optional(v.string()),
    driveStatus: v.union(
      v.literal("pendiente"),
      v.literal("en_drive"),
      v.literal("sin_carpeta"),
      v.literal("error"),
    ),
    driveError: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_itinerary", ["itinerarySlug"]),
  examAnswers: defineTable({
    userId: v.id("users"),
    answers: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
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
  flags: defineTable({
    key: v.string(),
    on: v.boolean(),
  }).index("by_key", ["key"]),
  pushSubs: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),
  uploadNotes: defineTable({
    userId: v.id("users"),
    itinerarySlug: v.union(v.literal("tarde"), v.literal("escapada"), v.literal("cafe")),
    name: v.string(),
    photos: v.number(),
    videos: v.number(),
    token: v.string(),
  }).index("by_user_moment", ["userId", "itinerarySlug"]),
});

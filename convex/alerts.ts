import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { currentUser } from "./helpers";

const moment = v.union(v.literal("tarde"), v.literal("escapada"), v.literal("cafe"));

const momentName = {
  tarde: "Tarde de chicas",
  escapada: "Escapada",
  cafe: "Cafecito",
} as const;

function uploadText(name: string, photos: number, videos: number, slug: keyof typeof momentName) {
  const parts: string[] = [];
  if (photos === 1) parts.push("una foto");
  else if (photos > 1) parts.push(`${photos} fotos`);
  if (videos === 1) parts.push("un video");
  else if (videos > 1) parts.push(`${videos} videos`);
  return `${name} subió ${parts.join(" y ") || "algo"} en ${momentName[slug]}.`;
}

export const publicKey = query({
  args: {},
  handler: async () => {
    const value = process.env.VAPID_PUBLIC_KEY?.trim();
    return value ? value : null;
  },
});

export const save = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user?.hasName) throw new Error("Primero confirmá tu nombre y apellido.");
    if (!args.endpoint || !args.p256dh || !args.auth) throw new Error("No se pudo activar el aviso.");
    const existing = await ctx.db
      .query("pushSubs")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: user.id,
        p256dh: args.p256dh,
        auth: args.auth,
      });
      return;
    }
    await ctx.db.insert("pushSubs", {
      userId: user.id,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
    });
  },
});

export const remove = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) return;
    const existing = await ctx.db
      .query("pushSubs")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing?.userId === user.id) await ctx.db.delete(existing._id);
  },
});

export const targets = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("pushSubs").collect();
    return rows
      .filter((row) => row.userId !== args.userId)
      .map((row) => ({
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      }));
  },
});

export const drop = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubs")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const bump = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    itinerarySlug: moment,
    video: v.boolean(),
  },
  handler: async (ctx, args) => {
    const token = `${Date.now()}-${args.video ? "v" : "f"}`;
    const existing = await ctx.db
      .query("uploadNotes")
      .withIndex("by_user_moment", (q) =>
        q.eq("userId", args.userId).eq("itinerarySlug", args.itinerarySlug),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        photos: existing.photos + (args.video ? 0 : 1),
        videos: existing.videos + (args.video ? 1 : 0),
        token,
      });
    } else {
      await ctx.db.insert("uploadNotes", {
        userId: args.userId,
        itinerarySlug: args.itinerarySlug,
        name: args.name,
        photos: args.video ? 0 : 1,
        videos: args.video ? 1 : 0,
        token,
      });
    }
    await ctx.scheduler.runAfter(15000, internal.push.flush, {
      userId: args.userId,
      itinerarySlug: args.itinerarySlug,
      token,
    });
  },
});

export const takeUpload = internalMutation({
  args: {
    userId: v.id("users"),
    itinerarySlug: moment,
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{ body: string; hash: string } | null> => {
    const note = await ctx.db
      .query("uploadNotes")
      .withIndex("by_user_moment", (q) =>
        q.eq("userId", args.userId).eq("itinerarySlug", args.itinerarySlug),
      )
      .unique();
    if (!note || note.token !== args.token) return null;
    await ctx.db.delete(note._id);
    return {
      body: uploadText(note.name, note.photos, note.videos, note.itinerarySlug),
      hash: note.itinerarySlug,
    };
  },
});

export function rsvpText(name: string, going: boolean, slug: keyof typeof momentName) {
  return going
    ? `${name} viene a ${momentName[slug]}.`
    : `${name} no viene a ${momentName[slug]}.`;
}

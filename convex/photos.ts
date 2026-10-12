import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { UPLOAD_OPEN_LABEL, currentUser, uploadsOpen } from "./helpers";

const slug = v.union(
  v.literal("tarde"),
  v.literal("escapada"),
  v.literal("cafe"),
);

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export const connection = query({
  args: {},
  handler: async () => {
    const folders = {
      tarde: envValue("DRIVE_FOLDER_TARDE"),
      escapada: envValue("DRIVE_FOLDER_ESCAPADA"),
      cafe: envValue("DRIVE_FOLDER_CAFE"),
    };
    const connected = Boolean(
      envValue("GOOGLE_CLIENT_ID") &&
        envValue("GOOGLE_CLIENT_SECRET") &&
        envValue("GOOGLE_REFRESH_TOKEN") &&
        folders.tarde &&
        folders.escapada &&
        folders.cafe,
    );
    return {
      connected,
      links: {
        tarde: envValue("DRIVE_LINK_TARDE"),
        escapada: envValue("DRIVE_LINK_ESCAPADA"),
        cafe: envValue("DRIVE_LINK_CAFE"),
      },
    };
  },
});

export const list = query({
  args: { itinerarySlug: slug },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user?.hasName) return [];
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_itinerary", (q) =>
        q.eq("itinerarySlug", args.itinerarySlug),
      )
      .order("desc")
      .collect();

    return Promise.all(
      photos.map(async (photo) => ({
        _id: photo._id,
        fileName: photo.fileName,
        uploadedBy: photo.uploadedBy ?? null,
        driveStatus: photo.driveStatus,
        createdAt: photo.createdAt,
        canRemove: user.isAdmin,
        url: photo.storageId
          ? await ctx.storage.getUrl(photo.storageId)
          : driveView(photo._id, photo.driveFileId),
      })),
    );
  },
});

export const getInternal = internalQuery({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.photoId);
  },
});

type Moment = "tarde" | "escapada" | "cafe";

async function flagOn(ctx: QueryCtx | MutationCtx, key: string) {
  const row = await ctx.db
    .query("flags")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return row?.on === true;
}

async function lockedMoments(ctx: QueryCtx | MutationCtx) {
  const global = await flagOn(ctx, "uploads");
  return {
    tarde: global || (await flagOn(ctx, "uploads:tarde")),
    escapada: global || (await flagOn(ctx, "uploads:escapada")),
    cafe: global || (await flagOn(ctx, "uploads:cafe")),
  };
}

async function setFlag(ctx: MutationCtx, key: string, on: boolean) {
  const row = await ctx.db
    .query("flags")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (row) {
    if (row.on !== on) await ctx.db.patch(row._id, { on });
    return;
  }
  if (on) await ctx.db.insert("flags", { key, on: true });
}

function canUpload(
  isAdmin: boolean,
  moment: "tarde" | "escapada" | "cafe",
  locked: boolean,
  now = Date.now(),
) {
  if (locked) return false;
  return uploadsOpen(moment, now) || (isAdmin && moment === "tarde");
}

export const windows = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    const now = Date.now();
    const locked = await lockedMoments(ctx);
    const windowFor = (moment: Moment) => ({
      open: canUpload(user?.isAdmin === true, moment, locked[moment], now),
      openForGuests: !locked[moment] && uploadsOpen(moment, now),
      locked: locked[moment],
      from: UPLOAD_OPEN_LABEL[moment],
    });
    return {
      tarde: windowFor("tarde"),
      escapada: windowFor("escapada"),
      cafe: windowFor("cafe"),
    };
  },
});

function driveView(photoId: string, driveFileId: string | undefined) {
  if (!driveFileId) return null;
  const site = process.env.CONVEX_SITE_URL?.replace(/\/$/, "");
  if (!site) return null;
  return `${site}/foto?id=${encodeURIComponent(photoId)}`;
}

export const gate = internalQuery({
  args: { itinerarySlug: slug },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user?.hasName) throw new Error("Primero poné tu nombre y apellido.");
    const locked = (await lockedMoments(ctx))[args.itinerarySlug];
    if (locked) throw new Error("La organizadora cerró la subida de fotos.");
    if (!canUpload(user.isAdmin, args.itinerarySlug, locked)) {
      throw new Error(
        `Las fotos se abren ${UPLOAD_OPEN_LABEL[args.itinerarySlug]}.`,
      );
    }
    return { userId: user.id, displayName: user.displayName };
  },
});

export const record = internalMutation({
  args: {
    itinerarySlug: slug,
    fileName: v.string(),
    contentType: v.string(),
    driveFileId: v.string(),
    driveLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user?.hasName) throw new Error("Tenés que entrar.");
    const original =
      args.fileName.replace(/[/\\]/g, "").replace(/\s+/g, " ").slice(0, 80) ||
      "foto.jpg";
    const fileName = `${user.displayName} - ${original}`.slice(0, 180);
    return await ctx.db.insert("photos", {
      itinerarySlug: args.itinerarySlug,
      fileName,
      contentType: args.contentType.startsWith("image/")
        ? args.contentType
        : "image/jpeg",
      uploadedBy: user.displayName,
      userId: user.id,
      driveFileId: args.driveFileId,
      ...(args.driveLink ? { driveLink: args.driveLink } : {}),
      driveStatus: "en_drive",
      createdAt: Date.now(),
    });
  },
});

export const withStorage = internalQuery({
  args: {},
  handler: async (ctx) => {
    const photos = await ctx.db.query("photos").collect();
    return photos
      .filter((photo) => photo.storageId)
      .map((photo) => ({
        _id: photo._id,
        storageId: photo.storageId!,
        driveFileId: photo.driveFileId ?? null,
        fileName: photo.fileName,
        contentType: photo.contentType,
        itinerarySlug: photo.itinerarySlug,
      }));
  },
});

export const forgetStorage = internalMutation({
  args: {
    photoId: v.id("photos"),
    driveFileId: v.optional(v.string()),
    driveLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const photo = await ctx.db.get(args.photoId);
    if (!photo?.storageId) return;
    const driveFileId = args.driveFileId ?? photo.driveFileId;
    if (!driveFileId) throw new Error("La foto todavía no está en Drive.");
    await ctx.storage.delete(photo.storageId);
    await ctx.db.replace(args.photoId, {
      itinerarySlug: photo.itinerarySlug,
      fileName: photo.fileName,
      contentType: photo.contentType,
      ...(photo.uploadedBy ? { uploadedBy: photo.uploadedBy } : {}),
      ...(photo.userId ? { userId: photo.userId } : {}),
      driveFileId,
      ...(args.driveLink || photo.driveLink
        ? { driveLink: args.driveLink ?? photo.driveLink }
        : {}),
      driveStatus: "en_drive",
      createdAt: photo.createdAt,
    });
  },
});

export const setUploads = mutation({
  args: { open: v.boolean(), itinerarySlug: v.optional(slug) },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user?.isAdmin) throw new Error("Solo la organizadora puede cerrar los álbumes.");
    const current = await lockedMoments(ctx);
    const targets: Moment[] = args.itinerarySlug
      ? [args.itinerarySlug]
      : ["tarde", "escapada", "cafe"];
    for (const moment of ["tarde", "escapada", "cafe"] as const) {
      const lock = targets.includes(moment) ? !args.open : current[moment];
      await setFlag(ctx, `uploads:${moment}`, lock);
    }
    await setFlag(ctx, "uploads", false);
  },
});

export const remove = mutation({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user?.hasName) throw new Error("Tenés que entrar.");
    const photo = await ctx.db.get(args.photoId);
    if (!photo) return;
    if (!user.isAdmin) {
      throw new Error("Solo la organizadora puede quitar fotos.");
    }
    if (photo.storageId) await ctx.storage.delete(photo.storageId);
    await ctx.db.delete(args.photoId);
    if (photo.driveFileId) {
      await ctx.scheduler.runAfter(0, internal.drive.removeFromDrive, {
        driveFileId: photo.driveFileId,
      });
    }
  },
});

export const setDriveResult = internalMutation({
  args: {
    photoId: v.id("photos"),
    driveStatus: v.union(
      v.literal("en_drive"),
      v.literal("sin_carpeta"),
      v.literal("error"),
    ),
    driveFileId: v.optional(v.string()),
    driveLink: v.optional(v.string()),
    driveError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const photo = await ctx.db.get(args.photoId);
    if (!photo) return;
    const patch: {
      driveStatus: "en_drive" | "sin_carpeta" | "error";
      driveFileId?: string;
      driveLink?: string;
      driveError?: string;
    } = { driveStatus: args.driveStatus };
    if (args.driveFileId) patch.driveFileId = args.driveFileId;
    if (args.driveLink) patch.driveLink = args.driveLink;
    if (args.driveError) patch.driveError = args.driveError.slice(0, 500);
    await ctx.db.patch(args.photoId, patch);
  },
});

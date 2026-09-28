import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
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
        canRemove: user.isAdmin || photo.userId === user.id,
        url: await ctx.storage.getUrl(photo.storageId),
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

export const windows = query({
  args: {},
  handler: async () => {
    const now = Date.now();
    return {
      tarde: {
        open: uploadsOpen("tarde", now),
        from: UPLOAD_OPEN_LABEL.tarde,
      },
      escapada: {
        open: uploadsOpen("escapada", now),
        from: UPLOAD_OPEN_LABEL.escapada,
      },
      cafe: {
        open: uploadsOpen("cafe", now),
        from: UPLOAD_OPEN_LABEL.cafe,
      },
    };
  },
});

export const generateUploadUrl = mutation({
  args: { itinerarySlug: slug },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user?.hasName) throw new Error("Primero poné tu nombre y apellido.");
    if (!uploadsOpen(args.itinerarySlug)) {
      throw new Error(
        `Las fotos se abren ${UPLOAD_OPEN_LABEL[args.itinerarySlug]}.`,
      );
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const savePhoto = mutation({
  args: {
    itinerarySlug: slug,
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user?.hasName) throw new Error("Primero poné tu nombre y apellido.");
    if (!uploadsOpen(args.itinerarySlug)) {
      throw new Error(
        `Las fotos se abren ${UPLOAD_OPEN_LABEL[args.itinerarySlug]}.`,
      );
    }
    const original =
      args.fileName.replace(/[/\\]/g, "").replace(/\s+/g, " ").slice(0, 80) ||
      "foto.jpg";
    const fileName = `${user.displayName} - ${original}`.slice(0, 180);
    const photoId = await ctx.db.insert("photos", {
      itinerarySlug: args.itinerarySlug,
      storageId: args.storageId,
      fileName,
      contentType: args.contentType || "image/jpeg",
      uploadedBy: user.displayName,
      userId: user.id,
      driveStatus: "pendiente",
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.drive.mirrorToDrive, { photoId });
    return photoId;
  },
});

export const remove = mutation({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user?.hasName) throw new Error("Tenés que entrar.");
    const photo = await ctx.db.get(args.photoId);
    if (!photo) return;
    if (!user.isAdmin && photo.userId !== user.id) {
      throw new Error("Solo podés quitar tus fotos.");
    }
    await ctx.storage.delete(photo.storageId);
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

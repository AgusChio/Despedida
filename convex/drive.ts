"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { accessToken } from "./google";

const FOLDER_ENV = {
  tarde: "DRIVE_FOLDER_TARDE",
  escapada: "DRIVE_FOLDER_ESCAPADA",
  cafe: "DRIVE_FOLDER_CAFE",
} as const;

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function concatBytes(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function uploadToDrive(options: {
  token: string;
  folderId: string;
  fileName: string;
  mime: string;
  bytes: Uint8Array;
}) {
  const boundary = `caro_${Date.now()}`;
  const metadata = JSON.stringify({
    name: options.fileName,
    parents: [options.folderId],
  });
  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${options.mime}\r\n\r\n`,
  );
  const ending = encoder.encode(`\r\n--${boundary}--`);
  const body = concatBytes([preamble, options.bytes, ending]);
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail.slice(0, 300) || "Drive rechazó la foto.");
  }
  return (await response.json()) as { id: string; webViewLink?: string };
}

export const mirrorToDrive = internalAction({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    const photo = await ctx.runQuery(internal.photos.getInternal, {
      photoId: args.photoId,
    });
    if (!photo) return;

    const folderId = envValue(FOLDER_ENV[photo.itinerarySlug]);
    const hasGoogle = Boolean(
      envValue("GOOGLE_CLIENT_ID") &&
        envValue("GOOGLE_CLIENT_SECRET") &&
        envValue("GOOGLE_REFRESH_TOKEN"),
    );
    if (!hasGoogle || !folderId) {
      await ctx.runMutation(internal.photos.setDriveResult, {
        photoId: args.photoId,
        driveStatus: "sin_carpeta",
      });
      return;
    }

    try {
      if (!photo.storageId) return;
      const blob = await ctx.storage.get(photo.storageId);
      if (!blob) throw new Error("La foto no está en el álbum.");
      const token = await accessToken();
      if (!token) {
        await ctx.runMutation(internal.photos.setDriveResult, {
          photoId: args.photoId,
          driveStatus: "sin_carpeta",
        });
        return;
      }
      const uploaded = await uploadToDrive({
        token,
        folderId,
        fileName: photo.fileName,
        mime: photo.contentType || "image/jpeg",
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });
      await ctx.runMutation(internal.photos.setDriveResult, {
        photoId: args.photoId,
        driveStatus: "en_drive",
        driveFileId: uploaded.id,
        ...(uploaded.webViewLink ? { driveLink: uploaded.webViewLink } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de Drive";
      await ctx.runMutation(internal.photos.setDriveResult, {
        photoId: args.photoId,
        driveStatus: "error",
        driveError: message,
      });
    }
  },
});

const moment = v.union(
  v.literal("tarde"),
  v.literal("escapada"),
  v.literal("cafe"),
);

export const publish = action({
  args: {
    itinerarySlug: moment,
    fileName: v.string(),
    contentType: v.string(),
    bytes: v.bytes(),
  },
  handler: async (ctx, args) => {
    const bytes = new Uint8Array(args.bytes);
    if (bytes.byteLength > 8_000_000) {
      throw new Error("La foto es muy pesada. Probá con otra.");
    }
    if (bytes.byteLength < 32) throw new Error("La foto llegó vacía.");
    await ctx.runQuery(internal.photos.gate, {
      itinerarySlug: args.itinerarySlug,
    });
    const folderId = envValue(FOLDER_ENV[args.itinerarySlug]);
    const token = await accessToken();
    if (!token || !folderId) throw new Error("Drive no está conectado.");
    const uploaded = await uploadToDrive({
      token,
      folderId,
      fileName: args.fileName.slice(0, 80) || "foto.jpg",
      mime: args.contentType.startsWith("image/") ? args.contentType : "image/jpeg",
      bytes,
    });
    const shared = await shareForView(token, uploaded.id);
    if (shared !== "ok") {
      throw new Error("Drive no dejó mostrar la foto en el álbum.");
    }
    await ctx.runMutation(internal.photos.record, {
      itinerarySlug: args.itinerarySlug,
      fileName: args.fileName,
      contentType: args.contentType,
      driveFileId: uploaded.id,
      ...(uploaded.webViewLink ? { driveLink: uploaded.webViewLink } : {}),
    });
  },
});

export const drainStorage = internalAction({
  args: {},
  handler: async (ctx): Promise<{ seen: number; freed: number; failed: number }> => {
    const photos: Array<{
      _id: Id<"photos">;
      storageId: Id<"_storage">;
      driveFileId: string | null;
      fileName: string;
      contentType: string;
      itinerarySlug: "tarde" | "escapada" | "cafe";
    }> = await ctx.runQuery(internal.photos.withStorage, {});
    let freed = 0;
    let failed = 0;
    for (const photo of photos) {
      try {
        let driveFileId = photo.driveFileId ?? undefined;
        let driveLink: string | undefined;
        if (!driveFileId) {
          const folderId = envValue(FOLDER_ENV[photo.itinerarySlug]);
          const token = await accessToken();
          if (!token || !folderId) throw new Error("Drive no está conectado.");
          const blob = await ctx.storage.get(photo.storageId);
          if (!blob) throw new Error("La copia vieja ya no está.");
          const uploaded = await uploadToDrive({
            token,
            folderId,
            fileName: photo.fileName,
            mime: photo.contentType || "image/jpeg",
            bytes: new Uint8Array(await blob.arrayBuffer()),
          });
          driveFileId = uploaded.id;
          driveLink = uploaded.webViewLink;
        }
        await ctx.runMutation(internal.photos.forgetStorage, {
          photoId: photo._id,
          driveFileId,
          ...(driveLink ? { driveLink } : {}),
        });
        freed += 1;
      } catch {
        failed += 1;
      }
    }
    return { seen: photos.length, freed, failed };
  },
});

async function shareForView(token: string, fileId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );
  if (response.ok) return "ok";
  const detail = await response.text();
  if (/already exists/i.test(detail)) return "ok";
  return detail.slice(0, 160);
}

export const shareAlbum = internalAction({
  args: {},
  handler: async (ctx): Promise<{ seen: number; shared: number; failed: number }> => {
    const ids = await ctx.runQuery(internal.photos.driveFileIds, {});
    const token = await accessToken();
    if (!token) return { seen: ids.length, shared: 0, failed: ids.length };
    let shared = 0;
    let failed = 0;
    for (const fileId of ids) {
      const result = await shareForView(token, fileId);
      if (result === "ok") shared += 1;
      else failed += 1;
    }
    return { seen: ids.length, shared, failed };
  },
});

export const removeFromDrive = internalAction({
  args: { driveFileId: v.string() },
  handler: async (_ctx, args) => {
    const token = await accessToken();
    if (!token) return;
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(args.driveFileId)}?supportsAllDrives=true`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  },
});

"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const FOLDER_ENV = {
  tarde: "DRIVE_FOLDER_TARDE",
  escapada: "DRIVE_FOLDER_ESCAPADA",
  cafe: "DRIVE_FOLDER_CAFE",
} as const;

let cachedToken: { token: string; exp: number } | null = null;

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

async function accessToken() {
  const clientId = envValue("GOOGLE_CLIENT_ID");
  const clientSecret = envValue("GOOGLE_CLIENT_SECRET");
  const refreshToken = envValue("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Google no renovó el acceso. Volvé a conectar Drive. ${detail.slice(0, 180)}`,
    );
  }
  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };
  cachedToken = {
    token: data.access_token,
    exp: now + (data.expires_in ?? 3600),
  };
  return data.access_token;
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

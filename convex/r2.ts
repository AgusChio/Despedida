"use node";

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v } from "convex/values";
import { randomUUID } from "node:crypto";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function r2Ready() {
  return Boolean(
    envValue("R2_ACCOUNT_ID") &&
      envValue("R2_ACCESS_KEY_ID") &&
      envValue("R2_SECRET_ACCESS_KEY") &&
      envValue("R2_BUCKET") &&
      envValue("R2_PUBLIC_URL"),
  );
}

function client() {
  const accountId = envValue("R2_ACCOUNT_ID");
  const accessKeyId = envValue("R2_ACCESS_KEY_ID");
  const secretAccessKey = envValue("R2_SECRET_ACCESS_KEY");
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

function extension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

export async function putPhoto(options: {
  slug: string;
  bytes: Uint8Array;
  contentType: string;
}) {
  const bucket = envValue("R2_BUCKET");
  const s3 = client();
  if (!bucket || !s3) throw new Error("R2 no está conectado.");
  const key = `${options.slug}/${randomUUID()}.${extension(options.contentType)}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: options.bytes,
      ContentType: options.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return key;
}

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const moment = v.union(v.literal("tarde"), v.literal("escapada"), v.literal("cafe"));

function videoKind(contentType: string, fileName: string) {
  const type = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (type === "video/mp4" || type === "video/m4v") return { mime: "video/mp4", ext: "mp4" };
  if (type === "video/quicktime") return { mime: "video/quicktime", ext: "mov" };
  if (type === "video/webm") return { mime: "video/webm", ext: "webm" };
  if (type === "video/3gpp") return { mime: "video/3gpp", ext: "3gp" };
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === "mp4" || ext === "m4v") return { mime: "video/mp4", ext: "mp4" };
  if (ext === "mov") return { mime: "video/quicktime", ext: "mov" };
  if (ext === "webm") return { mime: "video/webm", ext: "webm" };
  if (ext === "3gp") return { mime: "video/3gpp", ext: "3gp" };
  return null;
}

function videoKeyOk(slug: string, key: string) {
  return new RegExp(
    `^${slug}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(mp4|mov|webm|3gp)$`,
  ).test(key);
}

export const signVideo = action({
  args: {
    itinerarySlug: moment,
    fileName: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args): Promise<{ uploadUrl: string; key: string; contentType: string }> => {
    if (!r2Ready()) throw new Error("R2 no está conectado.");
    await ctx.runQuery(internal.photos.gate, { itinerarySlug: args.itinerarySlug });
    const kind = videoKind(args.contentType, args.fileName);
    if (!kind) throw new Error("Ese video no se puede subir.");
    const bucket = envValue("R2_BUCKET");
    const s3 = client();
    if (!bucket || !s3) throw new Error("R2 no está conectado.");
    const key = `${args.itinerarySlug}/${randomUUID()}.${kind.ext}`;
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: kind.mime,
      }),
      { expiresIn: 60 * 20 },
    );
    return { uploadUrl, key, contentType: kind.mime };
  },
});

export const commitVideo = action({
  args: {
    itinerarySlug: moment,
    key: v.string(),
    fileName: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args): Promise<null> => {
    if (!r2Ready()) throw new Error("R2 no está conectado.");
    await ctx.runQuery(internal.photos.gate, { itinerarySlug: args.itinerarySlug });
    const kind = videoKind(args.contentType, args.fileName);
    if (!kind || !videoKeyOk(args.itinerarySlug, args.key)) {
      throw new Error("El video no se guardó.");
    }
    const taken: boolean = await ctx.runQuery(internal.photos.r2KeyTaken, { key: args.key });
    if (taken) throw new Error("Ese video ya está en el álbum.");
    const bucket = envValue("R2_BUCKET");
    const s3 = client();
    if (!bucket || !s3) throw new Error("R2 no está conectado.");
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: args.key }));
    const size = head.ContentLength ?? 0;
    if (size < 32) throw new Error("El video llegó vacío.");
    if (size > MAX_VIDEO_BYTES) throw new Error("El video es muy pesado. Probá con uno más corto.");
    await ctx.runMutation(internal.photos.record, {
      itinerarySlug: args.itinerarySlug,
      fileName: args.fileName,
      contentType: kind.mime,
      r2Key: args.key,
    });
    return null;
  },
});

export const removeObject = internalAction({
  args: { key: v.string() },
  handler: async (_ctx, args) => {
    const bucket = envValue("R2_BUCKET");
    const s3 = client();
    if (!bucket || !s3) return;
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: args.key }));
  },
});

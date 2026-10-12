"use node";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v } from "convex/values";
import { randomUUID } from "node:crypto";
import { internalAction } from "./_generated/server";

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

export const removeObject = internalAction({
  args: { key: v.string() },
  handler: async (_ctx, args) => {
    const bucket = envValue("R2_BUCKET");
    const s3 = client();
    if (!bucket || !s3) return;
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: args.key }));
  },
});

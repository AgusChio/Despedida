import { spawnSync } from "node:child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function convex(args) {
  const result = spawnSync(process.execPath, ["node_modules/convex/bin/main.js", ...args], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error("convex");
  }
  return (result.stdout || "").trim();
}

function env(name) {
  return convex(["env", "get", name, "--prod"]);
}

function extension(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "image/heic" || contentType === "image/heif") return "heic";
  return "jpg";
}

const accountId = env("R2_ACCOUNT_ID");
const accessKeyId = env("R2_ACCESS_KEY_ID");
const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
const bucket = env("R2_BUCKET");
const clientId = env("GOOGLE_CLIENT_ID");
const clientSecret = env("GOOGLE_CLIENT_SECRET");
const refreshToken = env("GOOGLE_REFRESH_TOKEN");

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }),
});
if (!tokenResponse.ok) {
  console.log(JSON.stringify({ ok: false, step: "google" }));
  process.exit(1);
}
const token = (await tokenResponse.json()).access_token;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const publicUrl = env("R2_PUBLIC_URL").replace(/\/$/, "");
const photos = JSON.parse(convex(["run", "photos:pendingR2", "--prod"]));
let copied = 0;
let linked = 0;
let failed = 0;

for (const photo of photos) {
  try {
    const type = photo.contentType?.startsWith("image/") ? photo.contentType : "image/jpeg";
    const key = `${photo.itinerarySlug}/${photo.id}.${extension(type)}`;
    const view = `${publicUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
    const existing = await fetch(view, { method: "GET" });
    await existing.body?.cancel();
    if (!existing.ok) {
      const media = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(photo.driveFileId)}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!media.ok) throw new Error("drive");
      const bytes = Buffer.from(await media.arrayBuffer());
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: type,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      copied += 1;
    } else {
      linked += 1;
    }
    convex([
      "run",
      "photos:attachR2",
      "--prod",
      JSON.stringify({ photoId: photo.id, r2Key: key }),
    ]);
  } catch {
    failed += 1;
  }
}

console.log(JSON.stringify({ seen: photos.length, copied, linked, failed }));

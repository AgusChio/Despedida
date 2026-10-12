import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { accessToken } from "./google";

export const foto = httpAction(async (ctx, request) => {
  const photoId = new URL(request.url).searchParams.get("id");
  if (!photoId) return new Response("No está.", { status: 404 });

  let driveFileId: string | null = null;
  let contentType = "image/jpeg";
  try {
    const photo = await ctx.runQuery(internal.photos.getInternal, {
      photoId: photoId as Id<"photos">,
    });
    driveFileId = photo?.driveFileId ?? null;
    if (photo?.contentType?.startsWith("image/")) contentType = photo.contentType;
  } catch {
    return new Response("No está.", { status: 404 });
  }
  if (!driveFileId) return new Response("No está.", { status: 404 });

  const token = await accessToken();
  if (!token) return new Response("Drive no está conectado.", { status: 503 });

  const media = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!media.ok) return new Response("Drive no entregó la foto.", { status: 502 });

  return new Response(await media.arrayBuffer(), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

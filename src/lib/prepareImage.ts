const MAX_EDGE = 2400;
const MAX_BYTES = 1_800_000;

export async function prepareImage(file: File): Promise<File> {
  if (file.type === "image/gif") return file;
  const looksLikeImage =
    file.type.startsWith("image/") ||
    /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name);
  if (!looksLikeImage) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const largest = Math.max(bitmap.width, bitmap.height);
    const needsScale = largest > MAX_EDGE;
    const needsCompress = file.size > MAX_BYTES;
    if (!needsScale && !needsCompress && file.type === "image/jpeg") {
      bitmap.close();
      return file;
    }

    const scale = needsScale ? MAX_EDGE / largest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.86);
    });
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

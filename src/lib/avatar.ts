export const AVATAR_PIXEL_SIZE = 128;
export const AVATAR_MAX_URL_BYTES = 200;
export const AVATAR_RECENT_LIMIT = 3;
export const AVATAR_TAG_NAME = "+diirc/avatar";

export function isValidAvatarUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const url = value.trim();
  if (url.length < 12 || url.length > AVATAR_MAX_URL_BYTES) return false;
  if (/[\s\x00-\x1f;]/.test(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image."));
      el.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not resize avatar.");
    ctx.drawImage(image, 0, 0);
    return createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function resizeAvatarFile(
  file: File,
  size = AVATAR_PIXEL_SIZE
): Promise<File> {
  const bitmap = await loadImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not resize avatar.");
    const min = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - min) / 2;
    const sy = (bitmap.height - min) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, min, min, 0, 0, size, size);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) => (next ? resolve(next) : reject(new Error("Could not encode avatar."))),
        "image/jpeg",
        0.85
      );
    });
    return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export async function resizeAvatarDataUrl(
  dataUrl: string,
  size = AVATAR_PIXEL_SIZE
): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const file = new File([blob], "avatar.bin", { type: blob.type || "image/jpeg" });
  const resized = await resizeAvatarFile(file, size);
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not encode cached avatar."));
    reader.readAsDataURL(resized);
  });
}

export function serverSupportsMetadata(caps: string[] | undefined): boolean {
  if (!caps || caps.length === 0) return false;
  return caps.some((cap) => {
    const name = cap.split("=")[0].toLowerCase();
    return name === "draft/metadata-2" || name === "draft/metadata" || name === "metadata";
  });
}

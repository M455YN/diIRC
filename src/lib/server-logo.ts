export const DEFAULT_SERVER_IMAGE =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80";

/**
 * Reads a local image and returns it as a square PNG data URL. Downscaling keeps the
 * persisted server list small, and a data URL survives restarts (blob URLs do not).
 */
export const readServerLogo = async (file: File, size = 256): Promise<string> => {
  if (!file.type.startsWith("image/")) throw new Error("serverLogo.notImage");

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("serverLogo.readFailed"));
      el.src = url;
    });

    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("serverLogo.noCanvas");
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
};

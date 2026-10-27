import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AvatarCrop } from "@/lib/avatars";

const VIEW = 256;
const MAX_ZOOM = 4;

/** Drag to move and slide to zoom a square window over the image; confirms with the crop in source pixels. */
export const AvatarCropper = ({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (crop: AvatarCrop) => void;
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    createImageBitmap(file)
      .then((b) => {
        if (cancelled) return b.close();
        setBitmap(b);
        setCenter({ x: b.width / 2, y: b.height / 2 });
      })
      .catch(onCancel);
    return () => {
      cancelled = true;
    };
  }, [file, onCancel]);

  const side = bitmap ? Math.min(bitmap.width, bitmap.height) / zoom : 0;
  const clamp = (x: number, y: number) =>
    bitmap
      ? { x: Math.min(Math.max(x, side / 2), bitmap.width - side / 2), y: Math.min(Math.max(y, side / 2), bitmap.height - side / 2) }
      : { x, y };
  const at = clamp(center.x, center.y); // re-clamped as the zoom changes

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context || !bitmap) return;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, VIEW, VIEW);
    context.drawImage(bitmap, at.x - side / 2, at.y - side / 2, side, side, 0, 0, VIEW, VIEW);
  }, [bitmap, at.x, at.y, side]);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{t("server.avatar.crop")}</DialogTitle>
        </DialogHeader>
        <canvas
          ref={canvasRef}
          width={VIEW}
          height={VIEW}
          className="mx-auto cursor-move touch-none rounded-md bg-muted"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            if (!drag.current || !side) return;
            const k = side / VIEW; // source pixels per screen pixel
            const next = clamp(at.x - (e.clientX - drag.current.x) * k, at.y - (e.clientY - drag.current.y) * k);
            drag.current = { x: e.clientX, y: e.clientY };
            setCenter(next);
          }}
          onPointerUp={() => (drag.current = null)}
        />
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          aria-label={t("server.avatar.zoom")}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("server.avatar.cancel")}
          </Button>
          <Button type="button" disabled={!bitmap} onClick={() => onConfirm({ x: at.x - side / 2, y: at.y - side / 2, side })}>
            {t("server.avatar.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

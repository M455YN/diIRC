import { useRef, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_WIDTH = 76;
const THRESHOLD = 48;

interface SwipeableRowProps {
  children: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}

/**
 * iOS-style swipeable list row.
 * Swipe right → Edit, swipe left → Delete.
 */
export const SwipeableRow = ({
  children,
  onEdit,
  onDelete,
  className,
}: SwipeableRowProps) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const axis = useRef<"undecided" | "h" | "v">("undecided");
  const dragging = useRef(false);

  const clamp = (value: number) =>
    Math.max(-ACTION_WIDTH, Math.min(ACTION_WIDTH, value));

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragging.current = true;
    axis.current = "undecided";
    startX.current = e.clientX;
    startY.current = e.clientY;
    startOffset.current = offset;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (axis.current === "undecided") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (axis.current === "v") {
        dragging.current = false;
        return;
      }
    }

    if (axis.current !== "h") return;
    e.preventDefault();
    setOffset(clamp(startOffset.current + dx));
  };

  const settle = () => {
    dragging.current = false;
    setOffset((current) => {
      if (current > THRESHOLD) return ACTION_WIDTH;
      if (current < -THRESHOLD) return -ACTION_WIDTH;
      return 0;
    });
  };

  const onPointerUp = () => settle();
  const onPointerCancel = () => {
    dragging.current = false;
    setOffset(0);
  };

  const close = () => setOffset(0);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      {/* Behind actions */}
      <div className="absolute inset-0 flex">
        <button
          type="button"
          onClick={() => {
            close();
            onEdit();
          }}
          className="flex h-full w-[76px] flex-col items-center justify-center gap-0.5 bg-blue-500 text-white"
          aria-label="Edit"
        >
          <Pencil className="h-4 w-4" />
          <span className="text-[11px] font-medium">Edit</span>
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            close();
            onDelete();
          }}
          className="flex h-full w-[76px] flex-col items-center justify-center gap-0.5 bg-rose-500 text-white"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-[11px] font-medium">Delete</span>
        </button>
      </div>

      <div
        className="relative touch-pan-y bg-background transition-transform duration-150 ease-out will-change-transform"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {children}
      </div>
    </div>
  );
};

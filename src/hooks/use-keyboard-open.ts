import { useEffect, useState } from "react";

/**
 * Soft-keyboard heuristic. Avoids treating Android system bars / edge-to-edge
 * viewport insets as a keyboard (that was permanently hiding the floating nav).
 */
export function useKeyboardOpen(thresholdPx = 180): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let baseline = Math.max(window.innerHeight, vv.height);

    const isTextFieldFocused = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        el.isContentEditable ||
        el.getAttribute("role") === "textbox"
      );
    };

    const update = () => {
      // Grow baseline when the viewport is large (keyboard closed / rotated)
      baseline = Math.max(baseline, vv.height, window.innerHeight * 0.92);
      const shrink = baseline - vv.height;
      setOpen(isTextFieldFocused() && shrink > thresholdPx);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("focusin", update);
    window.addEventListener("focusout", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("focusin", update);
      window.removeEventListener("focusout", update);
    };
  }, [thresholdPx]);

  return open;
}

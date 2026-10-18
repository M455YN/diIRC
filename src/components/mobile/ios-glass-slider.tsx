import { useState } from "react";
import { applyGlassScale, readGlassScale } from "@/hooks/use-mobile-platform";

/** iOS 27 "Transparency" control: ultra clear (0.2) to fully tinted (1.4); scales glass fill and blur. */
export const IosGlassSlider = ({ label, clear, tinted }: { label: string; clear: string; tinted: string }) => {
  const [v, setV] = useState(readGlassScale);
  return (
    <div className="px-4 py-3">
      <div className="mb-2 text-[17px]">{label}</div>
      <input
        type="range"
        min={0.2}
        max={1.4}
        step={0.05}
        value={v}
        onChange={(e) => {
          const n = Number(e.target.value);
          setV(n);
          applyGlassScale(n);
        }}
        className="w-full"
        aria-label={label}
      />
      <div className="mt-1 flex justify-between text-[13px] text-muted-foreground">
        <span>{clear}</span>
        <span>{tinted}</span>
      </div>
    </div>
  );
};

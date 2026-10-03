import { useEffect, useRef, useState } from "react";
import { MessageSquare, MoreHorizontal, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNativeMobileTabBar } from "@/hooks/use-mobile-platform";

export type MobileTab = "servers" | "chats" | "more";

interface MobileBottomNavProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  hidden?: boolean;
}

const tabs: { id: MobileTab; label: string; icon: typeof Server }[] = [
  { id: "servers", label: "Servers", icon: Server },
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "more", label: "More", icon: MoreHorizontal },
];

/**
 * Floating liquid-glass tab bar (React port of the liquid_glass_navbar look):
 * frosted pill, sliding bubble highlight, safe-area padding.
 *
 * Flutter package https://pub.dev/packages/liquid_glass_navbar cannot run in Tauri;
 * this mirrors its UX in the WebView. iOS 26+ may later swap to native SwiftUI
 * via `useNativeMobileTabBar()`.
 */
export const MobileBottomNav = ({ active, onChange, hidden }: MobileBottomNavProps) => {
  const useNative = useNativeMobileTabBar();
  const rowRef = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState({ left: 0, width: 0, ready: false });

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === active));

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const measure = () => {
      const btn = row.children[activeIndex] as HTMLElement | undefined;
      if (!btn) return;
      setBubble({
        left: btn.offsetLeft + 4,
        width: Math.max(0, btn.offsetWidth - 8),
        ready: true,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [activeIndex, hidden]);

  if (hidden || useNative) return null;

  return (
    <nav
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-[100]",
        "flex justify-center px-5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
      )}
      aria-label="Main"
    >
      <div
        data-mobile-nav="liquid-glass"
        className={cn(
          "pointer-events-auto relative flex items-stretch w-full max-w-md",
          "h-[65px] rounded-full px-1.5",
          "border border-white/45 dark:border-white/15",
          "shadow-[0_10px_40px_rgba(0,0,0,0.28)]",
          "bg-white/25 dark:bg-white/10",
          "backdrop-blur-[10px] backdrop-saturate-150",
          // Android WebView often weakens blur — keep a readable fallback fill
          "supports-[not(backdrop-filter)]:bg-[#f4f4f5]/92 dark:supports-[not(backdrop-filter)]:bg-[#2b2d31]/92"
        )}
      >
        {/* Sliding bubble (liquid_glass_navbar-style) */}
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 -translate-y-1/2 h-[52px] rounded-full z-0",
            "bg-white/40 dark:bg-white/20",
            "border border-white/50 dark:border-white/15",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
            "transition-[left,width] duration-300 ease-out",
            !bubble.ready && "opacity-0"
          )}
          style={{ left: bubble.left, width: bubble.width }}
        />

        <div ref={rowRef} className="relative z-10 flex flex-1 items-stretch">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-colors",
                  isActive
                    ? "text-sky-600 dark:text-sky-300"
                    : "text-zinc-700/90 dark:text-zinc-200/90"
                )}
              >
                <Icon className="w-[26px] h-[26px] stroke-[1.6]" />
                <span className="text-[11px] font-semibold leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

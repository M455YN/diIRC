import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import DnsIcon from "@mui/icons-material/Dns";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import SearchIcon from "@mui/icons-material/Search";
import MicNoneIcon from "@mui/icons-material/MicNone";
import CloseIcon from "@mui/icons-material/Close";
import { useRef, useState, type ReactNode } from "react";
import { M3Provider, useM3, useM3Mode } from "@/components/mobile/m3";
import { useMobileOs } from "@/hooks/use-mobile-platform";
import { useMockStore } from "@/lib/mock-store";

export type MobileTab = "servers" | "chats" | "more";

interface MobileBottomNavProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  hidden?: boolean;
}

/**
 * Material Design 3 Navigation Bar
 * Spec: https://m3.material.io/components/navigation-bar/specs
 *
 * - 80dp container on surface-container, no elevation shadow
 * - 64×32 active indicator pill on secondary-container behind the icon
 */
const TABS: { id: MobileTab; label: string; icon: ReactNode; activeIcon: ReactNode }[] = [
  { id: "servers", label: "nav.servers", icon: <DnsOutlinedIcon />, activeIcon: <DnsIcon /> },
  {
    id: "chats",
    label: "nav.chats",
    icon: <ChatBubbleOutlineIcon />,
    activeIcon: <ChatBubbleIcon />,
  },
  { id: "more", label: "nav.more", icon: <MoreHorizIcon />, activeIcon: <MoreHorizIcon /> },
];

const NavBar = ({ active, onChange }: Omit<MobileBottomNavProps, "hidden">) => {
  const { t: tr } = useTranslation();
  const t = useM3();
  return (
    <Box
      data-mobile-nav="m3"
      component="nav"
      aria-label={tr("nav.main")}
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        // Radix modal dialogs set `pointer-events: none` on <body>; the bar must stay tappable
        pointerEvents: "auto",
        bgcolor: t.surfaceContainer,
        pb: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Box sx={{ display: "flex", height: 80, alignItems: "stretch", px: 1 }}>
        {TABS.map((tab) => {
          const selected = active === tab.id;
          return (
            <ButtonBase
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={selected ? "page" : undefined}
              disableRipple
              sx={{
                flex: 1,
                flexDirection: "column",
                gap: 0.5,
                pt: 1.5,
                pb: 2,
                color: selected ? t.onSurface : t.onSurfaceVariant,
                fontFamily: "Roboto, system-ui, sans-serif",
                "&:active .m3-indicator::after": { opacity: 0.12 },
              }}
            >
              <Box
                className="m3-indicator"
                sx={{
                  position: "relative",
                  width: 64,
                  height: 32,
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: selected ? t.secondaryContainer : "transparent",
                  color: selected ? t.onSecondaryContainer : t.onSurfaceVariant,
                  transition: "background-color 200ms cubic-bezier(0.2, 0, 0, 1)",
                  "& .MuiSvgIcon-root": { fontSize: 24 },
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    borderRadius: "16px",
                    bgcolor: t.onSurface,
                    opacity: 0,
                    transition: "opacity 150ms",
                  },
                }}
              >
                {selected ? tab.activeIcon : tab.icon}
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: selected ? 700 : 500,
                  letterSpacing: "0.5px",
                  lineHeight: "16px",
                  userSelect: "none",
                }}
              >
                {tr(tab.label)}
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * iOS 26 Liquid Glass tab bar: a floating blurred capsule. Like the native bar, a finger can rest on it and
 * slide between tabs (the glass pill follows and swells under the finger); lifting the finger selects.
 */
const GlassTabs = ({ active, onChange }: Omit<MobileBottomNavProps, "hidden">) => {
  const { t: tr } = useTranslation();
  const mode = useM3Mode();
  const light = mode === "light";
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const activeIdx = Math.max(0, TABS.findIndex((x) => x.id === active));
  const shown = hover ?? activeIdx;
  const pressing = hover !== null;

  const indexAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const i = Math.floor(((clientX - r.left - 4) / (r.width - 8)) * TABS.length);
    return Math.min(TABS.length - 1, Math.max(0, i));
  };

  return (
    <Box
      ref={ref}
      data-mobile-nav="glass"
      className="ios-glass"
      component="nav"
      aria-label={tr("nav.main")}
      onPointerDown={(e: React.PointerEvent<HTMLElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setHover(indexAt(e.clientX));
      }}
      onPointerMove={(e: React.PointerEvent<HTMLElement>) => {
        if (hover !== null) setHover(indexAt(e.clientX));
      }}
      onPointerUp={(e: React.PointerEvent<HTMLElement>) => {
        if (hover !== null) onChange(TABS[indexAt(e.clientX)].id);
        setHover(null);
      }}
      onPointerCancel={() => setHover(null)}
      sx={{
        position: "relative",
        flex: 1,
        display: "flex",
        p: "5px",
        borderRadius: "999px",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        transform: pressing ? "scale(1.03)" : "none",
        transition: "transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        background: light
          ? "linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,255,255,0.6))"
          : "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
        backdropFilter: "blur(22px) saturate(200%) brightness(1.12)",
        WebkitBackdropFilter: "blur(22px) saturate(200%) brightness(1.12)",
        border: `0.5px solid ${light ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.28)"}`,
        boxShadow: light
          ? "0 4px 18px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.95)"
          : "0 6px 22px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.35)",
      }}
    >
      {/* sliding glass pill */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: 4,
          width: `calc((100% - 8px) / ${TABS.length})`,
          borderRadius: "999px",
          transform: `translateX(${shown * 100}%) scale(${pressing ? 1.1 : 1})`,
          transition: "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 200ms",
          bgcolor: light
            ? pressing ? "rgba(120,120,128,0.28)" : "rgba(120,120,128,0.16)"
            : pressing ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.14)",
          boxShadow: pressing ? "0 2px 10px rgba(0,0,0,0.15)" : "none",
          pointerEvents: "none",
        }}
      />
      {TABS.map((tab, i) => (
        <ButtonBase
          key={tab.id}
          onClick={(e) => {
            if (e.detail === 0) onChange(tab.id); // keyboard / assistive activation; touch is handled by the bar
          }}
          aria-current={active === tab.id ? "page" : undefined}
          disableRipple
          sx={{
            position: "relative",
            flex: 1,
            flexDirection: "column",
            gap: "2px",
            minHeight: 54,
            borderRadius: "999px",
            pointerEvents: "none",
            color: shown === i ? (light ? "#007AFF" : "#0A84FF") : light ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)",
            fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            transition: "color 200ms",
            "& .MuiSvgIcon-root": { fontSize: 26 },
          }}
        >
          {active === tab.id ? tab.activeIcon : tab.icon}
          <Box component="span" sx={{ fontSize: "0.625rem", fontWeight: 600, lineHeight: "12px" }}>
            {tr(tab.label)}
          </Box>
        </ButtonBase>
      ))}
    </Box>
  );
};

const emitSearch = (q: string) => window.dispatchEvent(new CustomEvent("ios-search", { detail: q }));

/**
 * iOS 27 bottom chrome: the tab capsule plus a separate round search button. Tapping it turns the bar into a
 * search field (search icon, text, dictation) with a round close button, like the Apple kit.
 */
const GlassNav = ({ active, onChange }: Omit<MobileBottomNavProps, "hidden">) => {
  const { t: tr } = useTranslation();
  const hasServers = useMockStore((st) => st.servers.length > 0);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const round = { width: 56, height: 56 } as const;

  const update = (v: string) => {
    setQ(v);
    emitSearch(v);
  };
  const close = () => {
    setSearching(false);
    update("");
  };
  const dictate = () => {
    const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!R) return;
    const r = new R();
    r.lang = navigator.language;
    r.onresult = (e: any) => update(e.results[0][0].transcript);
    r.start();
  };

  return (
    <Box
      data-mobile-nav="glass"
      sx={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: "calc(env(safe-area-inset-bottom, 0px) * 0.3 + 6px)",
        zIndex: 100,
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {searching && hasServers ? (
        <Box className="ios-glass" sx={{ flex: 1, height: 56, borderRadius: "999px", display: "flex", alignItems: "center", gap: 1, px: 2 }}>
          <SearchIcon sx={{ fontSize: 24, color: "text.secondary" }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => update(e.target.value)}
            placeholder={tr("mi.search")}
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontSize: 17, color: "inherit" }}
          />
          <ButtonBase onClick={dictate} aria-label="Dictate" sx={{ color: "text.secondary" }}>
            <MicNoneIcon sx={{ fontSize: 22 }} />
          </ButtonBase>
        </Box>
      ) : (
        <GlassTabs active={active} onChange={onChange} />
      )}
      {hasServers && (
      <ButtonBase
        className="ios-glass"
        aria-label={searching ? tr("common.close") : tr("mi.search")}
        onClick={() => {
          if (searching) return close();
          setSearching(true);
          if (active === "more") onChange("chats");
        }}
        style={round}
        sx={{ borderRadius: "50%", flexShrink: 0, color: "text.primary" }}
      >
        {searching ? <CloseIcon /> : <SearchIcon />}
      </ButtonBase>
      )}
    </Box>
  );
};

export const MobileBottomNav = ({ active, onChange, hidden }: MobileBottomNavProps) => {
  const os = useMobileOs();
  if (hidden) return null;
  if (os === "ios") return <GlassNav active={active} onChange={onChange} />;
  return (
    <M3Provider>
      <NavBar active={active} onChange={onChange} />
    </M3Provider>
  );
};

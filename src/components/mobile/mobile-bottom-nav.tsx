import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import DnsIcon from "@mui/icons-material/Dns";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import type { ReactNode } from "react";
import { M3Provider, useM3 } from "@/components/mobile/m3";

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
  { id: "servers", label: "Servers", icon: <DnsOutlinedIcon />, activeIcon: <DnsIcon /> },
  {
    id: "chats",
    label: "Chats",
    icon: <ChatBubbleOutlineIcon />,
    activeIcon: <ChatBubbleIcon />,
  },
  { id: "more", label: "More", icon: <MoreHorizIcon />, activeIcon: <MoreHorizIcon /> },
];

const NavBar = ({ active, onChange }: Omit<MobileBottomNavProps, "hidden">) => {
  const t = useM3();
  return (
    <Box
      data-mobile-nav="m3"
      component="nav"
      aria-label="Main"
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
                {tab.label}
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
};

export const MobileBottomNav = ({ active, onChange, hidden }: MobileBottomNavProps) => {
  if (hidden) return null;
  return (
    <M3Provider>
      <NavBar active={active} onChange={onChange} />
    </M3Provider>
  );
};

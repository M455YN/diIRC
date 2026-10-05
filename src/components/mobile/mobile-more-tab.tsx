import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import WifiIcon from "@mui/icons-material/Wifi";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { useModal } from "@/hooks/use-modal-store";
import { useChangelog } from "@/lib/changelog-service";
import { useMockStore } from "@/lib/mock-store";
import {
  M3Chip,
  M3ListGroup,
  M3ListItem,
  M3Provider,
  useM3,
} from "@/components/mobile/m3";

const MoreBody = () => {
  const t = useM3();
  const { serverId } = useParams();
  const servers = useMockStore((state) => state.servers);
  const activeServer = servers.find((s) => s.id === serverId) || servers[0];
  const { onOpen } = useModal();
  const { hasCurrentVersion } = useChangelog();
  const { irc, resourceServer, internet } = useConnectionStatus(activeServer?.id);

  const status = [
    { label: "IRC", ok: irc },
    { label: "Resources", ok: resourceServer },
    { label: "Internet", ok: internet },
  ];

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: t.surface,
        color: t.onSurface,
        fontFamily: "Roboto, system-ui, sans-serif",
        pt: "env(safe-area-inset-top, 0px)",
      }}
    >
      <Box
        component="h1"
        sx={{ m: 0, px: 2.5, pt: 4, pb: 2, fontSize: "2.25rem", fontWeight: 400, lineHeight: "44px" }}
      >
        More
      </Box>

      <Box sx={{ display: "flex", gap: 1, px: 2, pb: 2, overflowX: "auto" }}>
        {status.map((s) => (
          <M3Chip
            key={s.label}
            tone={s.ok ? "success" : "error"}
            icon={s.ok ? <CheckCircleOutlinedIcon /> : <ErrorOutlinedIcon />}
            label={s.label}
          />
        ))}
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 2, pb: 4 }}>
        <M3ListGroup>
          <M3ListItem
            leading={<SettingsOutlinedIcon />}
            headline="Settings"
            supporting="Notifications, theme, chat, and more"
            onClick={() => onOpen("settings")}
            divider
          />
          <M3ListItem
            leading={<WifiIcon />}
            headline="Connection details"
            supporting={
              activeServer
                ? `${activeServer.name} · ${irc ? "Connected" : "Disconnected"}`
                : "No server selected"
            }
            onClick={
              activeServer
                ? () =>
                    onOpen("connectionDetails", {
                      serverId: activeServer.id,
                      server: activeServer,
                    })
                : undefined
            }
            divider
          />
          <M3ListItem
            leading={<HistoryIcon />}
            headline="Changelog"
            supporting={hasCurrentVersion ? "What's new in this version" : "Release notes"}
            onClick={() => onOpen("changelog")}
          />
        </M3ListGroup>
      </Box>
    </Box>
  );
};

export const MobileMoreTab = () => (
  <M3Provider>
    <MoreBody />
  </M3Provider>
);

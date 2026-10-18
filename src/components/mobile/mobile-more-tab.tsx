import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import WifiIcon from "@mui/icons-material/Wifi";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import NoteOutlinedIcon from "@mui/icons-material/NoteOutlined";
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
  const { t: tr } = useTranslation();
  const t = useM3();
  const { serverId } = useParams();
  const servers = useMockStore((state) => state.servers);
  const activeServer = servers.find((s) => s.id === serverId) || servers[0];
  const { onOpen } = useModal();
  const { hasCurrentVersion } = useChangelog();
  const { irc, resourceServer, internet } = useConnectionStatus(activeServer?.id);

  const status = [
    { label: tr("mi.ircGroup"), ok: irc },
    { label: tr("mi.resourcesGroup"), ok: resourceServer },
    { label: tr("mi.internet"), ok: internet },
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
        {tr("mi.more2")}
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

      <Box sx={{ flex: 1, overflowY: "auto", px: 2, pb: 14 }}>
        <M3ListGroup>
          <M3ListItem
            leading={<SettingsOutlinedIcon />}
            headline={tr("mi.settings")}
            supporting={tr("mi.settingsDesc")}
            onClick={() => onOpen("settings")}
            divider
          />
          <M3ListItem
            leading={<WifiIcon />}
            headline={tr("mi.connectionDetails")}
            supporting={
              activeServer
                ? `${activeServer.name} · ${irc ? tr("mi.connected") : tr("mi.disconnected")}`
                : tr("mi.noServerSelected")
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
            leading={<NoteOutlinedIcon />}
            headline={tr("notes.title")}
            supporting={tr("notes.desc")}
            onClick={() => onOpen("notes")}
            divider
          />
          <M3ListItem
            leading={<HistoryIcon />}
            headline={tr("mi.changelog")}
            supporting={hasCurrentVersion ? tr("mi.whatsNew") : tr("mi.releaseNotes")}
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

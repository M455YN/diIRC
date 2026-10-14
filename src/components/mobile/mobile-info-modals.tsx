import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { useModal } from "@/hooks/use-modal-store";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { useMockStore } from "@/lib/mock-store";
import { useChangelog } from "@/lib/changelog-service";
import { UPDATE_CHANNELS } from "@/lib/update-service";
import { MarkdownRenderer } from "@/lib/markdown/markdown-renderer";
import { parseMarkdownContentBlocks } from "@/lib/markdown/markdown-utils";
import { LinkPreview } from "@/components/chat/link-preview";
import {
  M3Button,
  M3Card,
  M3Chip,
  M3FullScreenDialog,
  M3IconButton,
  M3ListGroup,
  M3ListItem,
  M3Subheader,
  useM3,
} from "@/components/mobile/m3";

/* ------------------------------------------------------------------ */
/* Connection details                                                  */
/* ------------------------------------------------------------------ */

const ConnectionBody = ({ serverId }: { serverId?: string }) => {
  const { t: tr } = useTranslation();
  const t = useM3();
  const servers = useMockStore((s) => s.servers);
  const uploadConfig = useMockStore((s) => s.uploadConfig);
  const connectServer = useMockStore((s) => s.connectServer);
  const disconnectServer = useMockStore((s) => s.disconnectServer);
  const server = (serverId ? servers.find((s) => s.id === serverId) : null) || servers[0];
  const { irc, ircError, resourceServer, internet } = useConnectionStatus(server?.id);
  const [busy, setBusy] = useState(false);

  const toggleConnection = async () => {
    if (!server || busy) return;
    setBusy(true);
    try {
      if (irc) await disconnectServer(server.id);
      else await connectServer(server.id);
    } catch (err) {
      console.error("Connection change failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const providerLabel =
    uploadConfig.provider === "pomf"
      ? "POMF"
      : uploadConfig.provider === "litterbox"
        ? "Litterbox"
        : tr("mi.uploadsDisabled");

  return (
    <>
      <M3Card variant="filled" sx={{ mt: 1, mb: 2 }}>
        <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ fontSize: "1.375rem", lineHeight: "28px", color: t.onSurface }}>
                {server?.name ?? tr("mi.noServer")}
              </Box>
              <Box
                sx={{
                  mt: 0.5,
                  fontSize: "0.875rem",
                  lineHeight: "20px",
                  color: t.onSurfaceVariant,
                  fontFamily: "ui-monospace, monospace",
                  wordBreak: "break-all",
                }}
              >
                {server?.host || "127.0.0.1"}:{server?.port || 6667}
              </Box>
            </Box>
            <M3Chip
              tone={irc ? "success" : "error"}
              icon={irc ? <CheckCircleOutlinedIcon /> : <ErrorOutlineIcon />}
              label={irc ? tr("mi.connected") : tr("mi.disconnected")}
            />
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <M3Chip
              icon={<LockOutlinedIcon />}
              label={server?.useTls ? "TLS" : tr("mi.noTls")}
            />
            {server?.username && <M3Chip label={`Username: ${server.username}`} />}
          </Box>
          <Box>
            {irc ? (
              <M3Button
                variant="outlined"
                danger
                icon={<LinkOffIcon />}
                onClick={toggleConnection}
                disabled={busy || !server}
              >
                Disconnect
              </M3Button>
            ) : (
              <M3Button
                variant="filled"
                icon={
                  busy ? (
                    <CircularProgress size={18} thickness={5} sx={{ color: "inherit" }} />
                  ) : (
                    <PowerSettingsNewIcon />
                  )
                }
                onClick={toggleConnection}
                disabled={busy || !server}
              >
                {busy ? tr("mi.connecting") : tr("mi.connect")}
              </M3Button>
            )}
          </Box>
        </Box>
      </M3Card>

      {!irc && ircError && (
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: "16px",
            bgcolor: t.errorContainer,
            color: t.onErrorContainer,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 500, fontSize: "0.875rem" }}>
            <ErrorOutlineIcon sx={{ fontSize: 20 }} />
            {tr("mi.connectionError")}
          </Box>
          <Box
            sx={{
              mt: 1,
              fontSize: "0.8125rem",
              lineHeight: "18px",
              fontFamily: "ui-monospace, monospace",
              wordBreak: "break-all",
            }}
          >
            {ircError}
          </Box>
        </Box>
      )}

      <M3Subheader>{tr("mi.services")}</M3Subheader>
      <M3ListGroup>
        <M3ListItem
          leading={<CloudOutlinedIcon />}
          headline={tr("mi.resourceServer")}
          supporting={providerLabel}
          trailing={
            <M3Chip
              tone={resourceServer ? "success" : "neutral"}
              label={resourceServer ? tr("mi.connected") : tr("mi.disabled")}
            />
          }
          divider
        />
        <M3ListItem
          leading={<PublicIcon />}
          headline={tr("mi.internet")}
          supporting={internet ? tr("mi.deviceOnline") : tr("mi.noNetwork")}
          trailing={
            <M3Chip tone={internet ? "success" : "error"} label={internet ? tr("mi.online") : tr("mi.offline")} />
          }
        />
      </M3ListGroup>
    </>
  );
};

export const MobileConnectionDetailsModal = () => {
  const { t: tr } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const { serverId: routeServerId } = useParams();
  const open = isOpen && type === "connectionDetails";
  const urlServerId =
    typeof window !== "undefined"
      ? window.location.pathname.match(/\/servers\/([^/]+)/)?.[1]
      : undefined;
  const serverId = data?.serverId || data?.server?.id || routeServerId || urlServerId;

  return (
    <M3FullScreenDialog
      open={open}
      title={tr("mi.connectionDetails")}
      onClose={() => onClose("connectionDetails")}
    >
      <ConnectionBody serverId={serverId} />
    </M3FullScreenDialog>
  );
};

/* ------------------------------------------------------------------ */
/* Changelog                                                           */
/* ------------------------------------------------------------------ */

const ChangelogBody = ({ open }: { open: boolean }) => {
  const { t: tr } = useTranslation();
  const t = useM3();
  const { versions, hasCurrentVersion, currentVersion, loading, error, refresh } = useChangelog();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) refresh();
    wasOpen.current = open;
  }, [open, refresh]);

  useEffect(() => {
    if (open && versions.length > 0) {
      setExpanded((prev) => (prev.size === 0 ? new Set([versions[0].version]) : prev));
    }
  }, [open, versions]);

  const current = useMemo(() => currentVersion.replace(/^v/i, "").trim(), [currentVersion]);

  const toggle = (v: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  if (loading && versions.length === 0) {
    return (
      <Box sx={{ py: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <CircularProgress sx={{ color: t.primary }} />
        <Box sx={{ color: t.onSurfaceVariant, fontSize: "0.875rem" }}>{tr("mi.loadingNotes")}</Box>
      </Box>
    );
  }

  if (error && versions.length === 0) {
    return (
      <Box sx={{ py: 8, px: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
        <WifiOffIcon sx={{ fontSize: 40, color: t.error }} />
        <Box sx={{ fontSize: "1.125rem", color: t.onSurface }}>{tr("mi.notesFailed")}</Box>
        <Box sx={{ fontSize: "0.875rem", color: t.onSurfaceVariant }}>{error}</Box>
        <M3Button variant="tonal" icon={<RefreshIcon />} onClick={() => refresh()}>
          {tr("mi.tryAgain")}
        </M3Button>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, pt: 1, pb: 2 }}>
        <M3Chip tone="primary" label={`Installed v${current}`} />
        {!hasCurrentVersion && <M3Chip label={tr("mi.notesPending")} />}
      </Box>

      {versions.length === 0 ? (
        <Box sx={{ py: 8, textAlign: "center", color: t.onSurfaceVariant }}>
          {tr("mi.noNotes")}
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {versions.map((v, index) => {
            const isOpen = expanded.has(v.version);
            const isCurrent = v.cleanVersion.toLowerCase() === current.toLowerCase();
            const isLatest = index === 0;
            return (
              <M3Card key={v.version} variant={isOpen ? "filled" : "outlined"}>
                <ButtonBase
                  onClick={() => toggle(v.version)}
                  aria-expanded={isOpen}
                  sx={{
                    width: "100%",
                    minHeight: 64,
                    px: 2,
                    py: 1.5,
                    gap: 1.5,
                    justifyContent: "flex-start",
                    textAlign: "left",
                    color: t.onSurface,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Box sx={{ fontSize: "1rem", fontWeight: 500, fontFamily: "ui-monospace, monospace" }}>
                      {v.version}
                    </Box>
                    {v.channel !== "official" && <M3Chip label={UPDATE_CHANNELS[v.channel].label} />}
                    {isCurrent && <M3Chip tone="success" label={tr("mi.current")} />}
                    {isLatest && !isCurrent && (
                      <M3Chip tone="primary" icon={<AutoAwesomeOutlinedIcon />} label={tr("mi.latest")} />
                    )}
                  </Box>
                  <ExpandMoreIcon
                    sx={{
                      color: t.onSurfaceVariant,
                      transform: isOpen ? "rotate(180deg)" : "none",
                      transition: "transform 200ms cubic-bezier(0.2, 0, 0, 1)",
                    }}
                  />
                </ButtonBase>
                {isOpen && (
                  <Box
                    className="text-sm"
                    sx={{
                      px: 2,
                      pb: 2,
                      color: t.onSurface,
                      "& a": { color: t.primary },
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.5,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {parseMarkdownContentBlocks(v.content, true).map((block) => (
                      <Box key={block.id} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {block.markdown.trim() && (
                          <MarkdownRenderer content={block.markdown} compact allowImages />
                        )}
                        {block.urls.map((url) => (
                          <LinkPreview key={url} url={url} />
                        ))}
                      </Box>
                    ))}
                  </Box>
                )}
              </M3Card>
            );
          })}
        </Box>
      )}
    </>
  );
};

const ChangelogRefresh = () => {
  const { t: tr } = useTranslation();
  const { loading, refresh } = useChangelog();
  return (
    <M3IconButton
      label={tr("mi.refreshChangelog")}
      onClick={() => refresh()}
      disabled={loading}
      icon={
        loading ? <CircularProgress size={20} thickness={5} sx={{ color: "inherit" }} /> : <RefreshIcon />
      }
    />
  );
};

export const MobileChangelogModal = () => {
  const { t: tr } = useTranslation();
  const { isOpen, onClose, type } = useModal();
  const open = isOpen && type === "changelog";

  return (
    <M3FullScreenDialog
      open={open}
      title={tr("mi.changelog")}
      onClose={() => onClose()}
      leading="back"
      headerActions={<ChangelogRefresh />}
    >
      <ChangelogBody open={open} />
    </M3FullScreenDialog>
  );
};

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import type { ServerMotdDisplayPolicy } from "@/types";
import type { FlagConfig } from "@/components/modals/channel-operator-settings-modal";
import {
  M3Button,
  M3Card,
  M3Chip,
  M3FullScreenDialog,
  M3ListGroup,
  M3ListItem,
  M3SelectItem,
  M3Subheader,
  M3Switch,
  M3TextField,
  useM3,
  useM3Picker,
} from "@/components/mobile/m3";

/* ------------------------------------------------------------------ */
/* Message of the day                                                  */
/* ------------------------------------------------------------------ */

const EmptyState = ({ icon, title, text }: { icon: ReactNode; title: string; text: string }) => {
  const t = useM3();
  return (
    <Box sx={{ py: 8, px: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, textAlign: "center" }}>
      <Box sx={{ color: t.onSurfaceVariant, display: "flex" }}>{icon}</Box>
      <Box sx={{ fontSize: "1.125rem", color: t.onSurface }}>{title}</Box>
      <Box sx={{ fontSize: "0.875rem", color: t.onSurfaceVariant }}>{text}</Box>
    </Box>
  );
};

const MotdBody = ({
  serverName,
  isDirc,
  hasContent,
  isRefreshing,
  content,
  urls,
  onOpenUrl,
  policy,
  globalPolicyLabel,
  onPolicyChange,
  openPicker,
}: {
  serverName: string;
  isDirc: boolean;
  hasContent: boolean;
  isRefreshing: boolean;
  content: ReactNode;
  urls: string[];
  onOpenUrl: (url: string) => void;
  policy: ServerMotdDisplayPolicy;
  globalPolicyLabel: string;
  onPolicyChange: (p: ServerMotdDisplayPolicy) => void;
  openPicker: ReturnType<typeof useM3Picker>["open"];
}) => {
  const t = useM3();
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", pt: 1, pb: 2 }}>
        <M3Chip icon={<DnsOutlinedIcon />} label={serverName} />
        {isDirc && <M3Chip tone="primary" icon={<AutoAwesomeOutlinedIcon />} label="Luna IRC format" />}
        {isRefreshing && hasContent && <CircularProgress size={18} thickness={5} sx={{ color: t.primary }} />}
      </Box>

      {hasContent ? (
        <M3Card variant="filled" sx={{ mb: 2 }}>
          <Box
            sx={{
              p: 2,
              color: t.onSurface,
              userSelect: "text",
              WebkitUserSelect: "text",
              "& a": { color: t.primary },
            }}
          >
            {content}
          </Box>
        </M3Card>
      ) : isRefreshing ? (
        <Box sx={{ py: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <CircularProgress sx={{ color: t.primary }} />
          <Box sx={{ fontSize: "0.875rem", color: t.onSurfaceVariant }}>
            Fetching message of the day…
          </Box>
        </Box>
      ) : (
        <EmptyState
          icon={<DnsOutlinedIcon sx={{ fontSize: 40 }} />}
          title="No message of the day"
          text="The server did not send a MOTD or it is empty."
        />
      )}

      {!isDirc && urls.length > 0 && (
        <>
          <M3Subheader>Links</M3Subheader>
          <M3ListGroup>
            {urls.map((url, i) => (
              <M3ListItem
                key={url}
                headline={
                  <Box component="span" sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {url.replace(/^https?:\/\//, "")}
                  </Box>
                }
                trailing={<OpenInNewIcon sx={{ color: t.onSurfaceVariant, fontSize: 20 }} />}
                onClick={() => onOpenUrl(url)}
                divider={i < urls.length - 1}
              />
            ))}
          </M3ListGroup>
        </>
      )}

      <M3Subheader>Display</M3Subheader>
      <M3ListGroup>
        <M3SelectItem
          title="Show on connect"
          value={policy}
          options={[
            { value: "default", label: `Default (${globalPolicyLabel})` },
            { value: "on_change", label: "When changed" },
            { value: "always", label: "Always" },
            { value: "never", label: "Never on this server" },
            { value: "never_globally", label: "Never on any server" },
          ]}
          onChange={(v) => onPolicyChange(v as ServerMotdDisplayPolicy)}
          openPicker={openPicker}
          divider={false}
        />
      </M3ListGroup>
    </>
  );
};

export const MobileMotdView = (props: {
  open: boolean;
  onClose: () => void;
  serverName: string;
  isDirc: boolean;
  hasContent: boolean;
  isRefreshing: boolean;
  content: ReactNode;
  urls: string[];
  onOpenUrl: (url: string) => void;
  policy: ServerMotdDisplayPolicy;
  globalPolicyLabel: string;
  onPolicyChange: (p: ServerMotdDisplayPolicy) => void;
}) => {
  const picker = useM3Picker();
  const { open, onClose, ...body } = props;
  return (
    <M3FullScreenDialog
      open={open}
      title="Message of the day"
      onClose={() => (picker.isOpen ? picker.close() : onClose())}
    >
      <MotdBody {...body} openPicker={picker.open} />
      {picker.element}
    </M3FullScreenDialog>
  );
};

/* ------------------------------------------------------------------ */
/* Channel operator settings                                           */
/* ------------------------------------------------------------------ */

const OperatorBody = ({
  channelName,
  errorMessage,
  hasKey,
  password,
  setPassword,
  passwordBusy,
  onSetPassword,
  onRemovePassword,
  flags,
  activeFlags,
  togglingFlags,
  onToggleFlag,
  inviteNickname,
  setInviteNickname,
  inviteBusy,
  inviteSuccess,
  onSendInvite,
}: OperatorViewProps) => {
  const t = useM3();
  return (
    <>
      <Box sx={{ px: 0.5, pt: 1, pb: 1, fontSize: "0.875rem", lineHeight: "20px", color: t.onSurfaceVariant }}>
        Channel modes and password for{" "}
        <Box component="span" sx={{ color: t.primary, fontWeight: 500 }}>
          #{channelName}
        </Box>
      </Box>

      {errorMessage && (
        <Box
          sx={{
            my: 1.5,
            p: 2,
            borderRadius: "16px",
            display: "flex",
            gap: 1.5,
            alignItems: "flex-start",
            bgcolor: t.errorContainer,
            color: t.onErrorContainer,
            fontSize: "0.875rem",
            wordBreak: "break-word",
          }}
        >
          <ErrorOutlinedIcon sx={{ fontSize: 20, mt: "1px" }} />
          {errorMessage}
        </Box>
      )}

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
        <M3Subheader>Channel password (+k)</M3Subheader>
        {hasKey && <M3Chip tone="success" icon={<ShieldOutlinedIcon />} label="Protected" />}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, px: 0.5, pt: 1, pb: 2 }}>
        <M3TextField
          label={hasKey ? "New password" : "Password"}
          type="password"
          value={password}
          onChange={setPassword}
          disabled={passwordBusy}
          supportingText="Required to join the channel"
        />
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <M3Button
            variant="filled"
            icon={
              passwordBusy ? (
                <CircularProgress size={18} thickness={5} sx={{ color: "inherit" }} />
              ) : (
                <KeyOutlinedIcon />
              )
            }
            onClick={onSetPassword}
            disabled={passwordBusy || !password.trim()}
          >
            Set password
          </M3Button>
          {hasKey && (
            <M3Button
              variant="outlined"
              danger
              icon={<DeleteOutlinedIcon />}
              onClick={onRemovePassword}
              disabled={passwordBusy}
            >
              Remove
            </M3Button>
          )}
        </Box>
      </Box>

      <M3Subheader>Channel modes</M3Subheader>
      <M3ListGroup>
        {flags.map(({ flag, label, description, tip }, i) => {
          const checked = activeFlags.has(flag);
          const busy = !!togglingFlags[flag];
          return (
            <Box key={flag}>
              <M3ListItem
                headline={label}
                supporting={tip ? `${description}. ${tip}` : description}
                divider={i < flags.length - 1 && !(flag === "i" && checked)}
                onClick={busy ? undefined : () => onToggleFlag(flag, !checked)}
                trailing={
                  busy ? (
                    <Box sx={{ width: 52, display: "flex", justifyContent: "center" }}>
                      <CircularProgress size={22} thickness={5} sx={{ color: t.primary }} />
                    </Box>
                  ) : (
                    <M3Switch
                      checked={checked}
                      onChange={(v) => onToggleFlag(flag, v)}
                      ariaLabel={label}
                    />
                  )
                }
              />
              {flag === "i" && checked && (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    px: 2.5,
                    pt: 2,
                    pb: 2,
                    borderBottom: i < flags.length - 1 ? `1px solid ${t.outlineVariant}` : "none",
                  }}
                >
                  <M3TextField
                    label="Invite nickname"
                    value={inviteNickname}
                    onChange={setInviteNickname}
                    disabled={inviteBusy}
                    labelBackground={t.surfaceContainer}
                  />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                    <M3Button
                      variant="tonal"
                      icon={
                        inviteBusy ? (
                          <CircularProgress size={18} thickness={5} sx={{ color: "inherit" }} />
                        ) : (
                          <PersonAddAlt1OutlinedIcon />
                        )
                      }
                      onClick={onSendInvite}
                      disabled={inviteBusy || !inviteNickname.trim()}
                    >
                      Send invite
                    </M3Button>
                    {inviteSuccess && (
                      <M3Chip tone="success" icon={<CheckCircleOutlinedIcon />} label={inviteSuccess} />
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          );
        })}
      </M3ListGroup>
    </>
  );
};

export interface OperatorViewProps {
  channelName: string;
  errorMessage: string | null;
  hasKey: boolean;
  password: string;
  setPassword: (v: string) => void;
  passwordBusy: boolean;
  onSetPassword: () => void;
  onRemovePassword: () => void;
  flags: FlagConfig[];
  activeFlags: Set<string>;
  togglingFlags: Record<string, boolean>;
  onToggleFlag: (flag: string, enable: boolean) => void;
  inviteNickname: string;
  setInviteNickname: (v: string) => void;
  inviteBusy: boolean;
  inviteSuccess: string | null;
  onSendInvite: () => void;
}

export const MobileChannelOperatorView = ({
  open,
  onClose,
  ...props
}: OperatorViewProps & { open: boolean; onClose: () => void }) => (
  <M3FullScreenDialog open={open} title="Channel modes" onClose={onClose}>
    <OperatorBody {...props} />
  </M3FullScreenDialog>
);

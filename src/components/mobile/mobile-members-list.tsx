import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import type { Member } from "@/types";
import { UserAvatar } from "@/components/user-avatar";
import {
  ROLE_CONFIGS,
  UserRoleIcon,
  type ChannelRoleKey,
} from "@/components/user-role-icon";
import {
  M3Button,
  M3ListGroup,
  M3ListItem,
  M3SearchBar,
  M3Subheader,
  useM3,
} from "@/components/mobile/m3";

export interface MobileMemberRow {
  member: Member;
  displayName: string;
  role: ChannelRoleKey | null;
  isAway: boolean;
  awayReason?: string;
  isSelf: boolean;
}

const GROUPS: { id: string; title: string; roles: (ChannelRoleKey | null)[] }[] = [
  { id: "ops", title: "Operators", roles: ["owner", "admin", "op"] },
  { id: "halfops", title: "Half-operators", roles: ["halfop"] },
  { id: "voiced", title: "Voiced", roles: ["voice"] },
  { id: "members", title: "Members", roles: [null] },
];

const MemberItem = ({
  row,
  onClick,
  divider,
}: {
  row: MobileMemberRow;
  onClick?: () => void;
  divider: boolean;
}) => {
  const t = useM3();
  const supporting = row.isAway
    ? row.awayReason
      ? `Away: ${row.awayReason}`
      : "Away"
    : row.isSelf
      ? "You"
      : row.role
        ? ROLE_CONFIGS[row.role].label
        : undefined;

  return (
    // content-visibility keeps very large channels cheap to render
    <Box sx={{ contentVisibility: "auto", containIntrinsicSize: "auto 72px" }}>
      <M3ListItem
        leading={
          <Box sx={{ position: "relative", display: "flex" }}>
            <UserAvatar
              src={row.member.profile.imageUrl}
              name={row.displayName}
              className="h-10 w-10 md:h-10 md:w-10"
            />
            {row.isAway && (
              <Box
                component="span"
                aria-label="Away"
                sx={{
                  position: "absolute",
                  right: -1,
                  bottom: -1,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: "#F2B705",
                  border: `2px solid ${t.surfaceContainer}`,
                }}
              />
            )}
          </Box>
        }
        headline={
          <Box
            component="span"
            sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {row.displayName}
          </Box>
        }
        supporting={
          supporting && (
            <Box
              component="span"
              sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {supporting}
            </Box>
          )
        }
        trailing={row.role ? <UserRoleIcon role={row.role} showTooltip={false} className="h-5 w-5" /> : undefined}
        onClick={onClick}
        divider={divider}
      />
    </Box>
  );
};

/** Material 3 channel user list / conversation list for the mobile members screen. */
export const MobileMembersList = ({
  rows,
  isChannel,
  isConnected,
  onMemberClick,
  onMore,
}: {
  rows: MobileMemberRow[];
  isChannel: boolean;
  isConnected: boolean;
  onMemberClick: (memberId: string) => void;
  onMore: () => void;
}) => {
  const t = useM3();
  const [query, setQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);

  const self = rows.find((r) => r.isSelf);
  const others = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => !r.isSelf);
    if (!q) return list;
    return list.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        r.member.profile.name.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const groups = isChannel
    ? GROUPS.map((g) => ({ ...g, rows: others.filter((r) => g.roles.includes(r.role)) })).filter(
        (g) => g.rows.length > 0
      )
    : [{ id: "conversations", title: "Conversations", rows: others }];

  return (
    <Box sx={{ opacity: isConnected ? 1 : 0.6, transition: "opacity 300ms" }}>
      <Box sx={{ pt: 1, pb: 1 }}>
        <M3SearchBar
          value={query}
          onChange={setQuery}
          placeholder={isChannel ? `Search ${rows.length} users` : "Search conversations"}
          active={searchActive}
          onActiveChange={setSearchActive}
        />
      </Box>

      {self && !query && (
        <>
          <M3Subheader>You</M3Subheader>
          <M3ListGroup>
            <MemberItem row={self} divider={false} />
          </M3ListGroup>
        </>
      )}

      {groups.map((g) => (
        <Box key={g.id}>
          <M3Subheader>
            {g.title} — {g.rows.length}
          </M3Subheader>
          <M3ListGroup>
            {g.rows.map((row, i) => (
              <MemberItem
                key={row.member.id}
                row={row}
                onClick={() => onMemberClick(row.member.id)}
                divider={i < g.rows.length - 1}
              />
            ))}
          </M3ListGroup>
        </Box>
      ))}

      {others.length === 0 && (
        <Box sx={{ py: 6, textAlign: "center", color: t.onSurfaceVariant, fontSize: "0.875rem" }}>
          {query ? "No matching users" : isChannel ? "No other users" : "No conversations yet"}
        </Box>
      )}

      {!isChannel && (
        <Box sx={{ pt: 1 }}>
          <M3Button variant="tonal" icon={<MoreHorizIcon />} onClick={onMore} fullWidth>
            More options
          </M3Button>
        </Box>
      )}
    </Box>
  );
};

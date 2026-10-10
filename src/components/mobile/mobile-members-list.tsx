import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
import { useMockStore } from "@/lib/mock-store";
import { buildMemberGroups, collapsedKey, type MemberGroup } from "@/lib/member-groups";

export interface MobileMemberRow {
  member: Member;
  displayName: string;
  role: ChannelRoleKey | null;
  isAway: boolean;
  awayReason?: string;
  isSelf: boolean;
}

const MemberItem = ({
  row,
  onClick,
  divider,
  showRole = true,
}: {
  row: MobileMemberRow;
  onClick?: () => void;
  divider: boolean;
  /** Off inside role groups, where the group header already states the role. */
  showRole?: boolean;
}) => {
  const t = useM3();
  const supporting = row.isAway
    ? row.awayReason
      ? `Away: ${row.awayReason}`
      : "Away"
    : row.isSelf
      ? "You"
      : row.role && showRole
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
        trailing={
          row.role && showRole ? (
            <UserRoleIcon role={row.role} showTooltip={false} className="h-5 w-5" />
          ) : undefined
        }
        onClick={onClick}
        divider={divider}
      />
    </Box>
  );
};

/** Material 3 channel user list / conversation list for the mobile members screen. */
export const MobileMembersList = ({
  rows,
  serverId,
  isChannel,
  isConnected,
  onMemberClick,
  onMore,
}: {
  rows: MobileMemberRow[];
  serverId: string;
  isChannel: boolean;
  isConnected: boolean;
  onMemberClick: (memberId: string) => void;
  onMore: () => void;
}) => {
  const t = useM3();
  const [query, setQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);

  const groupByRole = useMockStore((s) => s.groupMembersByRole);
  const collapsed = useMockStore((s) => s.collapsedMemberGroups);
  const toggleCollapsed = useMockStore((s) => s.toggleMemberGroupCollapsed);

  const grouped = isChannel && groupByRole;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) || r.member.profile.name.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const self = rows.find((r) => r.isSelf);
  const others = filtered.filter((r) => !r.isSelf);

  const groups: MemberGroup<MobileMemberRow>[] = grouped
    ? buildMemberGroups(
        filtered,
        (r) => ({ role: r.role, isAway: r.isAway }),
        (a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
      )
    : others.length > 0
      ? [
          {
            id: isChannel ? "role:users" : "conversations",
            title: isChannel ? "Users" : "Conversations",
            kind: "role" as const,
            items: others,
          },
        ]
      : [];

  const hasAnyRows = grouped ? groups.length > 0 : others.length > 0;

  // A lone plain-Users group would only repeat the search bar's "N users"; any other lone
  // group (everyone is an operator / away) keeps its header because it carries information.
  const hideGroupHeaders =
    grouped && groups.length === 1 && groups[0].kind === "role" && !groups[0].role;

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

      {/* Ungrouped lists keep the self row pinned on top */}
      {!grouped && self && !query && (
        <>
          <M3Subheader>You</M3Subheader>
          <M3ListGroup>
            <MemberItem row={self} divider={false} />
          </M3ListGroup>
        </>
      )}

      {groups.map((g) => {
        const key = collapsedKey(serverId, g.id);
        const isCollapsed = grouped && !hideGroupHeaders && !!collapsed[key];
        return (
          <Box key={g.id}>
            {!hideGroupHeaders && (
              <ButtonBase
                disabled={!grouped}
                onClick={() => toggleCollapsed(key)}
                sx={{ width: "100%", justifyContent: "flex-start", textAlign: "left" }}
              >
                <M3Subheader>
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                    {grouped &&
                      (isCollapsed ? (
                        <ChevronRightIcon fontSize="small" />
                      ) : (
                        <ExpandMoreIcon fontSize="small" />
                      ))}
                    {g.title} — {g.items.length}
                  </Box>
                </M3Subheader>
              </ButtonBase>
            )}
            {!isCollapsed && (
              <M3ListGroup>
                {g.items.map((row, i) => (
                  <MemberItem
                    key={row.member.id}
                    row={row}
                    onClick={() => onMemberClick(row.member.id)}
                    divider={i < g.items.length - 1}
                    showRole={!grouped || g.kind !== "role"}
                  />
                ))}
              </M3ListGroup>
            )}
          </Box>
        );
      })}

      {!hasAnyRows && (
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

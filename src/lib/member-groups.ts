import type { ChannelRoleKey } from "@/components/user-role-icon";

export type MemberGroupKind = "role" | "away";

export interface MemberGroup<T> {
  /** Stable id: `role:<key|users>` or `away`. */
  id: string;
  title: string;
  kind: MemberGroupKind;
  /** Role shown in the header for role groups. */
  role?: ChannelRoleKey;
  items: T[];
}

export interface MemberGroupInfo {
  role: ChannelRoleKey | null;
  isAway: boolean;
}

const ROLE_GROUPS: { id: string; title: string; role: ChannelRoleKey | null }[] = [
  { id: "role:owner", title: "Owners", role: "owner" },
  { id: "role:admin", title: "Admins", role: "admin" },
  { id: "role:op", title: "Operators", role: "op" },
  { id: "role:halfop", title: "Half-operators", role: "halfop" },
  { id: "role:voice", title: "Voiced", role: "voice" },
  { id: "role:users", title: "Users", role: null },
];

export const AWAY_GROUP_ID = "away";

/** Key under which a group's collapsed state is stored. */
export const collapsedKey = (serverId: string, groupId: string) => `${serverId}:${groupId}`;

/**
 * Splits channel members into display groups, top to bottom: one group per channel status
 * role (~ & @ % +), plain users, then a single "Away" group. Away members are taken out of
 * their role group. Empty groups are omitted.
 */
export function buildMemberGroups<T>(
  items: T[],
  getInfo: (item: T) => MemberGroupInfo,
  compare?: (a: T, b: T) => number
): MemberGroup<T>[] {
  const roles = new Map<string, MemberGroup<T>>();
  for (const g of ROLE_GROUPS) {
    roles.set(g.id, {
      id: g.id,
      title: g.title,
      kind: "role",
      role: g.role ?? undefined,
      items: [],
    });
  }
  const away: MemberGroup<T> = { id: AWAY_GROUP_ID, title: "Away", kind: "away", items: [] };

  for (const item of items) {
    const info = getInfo(item);
    if (info.isAway) away.items.push(item);
    else roles.get(`role:${info.role ?? "users"}`)!.items.push(item);
  }

  const ordered = [...roles.values(), away].filter((g) => g.items.length > 0);
  if (compare) ordered.forEach((g) => g.items.sort(compare));
  return ordered;
}

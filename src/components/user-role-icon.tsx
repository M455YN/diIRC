import { useTranslation } from "react-i18next";
import React from "react";
import {
  KeySquare,
  Mic,
  Network,
  Terminal,
  ServerCog,
  Server,
  Bot,
  LucideProps,
} from "lucide-react";
import { ActionTooltip } from "@/components/action-tooltip";
import { cn } from "@/lib/utils";

// Chess icons from newer lucide releases (not in the pinned lucide-react version), same style/geometry.
const LucideSvg: React.FC<LucideProps & { name: string }> = ({ name, className, children, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("lucide", `lucide-${name}`, className)}
    {...props}
  >
    {children}
  </svg>
);

export const ChessKing: React.FC<LucideProps> = (props) => (
  <LucideSvg name="chess-king" {...props}>
    <path d="M4 20a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="m6.7 18-1-1C4.35 15.682 3 14.09 3 12a5 5 0 0 1 4.95-5c1.584 0 2.7.455 4.05 1.818C13.35 7.455 14.466 7 16.05 7A5 5 0 0 1 21 12c0 2.082-1.359 3.673-2.7 5l-1 1" />
    <path d="M10 4h4" />
    <path d="M12 2v6.818" />
  </LucideSvg>
);

export const ChessQueen: React.FC<LucideProps> = (props) => (
  <LucideSvg name="chess-queen" {...props}>
    <path d="M4 20a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="m12.474 5.943 1.567 5.34a1 1 0 0 0 1.75.328l2.616-3.402" />
    <path d="m20 9-3 9" />
    <path d="m5.594 8.209 2.615 3.403a1 1 0 0 0 1.75-.329l1.567-5.34" />
    <path d="M7 18 4 9" />
    <circle cx="12" cy="4" r="2" />
    <circle cx="20" cy="7" r="2" />
    <circle cx="4" cy="7" r="2" />
  </LucideSvg>
);

export const ChessKnight: React.FC<LucideProps> = (props) => (
  <LucideSvg name="chess-knight" {...props}>
    <path d="M5 20a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
    <path d="M16.5 18c1-2 2.5-5 2.5-9a7 7 0 0 0-7-7H6.635a1 1 0 0 0-.768 1.64L7 5l-2.32 5.802a2 2 0 0 0 .95 2.526l2.87 1.456" />
    <path d="m15 5 1.425-1.425" />
    <path d="m17 8 1.53-1.53" />
    <path d="M9.713 12.185 7 18" />
  </LucideSvg>
);

export type ChannelRoleKey = "owner" | "admin" | "op" | "halfop" | "voice";
export type ServerRoleKey = "netadmin" | "ircop" | "serveradmin" | "locop" | "servicesop";
export type UserRoleKey = ChannelRoleKey | ServerRoleKey;

export interface RoleConfig {
  key: UserRoleKey;
  label: string;
  icon: React.ComponentType<LucideProps>;
  colorClass: string;
  fillClass?: string;
  hexColor: string;
  priority: number;
  type: "channel" | "server";
  prefix?: string;
  modeChar?: string;
}

export const ROLE_CONFIGS: Record<UserRoleKey, RoleConfig> = {
  // Channel Roles
  owner: {
    key: "owner",
    label: "role.owner",
    icon: KeySquare,
    colorClass: "text-amber-500",
    fillClass: "fill-amber-500/20",
    hexColor: "#f59e0b",
    priority: 100,
    type: "channel",
    prefix: "~",
    modeChar: "q",
  },
  admin: {
    key: "admin",
    label: "role.admin",
    icon: ChessKing,
    colorClass: "text-indigo-500",
    fillClass: "fill-indigo-500/20",
    hexColor: "#6366f1",
    priority: 90,
    type: "channel",
    prefix: "&",
    modeChar: "a",
  },
  op: {
    key: "op",
    label: "role.op",
    icon: ChessQueen,
    colorClass: "text-emerald-500",
    fillClass: "fill-emerald-500/20",
    hexColor: "#10b981",
    priority: 80,
    type: "channel",
    prefix: "@",
    modeChar: "o",
  },
  halfop: {
    key: "halfop",
    label: "role.halfop",
    icon: ChessKnight,
    colorClass: "text-teal-500",
    fillClass: "fill-teal-500/20",
    hexColor: "#14b8a6",
    priority: 70,
    type: "channel",
    prefix: "%",
    modeChar: "h",
  },
  voice: {
    key: "voice",
    label: "role.voice",
    icon: Mic,
    colorClass: "text-blue-500",
    fillClass: "fill-blue-500/20",
    hexColor: "#3b82f6",
    priority: 60,
    type: "channel",
    prefix: "+",
    modeChar: "v",
  },

  // Server & Network Roles
  netadmin: {
    key: "netadmin",
    label: "role.netadmin",
    icon: Network,
    colorClass: "text-rose-500",
    fillClass: "fill-rose-500/20",
    hexColor: "#f43f5e",
    priority: 50,
    type: "server",
  },
  ircop: {
    key: "ircop",
    label: "role.ircop",
    icon: Terminal,
    colorClass: "text-yellow-500",
    fillClass: "fill-yellow-500/20",
    hexColor: "#eab308",
    priority: 40,
    type: "server",
    modeChar: "o",
  },
  serveradmin: {
    key: "serveradmin",
    label: "role.serveradmin",
    icon: ServerCog,
    colorClass: "text-orange-500",
    fillClass: "fill-orange-500/20",
    hexColor: "#f97316",
    priority: 30,
    type: "server",
    modeChar: "a",
  },
  locop: {
    key: "locop",
    label: "role.locop",
    icon: Server,
    colorClass: "text-purple-500",
    fillClass: "fill-purple-500/20",
    hexColor: "#a855f7",
    priority: 20,
    type: "server",
    modeChar: "O",
  },
  servicesop: {
    key: "servicesop",
    label: "role.servicesop",
    icon: Bot,
    colorClass: "text-cyan-500",
    fillClass: "fill-cyan-500/20",
    hexColor: "#06b6d4",
    priority: 10,
    type: "server",
  },
};

/**
 * Resolves a prefix character (~, &, @, %, +) or mode character (q, a, o, h, v) to a ChannelRoleKey
 */
export const parseChannelRole = (symbolOrMode: string): ChannelRoleKey | null => {
  const trimmed = symbolOrMode.trim();
  for (const config of Object.values(ROLE_CONFIGS)) {
    if (config.type === "channel") {
      if (config.prefix === trimmed || config.modeChar === trimmed) {
        return config.key as ChannelRoleKey;
      }
    }
  }
  return null;
};

/**
 * Given a list of channel mode characters or prefixes, returns the highest priority ChannelRoleKey
 */
export const getHighestChannelRole = (
  modesOrPrefixes: string[] | string
): ChannelRoleKey | null => {
  const items = Array.isArray(modesOrPrefixes)
    ? modesOrPrefixes
    : modesOrPrefixes.split("");

  let highestRole: ChannelRoleKey | null = null;
  let highestPriority = -1;

  for (const item of items) {
    const roleKey = parseChannelRole(item);
    if (roleKey) {
      const priority = ROLE_CONFIGS[roleKey].priority;
      if (priority > highestPriority) {
        highestPriority = priority;
        highestRole = roleKey;
      }
    }
  }

  return highestRole;
};

export interface UserRoleIconProps {
  role: UserRoleKey;
  className?: string;
  showTooltip?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  showLabel?: boolean;
}

export const UserRoleIcon: React.FC<UserRoleIconProps> = ({
  role,
  className,
  showTooltip = true,
  tooltipSide = "top",
  showLabel = false,
}) => {
  const { t: tr } = useTranslation();
  const config = ROLE_CONFIGS[role];
  if (!config) return null;

  const Icon = config.icon;

  const content = (
    <div className="inline-flex items-center gap-x-1.5 shrink-0">
      <Icon
        className={cn(
          "w-4 h-4 shrink-0 transition-transform hover:scale-110",
          config.colorClass,
          config.fillClass,
          className
        )}
      />
      {showLabel && (
        <span className={cn("text-xs font-medium", config.colorClass)}>
          {tr(config.label)}
        </span>
      )}
    </div>
  );

  if (showTooltip && !showLabel) {
    return (
      <ActionTooltip label={tr(config.label)} side={tooltipSide}>
        {content}
      </ActionTooltip>
    );
  }

  return content;
};

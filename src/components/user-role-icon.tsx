import { useTranslation } from "react-i18next";
import React from "react";
import {
  Crown,
  ShieldCheck,
  ShieldAlert,
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

// Custom Lucide-style ShieldHalf component since it's not in standard lucide-react export
export const ShieldHalf: React.FC<LucideProps> = ({ className, ...props }) => (
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
    className={cn("lucide lucide-shield-half", className)}
    {...props}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M12 22V2" />
  </svg>
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
    icon: Crown,
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
    icon: ShieldCheck,
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
    icon: ShieldAlert,
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
    icon: ShieldHalf,
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

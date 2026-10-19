import { Member, Profile, Server } from "@/types";
import { useParams, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { UserHoverCard, getMemberDisplayName } from "@/components/user-hover-card";

interface ServerMemberProps {
  member: Member & { profile: Profile };
  server: Server;
}

export const ServerMember = ({
  member,
  server
}: ServerMemberProps) => {
  const params = useParams();
  const navigate = useNavigate();

  const onClick = () => {
    navigate(`/servers/${params?.serverId}/conversations/${member.id}`);
  };

  const isSelected = params?.memberId === member.id;
  const displayName = getMemberDisplayName(member, server);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group px-2 py-2 rounded-md flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition mb-1",
        isSelected && "bg-zinc-700/20 dark:bg-zinc-700"
      )}
    >
      <UserAvatar 
        src={member.profile.imageUrl}
        name={displayName}
        serverId={server.id}
        nick={member.profile.name}
        className="h-8 w-8 md:h-8 md:w-8"
      />
      <p
        className={cn(
          "font-semibold text-sm text-zinc-500 group-hover:text-zinc-600 dark:text-zinc-400 dark:group-hover:text-zinc-300 transition text-left",
          isSelected && "text-primary dark:text-zinc-200 dark:group-hover:text-white"
        )}
      >
        {displayName}
      </p>
    </button>
  );
};

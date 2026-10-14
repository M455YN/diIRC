import { useEffect, useState } from "react";

import { EditServerModal } from "@/components/modals/edit-server-modal";
import { InviteModal } from "@/components/modals/invite-modal";
import { CreateServerModal } from "@/components/modals/create-server-modal";
import { MembersModal } from "@/components/modals/members-modal";
import { CreateChannelModal } from "@/components/modals/create-channel-modal";
import { LeaveServerModal } from "@/components/modals/leave-server-modal";
import { DeleteServerModal } from "@/components/modals/delete-server-modal";
import { DeleteChannelModal } from "@/components/modals/delete-channel-modal";
import { SettingsModal } from "@/components/modals/settings-modal";
import { ImagePreviewModal } from "@/components/modals/image-preview-modal";
import { IrcErrorModal } from "@/components/modals/irc-error-modal";
import { EditTopicModal } from "@/components/modals/edit-topic-modal";
import { JoinChannelPasswordModal } from "@/components/modals/join-channel-password-modal";
import { ChannelSettingsModal } from "@/components/modals/channel-settings-modal";
import { ChannelOperatorSettingsModal } from "@/components/modals/channel-operator-settings-modal";
import { ConnectionDetailsModal } from "@/components/modals/connection-details-modal";
import { RoleIconsModal } from "@/components/modals/role-icons-modal";
import { PrivateMessagesModal } from "@/components/modals/private-messages-modal";
import { UpdateModal } from "@/components/modals/update-modal";
import { MotdModal } from "@/components/modals/motd-modal";
import { AlreadyAwayModal } from "@/components/modals/already-away-modal";
import { ChangelogModal } from "@/components/modals/changelog-modal";
import { BookmarksModal } from "@/components/modals/bookmarks-modal";

export const ModalProvider = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <CreateServerModal />
      <InviteModal />
      <EditServerModal />
      <MembersModal />
      <CreateChannelModal />
      <LeaveServerModal />
      <DeleteServerModal />
      <DeleteChannelModal />
      <SettingsModal />
      <ImagePreviewModal />
      <IrcErrorModal />
      <EditTopicModal />
      <JoinChannelPasswordModal />
      <ChannelSettingsModal />
      <ChannelOperatorSettingsModal />
      <ConnectionDetailsModal />
      <RoleIconsModal />
      <PrivateMessagesModal />
      <UpdateModal />
      <MotdModal />
      <AlreadyAwayModal />
      <ChangelogModal />
      <BookmarksModal />
    </>
  );
};

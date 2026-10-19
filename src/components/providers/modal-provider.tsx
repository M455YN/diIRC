import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { useModal, type ModalType } from "@/hooks/use-modal-store";

/**
 * A modal's code loads on its first open and stays mounted afterwards, so the closing animation still runs
 * and the startup bundle does not carry every dialog.
 */
const lazyModal = (type: ModalType, load: () => Promise<Record<string, unknown>>, name: string) => {
  const Modal = lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
  return function LazyModal() {
    const { isOpen, type: openType } = useModal();
    const [loaded, setLoaded] = useState(false);
    const active = isOpen && openType === type;
    useEffect(() => {
      if (active) setLoaded(true);
    }, [active]);
    return loaded || active ? (
      <Suspense fallback={null}>
        <Modal />
      </Suspense>
    ) : null;
  };
};

const CreateServerModal = lazyModal("createServer", () => import("@/components/modals/create-server-modal"), "CreateServerModal");
const InviteModal = lazyModal("invite", () => import("@/components/modals/invite-modal"), "InviteModal");
const EditServerModal = lazyModal("editServer", () => import("@/components/modals/edit-server-modal"), "EditServerModal");
const MembersModal = lazyModal("members", () => import("@/components/modals/members-modal"), "MembersModal");
const CreateChannelModal = lazyModal("createChannel", () => import("@/components/modals/create-channel-modal"), "CreateChannelModal");
const LeaveServerModal = lazyModal("leaveServer", () => import("@/components/modals/leave-server-modal"), "LeaveServerModal");
const DeleteServerModal = lazyModal("deleteServer", () => import("@/components/modals/delete-server-modal"), "DeleteServerModal");
const DeleteChannelModal = lazyModal("deleteChannel", () => import("@/components/modals/delete-channel-modal"), "DeleteChannelModal");
const SettingsModal = lazyModal("settings", () => import("@/components/modals/settings-modal"), "SettingsModal");
const ImagePreviewModal = lazyModal("imagePreview", () => import("@/components/modals/image-preview-modal"), "ImagePreviewModal");
const IrcErrorModal = lazyModal("ircError", () => import("@/components/modals/irc-error-modal"), "IrcErrorModal");
const EditTopicModal = lazyModal("editTopic", () => import("@/components/modals/edit-topic-modal"), "EditTopicModal");
const JoinChannelPasswordModal = lazyModal("joinChannelPassword", () => import("@/components/modals/join-channel-password-modal"), "JoinChannelPasswordModal");
const ChannelSettingsModal = lazyModal("channelSettings", () => import("@/components/modals/channel-settings-modal"), "ChannelSettingsModal");
const ChannelOperatorSettingsModal = lazyModal("channelOperatorSettings", () => import("@/components/modals/channel-operator-settings-modal"), "ChannelOperatorSettingsModal");
const ConnectionDetailsModal = lazyModal("connectionDetails", () => import("@/components/modals/connection-details-modal"), "ConnectionDetailsModal");
const RoleIconsModal = lazyModal("roleIcons", () => import("@/components/modals/role-icons-modal"), "RoleIconsModal");
const PrivateMessagesModal = lazyModal("privateMessages", () => import("@/components/modals/private-messages-modal"), "PrivateMessagesModal");
const UpdateModal = lazyModal("updateAvailable", () => import("@/components/modals/update-modal"), "UpdateModal");
const MotdModal = lazyModal("motd", () => import("@/components/modals/motd-modal"), "MotdModal");
const AlreadyAwayModal = lazyModal("alreadyAway", () => import("@/components/modals/already-away-modal"), "AlreadyAwayModal");
const ChangelogModal = lazyModal("changelog", () => import("@/components/modals/changelog-modal"), "ChangelogModal");
const BookmarksModal = lazyModal("bookmarks", () => import("@/components/modals/bookmarks-modal"), "BookmarksModal");
const NotesModal = lazyModal("notes", () => import("@/components/modals/notes-modal"), "NotesModal");
const LinkPreviewModal = lazyModal("linkPreview", () => import("@/components/modals/link-preview-modal"), "LinkPreviewModal");
const ForwardMessageModal = lazyModal("forwardMessage", () => import("@/components/modals/forward-message-modal"), "ForwardMessageModal");
const LunaModal = lazyModal("luna", () => import("@/components/modals/luna-modal"), "LunaModal");
const RawLogModal = lazyModal("rawLog", () => import("@/components/modals/raw-log-modal"), "RawLogModal");
const ExternalLinkModal = lazyModal("externalLink", () => import("@/components/modals/external-link-modal"), "ExternalLinkModal");
const ChannelListModal = lazyModal("channelList", () => import("@/components/modals/channel-list-modal"), "ChannelListModal");

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
      <NotesModal />
      <LinkPreviewModal />
      <ChannelListModal />
      <ForwardMessageModal />
      <RawLogModal />
      <LunaModal />
      <ExternalLinkModal />
    </>
  );
};

import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAndroidBackNavigation } from "@/hooks/use-android-back-navigation";
import { useKeyboardOpen } from "@/hooks/use-keyboard-open";
import { useMobileThemeSync } from "@/hooks/use-mobile-theme";
import { useModalStore } from "@/hooks/use-modal-store";
import {
  MobileBottomNav,
  type MobileTab,
} from "@/components/mobile/mobile-bottom-nav";
import { MobileChatsTab } from "@/components/mobile/mobile-chats-tab";
import { MobileMoreTab } from "@/components/mobile/mobile-more-tab";
import { MobileServersTab } from "@/components/mobile/mobile-servers-tab";
import { useMockStore } from "@/lib/mock-store";
import { cn } from "@/lib/utils";

function isChatRoute(pathname: string): boolean {
  return /\/(channels|conversations)\//.test(pathname);
}

export const MobileShellLayout = () => {
  const { serverId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const servers = useMockStore((state) => state.servers);
  const keyboardOpen = useKeyboardOpen();

  const [tab, setTab] = useState<MobileTab>("chats");
  const inChat = isChatRoute(location.pathname);

  useAndroidBackNavigation({ tab, setTab });
  useMobileThemeSync();

  const activeServer =
    servers.find((s) => s.id === serverId) || (serverId ? undefined : servers[0]);

  const activeMotd = useMockStore((state) =>
    activeServer ? state.serverMotds[activeServer.id] : undefined
  );

  // MD3 navigation bar — hidden in chat and while keyboard is open
  const barVisible = !keyboardOpen && !inChat;

  useEffect(() => {
    // Ensure any leftover native chrome flag is cleared
    document.documentElement.removeAttribute("data-native-tab-bar");
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (barVisible) root.setAttribute("data-mobile-nav-visible", "true");
    else root.removeAttribute("data-mobile-nav-visible");
    return () => root.removeAttribute("data-mobile-nav-visible");
  }, [barVisible]);

  useEffect(() => {
    if (!servers || servers.length === 0) {
      if (location.pathname !== "/") {
        navigate("/", { replace: true });
      }
    } else if (!activeServer && !location.pathname.startsWith("/invite")) {
      navigate(`/servers/${servers[0].id}`, { replace: true });
    }
  }, [serverId, activeServer, servers, navigate, location.pathname]);

  useEffect(() => {
    if (!activeServer || !activeMotd || activeMotd.length === 0) return;
    const store = useMockStore.getState();
    if (store.shouldAutoShowMotd(activeServer.id, activeMotd)) {
      useModalStore.getState().onOpen("motd", {
        server: activeServer,
        serverId: activeServer.id,
        motd: activeMotd,
      });
      store.markServerMotdSeen(activeServer.id, activeMotd);
    }
  }, [activeServer?.id, activeMotd]);

  useEffect(() => {
    if (inChat) setTab("chats");
  }, [inChat]);

  const handleTabChange = (next: MobileTab) => {
    const modal = useModalStore.getState();
    if (modal.isOpen) modal.onClose();
    setTab(next);
    if (next === "chats" && activeServer) {
      if (inChat || location.pathname === "/") {
        navigate(`/servers/${activeServer.id}`);
      } else if (!location.pathname.startsWith(`/servers/${activeServer.id}`)) {
        navigate(`/servers/${activeServer.id}`);
      }
    }
  };

  if (inChat) {
    return (
      <div className="relative h-full bg-background text-foreground">
        <div className="h-full min-h-0 overflow-hidden">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full bg-background text-foreground">
      <div
        className={cn(
          "h-full min-h-0 overflow-hidden",
          barVisible && "pb-[calc(5rem+env(safe-area-inset-bottom,0px))]"
        )}
      >
        <div className={cn("h-full", tab !== "servers" && "hidden")}>
          <MobileServersTab
            onSelectServer={() => setTab("chats")}
            setTab={setTab}
          />
        </div>

        <div className={cn("h-full", tab !== "chats" && "hidden")}>
          <MobileChatsTab serverId={activeServer?.id} />
        </div>

        <div className={cn("h-full", tab !== "more" && "hidden")}>
          <MobileMoreTab />
        </div>

        {location.pathname === "/" && tab === "chats" && servers.length === 0 && (
          <div className="absolute inset-0 z-10 bg-background">
            <Outlet />
          </div>
        )}
      </div>

      <MobileBottomNav
        active={tab}
        onChange={handleTabChange}
        hidden={!barVisible}
      />
    </div>
  );
};

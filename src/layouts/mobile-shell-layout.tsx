import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";
import { useModalStore } from "@/hooks/use-modal-store";
import { useKeyboardOpen } from "@/hooks/use-keyboard-open";
import { useAndroidBackNavigation } from "@/hooks/use-android-back-navigation";
import { ServerSidebar } from "@/components/server/server-sidebar";
import {
  MobileBottomNav,
  type MobileTab,
} from "@/components/mobile/mobile-bottom-nav";
import { MobileServersTab } from "@/components/mobile/mobile-servers-tab";
import { MobileMoreTab } from "@/components/mobile/mobile-more-tab";
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

  const activeServer =
    servers.find((s) => s.id === serverId) || (serverId ? undefined : servers[0]);

  // Auto MOTD (same as desktop MainLayout)
  const activeMotd = useMockStore((state) =>
    activeServer ? state.serverMotds[activeServer.id] : undefined
  );

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

  // When entering a chat route, keep chats tab selected for when user goes back
  useEffect(() => {
    if (inChat) setTab("chats");
  }, [inChat]);

  const handleTabChange = (next: MobileTab) => {
    setTab(next);
    if (next === "chats" && activeServer) {
      // Stay on server index (channel list) — do not jump into last chat
      if (inChat || location.pathname === "/") {
        navigate(`/servers/${activeServer.id}`);
      } else if (!location.pathname.startsWith(`/servers/${activeServer.id}`)) {
        navigate(`/servers/${activeServer.id}`);
      }
    }
  };

  // Chat keeps the floating pill so navigation stays visible
  if (inChat) {
    return (
      <div className="relative h-full bg-white dark:bg-[#313338]">
        <div
          className={cn(
            "h-full min-h-0 overflow-hidden",
            !keyboardOpen && "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
          )}
        >
          <Outlet />
        </div>
        <MobileBottomNav
          active={tab}
          onChange={handleTabChange}
          hidden={keyboardOpen}
        />
      </div>
    );
  }

  return (
    <div className="relative h-full bg-white dark:bg-[#313338]">
      {/* Content scrolls under the floating glass nav */}
      <div
        className={cn(
          "h-full min-h-0 overflow-hidden",
          !keyboardOpen && "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
        )}
      >
        <div className={cn("h-full", tab !== "servers" && "hidden")}>
          <MobileServersTab
            onSelectServer={() => setTab("chats")}
            setTab={setTab}
          />
        </div>

        <div className={cn("h-full", tab !== "chats" && "hidden")}>
          {activeServer && activeServer.channels.length > 0 ? (
            <div className="h-full mobile-safe-top">
              <ServerSidebar serverId={activeServer.id} />
            </div>
          ) : activeServer && activeServer.channels.length === 0 ? (
            <Outlet />
          ) : (
            <div className="h-full flex items-center justify-center p-6 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Select a server to see channels and private messages.
              </p>
            </div>
          )}
        </div>

        <div className={cn("h-full", tab !== "more" && "hidden")}>
          <MobileMoreTab />
        </div>

        {location.pathname === "/" && tab === "chats" && servers.length === 0 && (
          <div className="absolute inset-0 z-10 bg-white dark:bg-[#313338]">
            <Outlet />
          </div>
        )}
      </div>

      <MobileBottomNav
        active={tab}
        onChange={handleTabChange}
        hidden={keyboardOpen}
      />
    </div>
  );
};

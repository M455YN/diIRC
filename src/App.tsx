import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ModalProvider } from "@/components/providers/modal-provider";
import { SocketProvider } from "@/components/providers/socket-provider";
import { IrcProvider } from "@/components/providers/irc-provider";
import { ErrorBoundary } from "@/components/providers/error-boundary";

import { MainLayout } from "@/layouts/main-layout";
import { MobileShellLayout } from "@/layouts/mobile-shell-layout";
import { SetupPage } from "@/pages/setup-page";
import { ServerPage } from "@/pages/server-page";
import { ChannelPage } from "@/pages/channel-page";
import { ConversationPage } from "@/pages/conversation-page";
import { InvitePage } from "@/pages/invite-page";

import { InvitePreviewPage } from "@/pages/invite-preview-page";

import { useAutoUpdateCheck } from "@/hooks/use-auto-update-check";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { useAppearanceStyleSync } from "@/hooks/use-appearance-style";

function AppRoutes() {
  const isMobileShell = useIsMobileShell();
  const Layout = isMobileShell ? MobileShellLayout : MainLayout;

  return (
    <Routes>
      <Route path="/invite/:inviteCode" element={<InvitePage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<SetupPage />} />
        <Route path="/servers/:serverId">
          <Route index element={<ServerPage />} />
          <Route path="channels/:channelId" element={<ChannelPage />} />
          <Route path="conversations/:memberId" element={<ConversationPage />} />
          <Route path="invites/:channelName" element={<InvitePreviewPage />} />
        </Route>
        <Route path="*" element={<SetupPage />} />
      </Route>
    </Routes>
  );
}

// Needs next-themes context (resolved colour mode), so it lives inside ThemeProvider.
function AppearanceSync() {
  useAppearanceStyleSync();
  return null;
}

export function App() {
  useAutoUpdateCheck();

  useEffect(() => {
    // Prevent default native webview right-click context menu globally except in text input fields
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;
        if (!isInput) {
          e.preventDefault();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        invoke("toggle_devtools").catch((err) => {
          console.error("Failed to toggle devtools:", err);
        });
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        storageKey="discord-theme"
        themes={["light", "dark", "oled"]}
      >
      <AppearanceSync />
      <SocketProvider>
        <BrowserRouter>
          <IrcProvider>
            <ModalProvider />
            <AppRoutes />
          </IrcProvider>
        </BrowserRouter>
      </SocketProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

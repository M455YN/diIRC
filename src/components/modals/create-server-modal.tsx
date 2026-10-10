import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { MobileServerFormModal } from "@/components/mobile/mobile-server-form";
import { DesktopServerFormModal } from "@/components/modals/edit-server-modal";

// Desktop layout is shared with the edit modal; only the mode differs.
export const CreateServerModal = () =>
  useIsMobileShell() ? <MobileServerFormModal mode="create" /> : <DesktopServerFormModal mode="create" />;

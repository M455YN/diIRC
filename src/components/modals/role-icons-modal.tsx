import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { ROLE_CONFIGS, UserRoleIcon, UserRoleKey } from "@/components/user-role-icon";
import { ShieldCheck } from "lucide-react";

export const RoleIconsModal = () => {
  const { t: tr } = useTranslation();
  const { isOpen, onClose, type } = useModal();
  const isModalOpen = isOpen && type === "roleIcons";

  const handleClose = () => {
    onClose("roleIcons");
  };

  const roles = Object.values(ROLE_CONFIGS);

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 max-w-lg overflow-hidden rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <DialogHeader className="pt-6 px-6 pb-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-x-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            {tr("rest.roleIcons")}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
            Icons and color signatures for all user roles.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {roles.map((role) => (
              <div
                key={role.key}
                className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] flex items-center justify-between shadow-sm transition hover:border-zinc-300 dark:hover:border-zinc-600"
              >
                <div className="flex items-center gap-x-3 min-w-0">
                  <UserRoleIcon role={role.key as UserRoleKey} showTooltip={false} />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {tr(role.label)}
                  </span>
                </div>
                <span
                  className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md shrink-0 ml-2"
                  style={{ backgroundColor: `${role.hexColor}15`, color: role.hexColor }}
                >
                  {role.hexColor}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-zinc-100 dark:bg-[#2b2d31] flex justify-end border-t border-zinc-200 dark:border-zinc-800">
          <Button onClick={handleClose} variant="secondary" className="px-5 text-xs font-semibold">
            {tr("rim.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

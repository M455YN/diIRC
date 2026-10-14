import { useMemo } from "react";
import * as z from "zod";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useParams, useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";

const buildFormSchema = (t: (key: string) => string) => z.object({
  nickname: z.string().min(1, {
    message: t("pm.nickRequired"),
  }),
});

type FormValues = z.infer<ReturnType<typeof buildFormSchema>>;

export const PrivateMessagesModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const navigate = useNavigate();
  const params = useParams();

  const servers = useMockStore((state) => state.servers);

  const isModalOpen = isOpen && type === "privateMessages";
  const { server: modalServer, serverId: modalServerId } = data;

  const activeServerId = params?.serverId || modalServerId || modalServer?.id || servers[0]?.id;

  const formSchema = useMemo(() => buildFormSchema(t), [t]);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nickname: "",
    },
  });

  const isLoading = form.formState.isSubmitting;

  const handleClose = () => {
    form.reset();
    onClose("privateMessages");
  };

  const onSubmit = async (values: FormValues) => {
    const cleanNick = values.nickname.trim().replace(/^@/, "");
    if (!cleanNick || !activeServerId) return;

    const store = useMockStore.getState();
    const targetMember = store.addServerMember(activeServerId, cleanNick);
    if (targetMember) {
      store.openConversation(activeServerId, targetMember.id);
      handleClose();
      navigate(`/servers/${activeServerId}/conversations/${targetMember.id}`);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 max-w-md overflow-hidden rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800">
        <DialogHeader className="pt-6 px-6 pb-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-x-2 text-zinc-900 dark:text-zinc-100">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            {t("pm.startTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {t("pm.startDesc")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="px-6 space-y-4">
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                      Nickname
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        placeholder={t("pm.placeholder")}
                        className="bg-zinc-100/50 dark:bg-[#1e1f22] border-zinc-200 dark:border-zinc-700/60 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="bg-zinc-100 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-3.5 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isLoading}
                className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white text-xs font-semibold"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 shadow-sm"
              >
                {t("pm.startChat")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

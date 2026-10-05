import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ChannelType } from "@/types";
import { useParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { HelpCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChannelInput } from "@/components/ui/channel-input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { MobileCreateChannelModal } from "@/components/mobile/mobile-channel-modals";

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Channel name is required."
  }),
  joinTemporary: z.boolean().default(false)
});

export const CreateChannelModal = () =>
  useIsMobileShell() ? <MobileCreateChannelModal /> : <DesktopCreateChannelModal />;

const DesktopCreateChannelModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const navigate = useNavigate();
  const params = useParams();
  const addChannel = useMockStore((state) => state.addChannel);
  const servers = useMockStore((state) => state.servers);

  const isModalOpen = isOpen && type === "createChannel";
  const { server: modalServer } = data;

  const activeServerId = params?.serverId || modalServer?.id || servers[0]?.id;

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      joinTemporary: false,
    }
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (activeServerId) {
        const cleanChannelName = values.name.trim().replace(/^#/, "");

        try {
          useMockStore.getState().setPendingJoin(activeServerId, cleanChannelName, undefined);
          const newChan = addChannel(activeServerId, cleanChannelName, ChannelType.TEXT, values.joinTemporary);
          await invoke("join_channel", {
            serverId: activeServerId,
            channel: cleanChannelName,
            password: null,
          });
          if (newChan?.id) {
            navigate(`/servers/${activeServerId}/channels/${newChan.id}`);
          }
          form.reset();
          onClose("createChannel");
        } catch (e) {
          console.error("Failed to join channel on IRC:", e);
          form.reset();
          onClose("createChannel");
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose("createChannel");
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl">
        <DialogHeader className="pt-6 px-6">
          <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100">
            Join channel
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
            <div className="space-y-4 px-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel
                      className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider"
                    >
                      Channel name
                    </FormLabel>
                    <FormControl>
                      <ChannelInput
                        disabled={isLoading}
                        placeholder="Enter channel name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="joinTemporary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-3.5 shadow-sm">
                    <div className="flex items-center gap-x-2">
                      <FormLabel className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 cursor-pointer">
                        Join temporarily
                      </FormLabel>
                      <TooltipProvider>
                        <Tooltip delayDuration={50}>
                          <TooltipTrigger type="button">
                            <HelpCircle className="w-4 h-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition cursor-pointer" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            When checked, you will NOT automatically rejoin this channel after restarting the application.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="bg-zinc-100/90 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isLoading}
                className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
              >
                Cancel
              </Button>
              <Button variant="primary" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 shadow-sm">
                Join
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useModal } from "@/hooks/use-modal-store";
import { copyToClipboard } from "@/lib/system-utils";

/**
 * A dialog an extension asked for. The extension only describes it (title, text, fields, buttons, a link to copy);
 * this component draws it, and always says which extension it comes from.
 */
export const ExtensionDialogModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const dialog = isOpen && type === "extensionDialog" ? data.extDialog : undefined;
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  // A new dialog starts from the values the extension suggested.
  useEffect(() => {
    if (!dialog) return;
    setValues(Object.fromEntries(dialog.spec.fields.map((field) => [field.name, field.value])));
    setCopied(false);
    setSendState("idle");
  }, [dialog]);

  const finish = (button: string) => {
    if (!dialog) return;
    dialog.resolve({ button, values });
    onClose("extensionDialog");
  };

  const send = async () => {
    if (!dialog?.send) return;
    setSendState("sending");
    try {
      await dialog.send.run();
      setSendState("sent");
    } catch (error) {
      console.error("Failed to send an extension's message:", error);
      setSendState("failed");
    }
  };

  const missing = dialog?.spec.fields.some((field) => field.required && !(values[field.name] ?? "").trim());
  const copyText = dialog?.spec.copyText ?? dialog?.spec.link;

  return (
    <Dialog open={Boolean(dialog)} onOpenChange={(next) => !next && finish("dismiss")}>
      <DialogContent className="sm:max-w-xl bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
        {dialog && (
          <>
            <DialogHeader>
              <DialogTitle>{dialog.spec.title}</DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("extensions.dialogFrom", { name: dialog.extensionName })}
              </DialogDescription>
            </DialogHeader>

            {dialog.spec.text && (
              <p className="whitespace-pre-wrap break-words select-text text-sm text-zinc-700 dark:text-zinc-300">
                {dialog.spec.text}
              </p>
            )}

            {dialog.spec.fields.map((field) => (
              <div key={field.name} className="space-y-1.5">
                {field.label && <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{field.label}</label>}
                {field.type === "textarea" ? (
                  <Textarea
                    rows={12}
                    className="font-mono text-xs"
                    value={values[field.name] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    autoFocus
                  />
                ) : (
                  <Input
                    value={values[field.name] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                  />
                )}
              </div>
            ))}

            {dialog.spec.link && (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs break-all select-text dark:border-zinc-700 dark:bg-[#2b2d31]">
                {dialog.spec.link}
              </div>
            )}

            {dialog.send && dialog.spec.sendText && dialog.spec.sendText !== dialog.spec.link && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("extensions.willSend")} <span className="font-mono break-all select-text">{dialog.spec.sendText}</span>
              </p>
            )}
            {sendState === "failed" && <p className="text-xs text-rose-500">{t("extensions.sendFailed")}</p>}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {copyText && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyToClipboard(copyText).then((ok) => setCopied(ok))}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {copied ? t("extensions.copied") : dialog.spec.link ? t("extensions.copyLink") : t("extensions.copy")}
                </Button>
              )}
              {dialog.send && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sendState === "sending" || sendState === "sent"}
                  onClick={() => void send()}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {sendState === "sent" ? t("extensions.sent") : dialog.send.label}
                </Button>
              )}
              {dialog.spec.buttons.map((button) => (
                <Button
                  key={button.id}
                  type="button"
                  size="sm"
                  variant={button.primary ? "default" : "outline"}
                  disabled={button.primary && missing}
                  onClick={() => finish(button.id)}
                >
                  {button.label}
                </Button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

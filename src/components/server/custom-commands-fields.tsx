import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { Control, useFieldArray } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FileJson, Plus, Trash } from "lucide-react";

interface CustomCommandsFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  disabled?: boolean;
}

type FormCommandRow = {
  trigger: string;
  message: string;
  description: string;
  suggestions: string;
};

function parseSuggestions(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((s) => String(s || "").trim()).filter(Boolean).join(", ");
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

/** Accepts an array, a single command object, or `{ customCommands: [...] }`. */
export function parseCustomCommandsJson(raw: unknown): FormCommandRow[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as any).customCommands)
    ? (raw as any).customCommands
    : raw &&
      typeof raw === "object" &&
      (typeof (raw as any).trigger === "string" ||
        typeof (raw as any).slash === "string" ||
        typeof (raw as any).name === "string" ||
        typeof (raw as any).message === "string" ||
        typeof (raw as any).sends === "string")
    ? [raw]
    : null;

  if (!list) {
    throw new Error(
      'JSON must be a command object, an array of commands, or { "customCommands": [...] }.'
    );
  }

  const rows = list
    .map((item: any) => {
      const trigger = String(item?.trigger ?? item?.slash ?? item?.name ?? "")
        .replace(/^\//, "")
        .trim();
      const message = String(item?.message ?? item?.sends ?? item?.text ?? "").trim();
      const description = String(item?.description ?? item?.desc ?? "").trim();
      const suggestions = parseSuggestions(item?.suggestions ?? item?.args ?? item?.options);
      return { trigger, message, description, suggestions };
    })
    .filter((c: FormCommandRow) => c.trigger && c.message && !/\s/.test(c.trigger));

  if (rows.length === 0) {
    throw new Error("No valid commands found in the JSON file.");
  }

  return rows;
}

export const CustomCommandsFields = ({
  control,
  disabled,
}: CustomCommandsFieldsProps) => {
  const { t: tr } = useTranslation();
  const { fields, append, remove, replace } = useFieldArray({
    name: "customCommands",
    control,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleLoadJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rows = parseCustomCommandsJson(parsed);
      replace(rows);
    } catch (err: any) {
      const message =
        err instanceof SyntaxError
          ? "Invalid JSON file."
          : err?.message || tr("cb.loadCommandsFailed");
      setImportError(message);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider flex items-center justify-between">
        {tr("cb.customCommands")}
        <span className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            title={tr("cb.loadFromJson")}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 text-[11px] font-semibold normal-case tracking-normal text-zinc-500 hover:text-indigo-500 dark:text-zinc-400 dark:hover:text-indigo-400 transition disabled:opacity-50"
          >
            <FileJson className="w-3.5 h-3.5" />
            {tr("cb.loadFromJson")}
          </button>
          <Plus
            className="w-4 h-4 cursor-pointer text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition"
            onClick={() =>
              append({ trigger: "", message: "", description: "", suggestions: "" })
            }
          />
        </span>
      </FormLabel>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleLoadJson}
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-1 mb-1">
        {tr("cb.mapCommandDesc")}
        {tr("cb.optionalDesc")}
        {tr("cb.canLoadJson")}
      </p>

      {importError && (
        <p className="text-xs text-rose-500 dark:text-rose-400">{importError}</p>
      )}

      {fields.length === 0 && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
          {tr("cb.noCommands")}
        </p>
      )}

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700/60 p-3 space-y-2 bg-zinc-50/50 dark:bg-[#2b2d31]/40"
        >
          <div className="flex items-start gap-2">
            <FormField
              control={control}
              name={`customCommands.${index}.trigger`}
              render={({ field }) => (
                <FormItem className="flex-1 space-y-1">
                  <FormLabel className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {tr("cb.slashCommand")}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm select-none">
                        /
                      </span>
                      <Input
                        disabled={disabled}
                        className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10 pl-6"
                        placeholder={tr("cb.commandPlaceholder")}
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.replace(/^\/*/, "").replace(/\s+/g, ""))
                        }
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`customCommands.${index}.message`}
              render={({ field }) => (
                <FormItem className="flex-[1.4] space-y-1">
                  <FormLabel className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {tr("cb.sendsAs")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={disabled}
                      className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                      placeholder={tr("cb.sendsAsPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Trash
              className="w-4 h-4 cursor-pointer text-zinc-400 hover:text-rose-500 transition shrink-0 mt-7"
              onClick={() => remove(index)}
            />
          </div>
          <FormField
            control={control}
            name={`customCommands.${index}.description`}
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Description
                </FormLabel>
                <FormControl>
                  <Input
                    disabled={disabled}
                    className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                    placeholder={tr("cb.shortDescPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`customCommands.${index}.suggestions`}
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Suggestions
                </FormLabel>
                <FormControl>
                  <Input
                    disabled={disabled}
                    className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                    placeholder={tr("cb.optionsPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {tr("cb.commaArgs")}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ))}
    </div>
  );
};

export function normalizeCustomCommandsFromForm(
  items:
    | { trigger: string; message: string; description?: string; suggestions?: string }[]
    | undefined
) {
  if (!items?.length) return [];
  return items
    .map((c) => {
      const description = String(c.description || "").trim();
      return {
        trigger: c.trigger.replace(/^\//, "").trim(),
        message: c.message.trim(),
        ...(description ? { description } : {}),
        suggestions: String(c.suggestions || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    })
    .filter((c) => c.trigger && c.message && !/\s/.test(c.trigger));
}

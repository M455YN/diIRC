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
import { AtSign, ExternalLink, FileJson, MessageSquare, Plus, Trash, X } from "lucide-react";
import {
  emptyFormCommand,
  emptyFormStep,
  fromFormSteps,
  toFormSteps,
  type FormCommandRow,
  type FormStep,
} from "@/lib/commands/custom-command-steps";
import type { CommandStep } from "@/types";

interface CustomCommandsFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  disabled?: boolean;
}


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
        typeof (raw as any).steps === "object" ||
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
      const rawSteps: any[] = Array.isArray(item?.steps) ? item.steps : [];
      const steps: FormStep[] = rawSteps.length
        ? toFormSteps({
            message: "",
            steps: rawSteps
              .map((s: any): CommandStep | null => {
                const type = String(s?.type || "message");
                if (type === "mention")
                  return { type: "mention", target: String(s?.target ?? s?.nick ?? ""), text: String(s?.text ?? "") };
                if (type === "openUrl" || type === "url")
                  return { type: "openUrl", url: String(s?.url ?? "") };
                return { type: "message", text: String(s?.text ?? s?.message ?? "") };
              })
              .filter((s): s is CommandStep => s !== null),
          })
        : toFormSteps({ message });
      return { trigger, description, suggestions, steps } as FormCommandRow;
    })
    .filter(
      (c: FormCommandRow) =>
        c.trigger && !/\s/.test(c.trigger) && fromFormSteps(c.steps).length > 0
    );

  if (rows.length === 0) {
    throw new Error("No valid commands found in the JSON file.");
  }

  return rows;
}

const STEP_TYPE_OPTIONS: { value: FormStep["type"]; label: string; icon: typeof MessageSquare }[] = [
  { value: "message", label: "cb.stepMessage", icon: MessageSquare },
  { value: "mention", label: "cb.stepMention", icon: AtSign },
  { value: "openUrl", label: "cb.stepOpenUrl", icon: ExternalLink },
];

const inputClass =
  "bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 h-9 text-sm";

/** Steps of one command: one line per step, new steps are added by type with the buttons below. */
const StepsEditor = ({
  control,
  commandIndex,
  disabled,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  commandIndex: number;
  disabled?: boolean;
}) => {
  const { t: tr } = useTranslation();
  const { fields, append, remove } = useFieldArray({
    name: `customCommands.${commandIndex}.steps`,
    control,
  });

  return (
    <div className="space-y-2">
      {fields.map((stepField, stepIndex) => {
        const base = `customCommands.${commandIndex}.steps.${stepIndex}`;
        const type = (stepField as unknown as FormStep).type;
        const option = STEP_TYPE_OPTIONS.find((o) => o.value === type) ?? STEP_TYPE_OPTIONS[0];
        const Icon = option.icon;
        return (
          <div key={stepField.id} className="flex items-center gap-2">
            <span
              title={tr(option.label)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
            >
              <Icon className="h-4 w-4" />
            </span>
            {type === "message" && (
              <FormField
                control={control}
                name={`${base}.text`}
                render={({ field }) => (
                  <Input
                    disabled={disabled}
                    className={inputClass}
                    placeholder={tr("cb.stepMessagePlaceholder")}
                    {...field}
                  />
                )}
              />
            )}
            {type === "mention" && (
              <>
                <FormField
                  control={control}
                  name={`${base}.target`}
                  render={({ field }) => (
                    <Input
                      disabled={disabled}
                      className={`${inputClass} w-36 shrink-0`}
                      placeholder={tr("cb.stepMentionTarget")}
                      {...field}
                    />
                  )}
                />
                <FormField
                  control={control}
                  name={`${base}.text`}
                  render={({ field }) => (
                    <Input
                      disabled={disabled}
                      className={inputClass}
                      placeholder={tr("cb.stepMentionText")}
                      {...field}
                    />
                  )}
                />
              </>
            )}
            {type === "openUrl" && (
              <FormField
                control={control}
                name={`${base}.url`}
                render={({ field }) => (
                  <Input
                    disabled={disabled}
                    className={inputClass}
                    placeholder={tr("cb.stepUrlPlaceholder")}
                    {...field}
                  />
                )}
              />
            )}
            <button
              type="button"
              disabled={disabled || fields.length <= 1}
              title={tr("cb.removeStep")}
              aria-label={tr("cb.removeStep")}
              onClick={() => remove(stepIndex)}
              className="shrink-0 text-zinc-400 hover:text-rose-500 transition disabled:opacity-30"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{tr("cb.addStep")}:</span>
        {STEP_TYPE_OPTIONS.map(({ value, label, icon: StepIcon }) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => append(emptyFormStep(value))}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition disabled:opacity-50"
          >
            <StepIcon className="h-3 w-3" />
            {tr(label)}
          </button>
        ))}
      </div>
    </div>
  );
};

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
              append(emptyFormCommand())
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
      <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-1 mb-1">{tr("cb.stepsHint")}</p>

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
            <Trash
              className="w-4 h-4 cursor-pointer text-zinc-400 hover:text-rose-500 transition shrink-0 mt-7"
              onClick={() => remove(index)}
            />
          </div>
          <StepsEditor control={control} commandIndex={index} disabled={disabled} />
          <details className="group">
            <summary className="cursor-pointer select-none text-[11px] font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
              {tr("cb.moreOptions")}
            </summary>
            <div className="space-y-2 pt-2">
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
          </details>
        </div>
      ))}
    </div>
  );
};

export function normalizeCustomCommandsFromForm(
  items:
    | { trigger: string; description?: string; suggestions?: string; steps?: FormStep[] }[]
    | undefined
) {
  if (!items?.length) return [];
  const result: {
    trigger: string;
    message: string;
    steps?: CommandStep[];
    description?: string;
    suggestions: string[];
  }[] = [];
  for (const c of items) {
    const trigger = c.trigger.replace(/^\//, "").trim();
    const steps = fromFormSteps(c.steps);
    if (!trigger || /\s/.test(trigger) || steps.length === 0) continue;
    const description = String(c.description || "").trim();
    const firstMessage = steps.find((step) => step.type === "message");
    const isPlainMessage = steps.length === 1 && steps[0].type === "message";
    result.push({
      trigger,
      message: firstMessage && firstMessage.type === "message" ? firstMessage.text : "",
      // A single message stays in the original shape so older data and exports keep working.
      ...(isPlainMessage ? {} : { steps }),
      ...(description ? { description } : {}),
      suggestions: String(c.suggestions || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }
  return result;
}

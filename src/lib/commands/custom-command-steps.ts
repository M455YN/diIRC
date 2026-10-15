import type { CommandStep, CustomCommand } from "@/types";

/** One editable step as the server forms keep it (all fields are strings so inputs stay controlled). */
export interface FormStep {
  type: CommandStep["type"];
  text: string;
  target: string;
  url: string;
}

export interface FormCommandRow {
  trigger: string;
  description: string;
  suggestions: string;
  steps: FormStep[];
}

export const COMMAND_STEP_TYPES: CommandStep["type"][] = ["message", "mention", "openUrl"];

export const emptyFormStep = (type: CommandStep["type"] = "message"): FormStep => ({
  type,
  text: "",
  target: "",
  url: "",
});

export const emptyFormCommand = (): FormCommandRow => ({
  trigger: "",
  description: "",
  suggestions: "",
  steps: [emptyFormStep("message")],
});

const isStepComplete = (step: CommandStep): boolean => {
  if (step.type === "message") return !!step.text.trim();
  if (step.type === "mention") return !!step.target.trim();
  return !!step.url.trim();
};

/** The steps of a command. Commands saved before workflows had a single `message` template. */
export function getCommandSteps(command: Pick<CustomCommand, "message" | "steps">): CommandStep[] {
  if (Array.isArray(command.steps) && command.steps.length > 0) {
    return command.steps.filter(isStepComplete);
  }
  const message = (command.message || "").trim();
  return message ? [{ type: "message", text: message }] : [];
}

export function toFormSteps(command: Pick<CustomCommand, "message" | "steps">): FormStep[] {
  const steps = getCommandSteps(command);
  if (steps.length === 0) return [emptyFormStep("message")];
  return steps.map((step) => ({
    ...emptyFormStep(step.type),
    ...(step.type === "message" ? { text: step.text } : {}),
    ...(step.type === "mention" ? { target: step.target, text: step.text || "" } : {}),
    ...(step.type === "openUrl" ? { url: step.url } : {}),
  }));
}

/** Form rows to stored steps; incomplete steps are dropped. */
export function fromFormSteps(steps: FormStep[] | undefined): CommandStep[] {
  const out: CommandStep[] = [];
  for (const step of steps || []) {
    if (step.type === "message") {
      const text = (step.text || "").trim();
      if (text) out.push({ type: "message", text });
    } else if (step.type === "mention") {
      const target = (step.target || "").trim().replace(/^@/, "");
      const text = (step.text || "").trim();
      if (target) out.push({ type: "mention", target, ...(text ? { text } : {}) });
    } else if (step.type === "openUrl") {
      const url = (step.url || "").trim();
      if (url) out.push({ type: "openUrl", url });
    }
  }
  return out;
}

/** Short text for autocomplete hints, e.g. `Hello $1 · @Kasia · ↗ https://example.com`. */
export function describeSteps(steps: CommandStep[]): string {
  return steps
    .map((step) => {
      if (step.type === "message") return step.text;
      if (step.type === "mention") return `@${step.target}${step.text ? ` ${step.text}` : ""}`;
      return `↗ ${step.url}`;
    })
    .join(" · ");
}

/** What `ext_list` returns: the manifest from the first comment of an extension file (see src-tauri/src/extensions.rs). */
export interface ExtensionSetting {
  key: string;
  label: string;
  type: "text" | "boolean";
  default?: string | boolean;
  placeholder?: string;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  api: number;
  permissions: { network: string[] };
  settings: ExtensionSetting[];
}

export type SettingValue = string | boolean;

/** A dialog an extension asks the app to draw. The app, not the extension, renders it. */
export interface DialogField {
  name: string;
  label?: string;
  type: "text" | "textarea";
  value: string;
  placeholder?: string;
  required: boolean;
}

export interface DialogButton {
  id: string;
  label: string;
  primary: boolean;
}

export interface DialogSpec {
  title: string;
  text?: string;
  fields: DialogField[];
  /** Shown as plain text with a copy button; never opened by the app on the extension's behalf. */
  link?: string;
  copyText?: string;
  /** One line the user can send to the chat the command was run in, with a button the app draws. */
  sendText?: string;
  buttons: DialogButton[];
}

export interface DialogResult {
  button: string;
  values: Record<string, string>;
}

/** Handed to the modal store; the dialog modal calls `resolve` when it closes. */
export interface ExtensionDialogData {
  extensionName: string;
  spec: DialogSpec;
  /** Present when the dialog has `sendText` and the command was run in a chat: the app's own send button. */
  send?: { label: string; run: () => Promise<void> };
  resolve: (result: DialogResult) => void;
}

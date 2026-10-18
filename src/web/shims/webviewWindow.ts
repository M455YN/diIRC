// A browser tab is always "the window"; focus comes from the document.
const win = {
  isFocused: async () => document.hasFocus(),
  listen: async () => () => undefined,
  onDragDropEvent: async () => () => undefined,
  requestUserAttention: async () => undefined,
};
export const getCurrentWindow = () => win;
export const getCurrentWebviewWindow = () => win;
export const UserAttentionType = { Critical: 1, Informational: 2 };

// Runs inside the sandboxed extension iframe (served by the loopback server in src-tauri/src/extensions.rs).
// It defines `luna`, the only way an extension talks to the app: every call is a message the host checks.
(() => {
  let seq = 0;
  const pending = new Map();
  const commands = new Map();

  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      parent.postMessage({ luna: 1, id, method, params }, "*");
    });

  addEventListener("message", (event) => {
    if (event.source !== parent) return;
    const message = event.data;
    if (!message || message.luna !== 1) return;
    if (message.reply) {
      const waiting = pending.get(message.id);
      if (!waiting) return;
      pending.delete(message.id);
      if (message.error) waiting.reject(new Error(message.error));
      else waiting.resolve(message.result);
    } else if (message.event === "command") {
      const run = commands.get(message.name);
      if (run) Promise.resolve(run(message.args)).catch((error) => call("log", { text: String((error && error.message) || error) }));
    }
  });

  window.luna = Object.freeze({
    api: 1,
    commands: {
      // Adds /name; `run(args)` gets the text typed after the command.
      register(name, description, run) {
        commands.set(name, run);
        return call("commands.register", { name, description });
      },
    },
    ui: {
      // Shows a dialog drawn by the app: { title, text, fields: [{ name, label, type, value }], link, copyText, sendText, buttons: [{ id, label, primary }] }.
      // `sendText` (one line, up to 400 characters) adds a button that sends it to the chat the command was run in;
      // the app does that only when the user clicks it.
      // Resolves to { button, values }.
      dialog: (spec) => call("ui.dialog", spec),
    },
    // This extension's settings (as declared in the manifest) with the user's values.
    settings: { get: () => call("settings.get") },
    // { url, method, headers: [[name, value]], body } -> { status, headers: [[name, value]], body }. Only hosts the user granted.
    http: { request: (request) => call("http.request", request) },
  });

  call("ready").catch(() => {});
})();

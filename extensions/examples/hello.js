/* luna-extension
{
  "id": "hello-example",
  "name": "Hello (example)",
  "version": "1.0.0",
  "author": "Luna IRC",
  "description": "Example extension: /hello asks for a name and greets it. No network access.",
  "api": 1,
  "permissions": { "network": [] },
  "settings": [
    { "key": "greeting", "label": "Greeting", "type": "text", "placeholder": "Hello", "default": "Hello" }
  ]
}
*/

// The first comment above is the manifest. Install this file from Luna features → Extensions → Add from file.
// Everything the extension can do is on the `luna` object; see docs/extensions.md.

luna.commands.register("hello", "Greets a name", async (args) => {
  const { greeting } = await luna.settings.get();
  const asked = await luna.ui.dialog({
    title: "Say hello",
    fields: [{ name: "name", label: "Name", type: "text", value: args || "", required: true }],
    buttons: [
      { id: "cancel", label: "Cancel" },
      { id: "go", label: "Greet", primary: true },
    ],
  });
  if (asked.button !== "go") return;
  await luna.ui.dialog({
    title: greeting + ", " + asked.values.name + "!",
    copyText: greeting + ", " + asked.values.name + "!",
    sendText: greeting + ", " + asked.values.name + "!", // adds a "send to this chat" button; the app sends it only when you click
    buttons: [{ id: "ok", label: "Close", primary: true }],
  });
});

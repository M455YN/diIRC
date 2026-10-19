# Luna IRC extensions

An extension is **one `.js` file** that adds commands to Luna. Install it from *Luna features → Extensions → Add from file* (the orbit button in the left bar).
Extensions work in the desktop app only. A working example is [`extensions/examples/hello.js`](../extensions/examples/hello.js).

## File format

The file starts with a comment holding a JSON manifest, followed by the code:

```js
/* luna-extension
{
  "id": "my-extension",            // 2-40 characters: a-z, 0-9, -
  "name": "My extension",
  "version": "1.0.0",
  "author": "You",                 // optional
  "description": "What it does.",  // optional
  "api": 1,
  "permissions": { "network": ["example.org"] },   // hosts it may reach, "host" or "host:port"
  "settings": [                                     // shown in Luna features → Extensions, up to 20
    { "key": "url", "label": "Server", "type": "text", "placeholder": "https://…", "default": "" },
    { "key": "verbose", "label": "Verbose", "type": "boolean", "default": false }
  ]
}
*/
luna.commands.register("mycommand", "Does something", async (args) => { /* … */ });
```

## The `luna` object

Everything an extension can do. Each call goes to the app, which checks it.

| Call | What it does |
|---|---|
| `luna.commands.register(name, description, run)` | Adds `/name`. `run(args)` receives the text typed after it. |
| `luna.ui.dialog({ title, text, fields, link, copyText, buttons })` | Shows a dialog drawn by the app and resolves to `{ button, values }`. Fields are `{ name, label, type: "text"\|"textarea", value, placeholder, required }`; `link` is shown as text with a copy button; `sendText` (one line, up to 400 characters) adds a "send to this chat" button that the app draws and handles, so nothing is sent without the user's click; `buttons` are `{ id, label, primary }`. Closing the dialog gives `button: "dismiss"`. |
| `luna.settings.get()` | The extension's settings with the user's values (or the manifest defaults). |
| `luna.http.request({ url, method, headers, body })` | One HTTP request, resolving to `{ status, headers: [[name, value]], body }`. Only hosts listed in `permissions.network` (and approved at install). Redirects are **not** followed: read `Location` yourself. |

## Security model

* The file runs in a hidden **sandboxed iframe** whose document comes from a small server the app runs on
  `127.0.0.1` (random port, loopback only) with `Content-Security-Policy: default-src 'none'`. The browser itself blocks
  its network access, storage, popups and access to the app's page. `postMessage` to the app is the only channel, and
  `luna` is the only API on it.
* Tauri's own check also keeps it out of the app's commands: a page from `127.0.0.1` is a *remote* origin, and Tauri
  rejects commands from remote origins unless a capability allows them (none does). The app's own protocol would not do:
  Tauri treats pages from a protocol the app registers as the app itself.
* `permissions.network` is shown at install time and enforced by the app on every `luna.http.request`.
* A server whose certificate the system does not trust (typically a company's own certificate authority) makes the app ask
  the user, in a dialog the extension cannot change, whether to trust that exact certificate (its SHA-256 fingerprint).
  After that the extension talks only to a server presenting that certificate; any other one is refused before data is sent.
  *Luna features → Extensions* lists trusted certificates and can forget them.
* An extension still runs code you chose to install. Install files only from a source you trust.

## Not (yet) available

Reading chat events, sending messages, a store or update channel. Extensions are limited to commands, dialogs,
settings and network for now.

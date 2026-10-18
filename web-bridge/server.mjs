// Luna IRC web bridge: serves ../dist-web and relays WebSocket frames <-> an IRC TCP/TLS socket
// (one frame = one IRC line). Needed for servers without IRC-over-WebSocket, e.g. ZNC.
//
//   BRIDGE_TOKEN   required shared secret (the client sends it as ?token=)
//   BRIDGE_HOSTS   optional comma list of allowed IRC hosts (default: any)
//   PORT           HTTP port (default 8080); put a TLS reverse proxy in front for HTTPS/WSS
import http from "node:http";
import net from "node:net";
import tls from "node:tls";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const TOKEN = process.env.BRIDGE_TOKEN;
if (!TOKEN) {
  console.error("Set BRIDGE_TOKEN (an open TCP relay without a secret is a security hole).");
  process.exit(1);
}
const HOSTS = (process.env.BRIDGE_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist-web");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let file = path.join(ROOT, path.normalize(decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html");
  res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "cache-control": file.endsWith("sw.js") ? "no-cache" : "public, max-age=300" });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  const host = url.searchParams.get("host") ?? "";
  const port = Number(url.searchParams.get("port"));
  const ok = url.pathname === "/irc" && url.searchParams.get("token") === TOKEN && host && port > 0 && port < 65536 && (!HOSTS.length || HOSTS.includes(host.toLowerCase()));
  if (!ok) { socket.write("HTTP/1.1 403 Forbidden\r\n\r\n"); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => relay(ws, host, port, url.searchParams.get("tls") === "1"));
});

function relay(ws, host, port, useTls) {
  const sock = useTls ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
  let buf = "";
  sock.setEncoding("utf8");
  sock.on("data", (d) => {
    buf += d;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const l of lines) if (l && ws.readyState === ws.OPEN) ws.send(l);
  });
  sock.on("error", () => ws.close());
  sock.on("close", () => ws.close());
  ws.on("message", (m) => sock.writable && sock.write(String(m).replace(/[\r\n]+/g, " ") + "\r\n"));
  ws.on("close", () => sock.destroy());
  ws.on("error", () => sock.destroy());
}

server.listen(Number(process.env.PORT ?? 8080), () => console.log(`Luna web bridge on :${process.env.PORT ?? 8080}`));

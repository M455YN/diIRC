import { invoke } from "@tauri-apps/api/core";

const SEND_SPACING_MS = 400;

let chain: Promise<void> = Promise.resolve();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Sends a Luna CTCP (`body` is the whole payload, e.g. `LUNA HELLO 0.3.5 react`). Every Luna-to-Luna
 * feature goes through this one queue, so a burst (a big channel, many replies) is spread out
 * instead of tripping the server's flood protection.
 */
export function sendLunaCtcp(serverId: string, target: string, body: string, notice = false) {
  chain = chain
    .then(() => invoke("send_ctcp", { serverId, target, body, notice }))
    .then(
      () => undefined,
      (error) => console.warn("Luna CTCP failed:", error)
    )
    .then(() => sleep(SEND_SPACING_MS));
}

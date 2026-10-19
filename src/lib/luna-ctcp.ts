import { invoke } from "@tauri-apps/api/core";

const SEND_SPACING_MS = 400;

interface Job {
  serverId: string;
  target: string;
  body: string;
  notice: boolean;
  urgent: boolean;
}

const queue: Job[] = [];
let draining = false;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function drain() {
  if (draining) return;
  draining = true;
  try {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { serverId, target, body, notice } = job;
      try {
        await invoke("send_ctcp", { serverId, target, body, notice });
      } catch (error) {
        console.warn("Luna CTCP failed:", error);
      }
      await sleep(SEND_SPACING_MS);
    }
  } finally {
    draining = false;
  }
}

/**
 * Sends a Luna CTCP (`body` is the whole payload, e.g. `LUNA HELLO 0.3.5 react`). Every Luna-to-Luna
 * feature goes through this one queue, so a burst (a big channel, many replies) is spread out
 * instead of tripping the server's flood protection. `urgent` jumps ahead of the waiting jobs (but
 * keeps the order among urgent ones), so something the user just did is not stuck behind a backlog.
 * `target` must be a nick: these CTCPs are never sent to a channel, where everybody would see them.
 */
export function sendLunaCtcp(serverId: string, target: string, body: string, notice = false, urgent = false) {
  if (/^[#&+!]/.test(target)) {
    console.warn("Luna CTCPs are never sent to a channel:", target);
    return;
  }
  const job: Job = { serverId, target, body, notice, urgent };
  if (urgent) {
    let at = 0;
    while (at < queue.length && queue[at].urgent) at++;
    queue.splice(at, 0, job);
  } else {
    queue.push(job);
  }
  void drain();
}

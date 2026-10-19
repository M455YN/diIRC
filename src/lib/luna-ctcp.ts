import { invoke } from "@tauri-apps/api/core";
import { logLuna } from "@/hooks/use-luna-log-store";

/** Slower than the backend's own limit (15 lines per 8 s), so a backlog never builds up there in front of the user's own messages. */
export const SEND_SPACING_MS = 600;
/**
 * Per server: what would wait beyond this is dropped (the peers ask again later), so a burst of reactions,
 * probes or avatar requests can never turn into minutes of traffic.
 */
const MAX_WAITING = 100;

interface Job {
  run: () => Promise<void>;
  urgent: boolean;
}

interface Lane {
  jobs: Job[];
  draining: boolean;
}

// One lane per server, so a backlog on one server never delays another.
const lanes = new Map<string, Lane>();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function drain(lane: Lane) {
  if (lane.draining) return;
  lane.draining = true;
  try {
    for (let job = lane.jobs.shift(); job; job = lane.jobs.shift()) {
      await job.run();
      await sleep(SEND_SPACING_MS);
    }
  } finally {
    lane.draining = false;
  }
}

/** Queues `run` for the server; false when the lane is full. `urgent` jumps ahead of the waiting jobs (keeping the order among urgent ones). */
function enqueue(serverId: string, run: () => Promise<void>, urgent: boolean): boolean {
  let lane = lanes.get(serverId);
  if (!lane) {
    lane = { jobs: [], draining: false };
    lanes.set(serverId, lane);
  }
  if (lane.jobs.length >= MAX_WAITING) return false;
  const job: Job = { run, urgent };
  if (urgent) {
    let at = 0;
    while (at < lane.jobs.length && lane.jobs[at].urgent) at++;
    lane.jobs.splice(at, 0, job);
  } else {
    lane.jobs.push(job);
  }
  void drain(lane);
  return true;
}

/** Forgets what still waits for the server (it disconnected: those lines could only fail). */
export function clearLunaQueue(serverId: string) {
  const lane = lanes.get(serverId);
  if (lane) lane.jobs.length = 0;
}

/** Runs `task` in the server's send queue, spaced like the CTCPs, and returns its result. Rejects when the queue is full. */
export function runQueued<T>(serverId: string, task: () => Promise<T>, urgent = false): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const queued = enqueue(
      serverId,
      async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      },
      urgent
    );
    if (!queued) reject(new Error("Luna send queue is full"));
  });
}

/**
 * Sends a Luna CTCP (`body` is the whole payload, e.g. `LUNA HELLO 0.3.5 react`). Every Luna-to-Luna
 * feature goes through the server's queue, so a burst (a big channel, many replies) is spread out
 * instead of tripping the server's flood protection. `urgent` jumps ahead of the waiting jobs (but
 * keeps the order among urgent ones), so something the user just did is not stuck behind a backlog.
 * `target` must be a nick: these CTCPs are never sent to a channel, where everybody would see them.
 */
export function sendLunaCtcp(serverId: string, target: string, body: string, notice = false, urgent = false) {
  if (/^[#&+!]/.test(target)) {
    console.warn("Luna CTCPs are never sent to a channel:", target);
    return;
  }
  const queued = enqueue(
    serverId,
    async () => {
      try {
        await invoke("send_ctcp", { serverId, target, body, notice });
        logLuna(serverId, "tx", `CTCP ${target} ${body}`);
      } catch (error) {
        console.warn("Luna CTCP failed:", error);
        logLuna(serverId, "tx", `CTCP ${target} ${body} (failed: ${String(error)})`);
        // Not connected: everything behind it would fail the same way.
        if (String(error).includes("Not connected")) clearLunaQueue(serverId);
      }
    },
    urgent
  );
  if (!queued) logLuna(serverId, "tx", `CTCP ${target} ${body} (dropped: send queue full)`);
}

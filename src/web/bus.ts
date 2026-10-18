// Stand-in for Tauri's event bus: the web IRC client emits here, shimmed `listen` subscribes.
type Handler = (event: { payload: any }) => void;
const handlers = new Map<string, Set<Handler>>();

export function emit(name: string, payload?: unknown): void {
  handlers.get(name)?.forEach((h) => {
    try {
      h({ payload });
    } catch (e) {
      console.error(`[bus] ${name} handler failed`, e);
    }
  });
}

export function on(name: string, handler: Handler): () => void {
  if (!handlers.has(name)) handlers.set(name, new Set());
  handlers.get(name)!.add(handler);
  return () => handlers.get(name)?.delete(handler);
}

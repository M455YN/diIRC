import { emit as busEmit, on } from "../bus";
export type UnlistenFn = () => void;
export const listen = async <T,>(name: string, cb: (e: { payload: T }) => void): Promise<UnlistenFn> => on(name, cb);
export const emit = async (name: string, payload?: unknown) => busEmit(name, payload);

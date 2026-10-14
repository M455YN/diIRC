import { create } from "zustand";
import { persist } from "zustand/middleware";

/** A general note: not tied to a channel or a person. Stored only on this device. */
export interface GeneralNote {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

interface NotesStore {
  notes: GeneralNote[];
  add: () => string;
  update: (id: string, patch: Partial<Pick<GeneralNote, "title" | "body">>) => void;
  remove: (id: string) => void;
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useNotesStore = create<NotesStore>()(
  persist(
    (set) => ({
      notes: [],
      add: () => {
        const id = newId();
        set((state) => ({
          notes: [{ id, title: "", body: "", updatedAt: Date.now() }, ...state.notes],
        }));
        return id;
      },
      update: (id, patch) =>
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
        })),
      remove: (id) => set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),
    }),
    { name: "general-notes" }
  )
);

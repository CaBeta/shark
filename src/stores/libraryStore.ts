import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import type { Library } from '@/lib/types';

interface LibraryState {
  libraries: Library[];
  activeLibraryId: string | null;
}

interface LibraryActions {
  setLibraries: (libraries: Library[]) => void;
  setActiveLibrary: (id: string | null) => void;
  addLibrary: (library: Library) => void;
  loadLibraries: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState & LibraryActions>()(
  persist(
    (set) => ({
      libraries: [],
      activeLibraryId: null,

      setLibraries: (libraries) => set({ libraries }),

      setActiveLibrary: (id) => set({ activeLibraryId: id }),

      addLibrary: (library) =>
        set((state) => ({ libraries: [...state.libraries, library] })),

      loadLibraries: async () => {
        const libraries = await invoke<Library[]>('list_libraries');
        set({ libraries });
      },
    }),
    {
      name: 'shark-library-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        libraries: state.libraries,
        activeLibraryId: state.activeLibraryId,
      }),
    },
  ),
);

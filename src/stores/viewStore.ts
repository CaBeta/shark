import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ViewState {
  gridSize: number;
  sidebarOpen: boolean;
  viewMode: 'grid' | 'list';
}

interface ViewActions {
  setGridSize: (size: number) => void;
  toggleSidebar: () => void;
  setViewMode: (mode: 'grid' | 'list') => void;
}

export const useViewStore = create<ViewState & ViewActions>()(
  persist(
    (set) => ({
      gridSize: 200,
      sidebarOpen: true,
      viewMode: 'grid' as const,

      setGridSize: (size) => set({ gridSize: size }),

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setViewMode: (mode) => set({ viewMode: mode }),
    }),
    {
      name: 'shark-view-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

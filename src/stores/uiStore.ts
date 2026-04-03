import { create } from 'zustand';

interface ContextMenu {
  x: number;
  y: number;
  itemId: string;
}

interface UiState {
  viewerOpen: boolean;
  viewerItemId: string | null;
  contextMenu: ContextMenu | null;
  importing: boolean;
}

interface UiActions {
  openViewer: (itemId: string) => void;
  closeViewer: () => void;
  setContextMenu: (menu: ContextMenu) => void;
  clearContextMenu: () => void;
  setImporting: (importing: boolean) => void;
}

export const useUiStore = create<UiState & UiActions>()((set) => ({
  viewerOpen: false,
  viewerItemId: null,
  contextMenu: null,
  importing: false,

  openViewer: (itemId) =>
    set({ viewerOpen: true, viewerItemId: itemId }),

  closeViewer: () =>
    set({ viewerOpen: false, viewerItemId: null }),

  setContextMenu: (menu) => set({ contextMenu: menu }),

  clearContextMenu: () => set({ contextMenu: null }),

  setImporting: (importing) => set({ importing }),
}));

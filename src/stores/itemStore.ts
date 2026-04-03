import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Item, ItemFilter, SortSpec, Pagination, ItemPage } from '@/lib/types';

interface ItemState {
  items: Item[];
  selectedIds: Set<string>;
  loading: boolean;
  total: number;
}

interface ItemActions {
  setItems: (items: Item[], total: number) => void;
  toggleSelect: (id: string) => void;
  selectRange: (fromId: string, toId: string) => void;
  clearSelection: () => void;
  setLoading: (loading: boolean) => void;
  loadItems: (
    libraryId: string,
    filter: ItemFilter,
    sort: SortSpec,
    page: Pagination,
  ) => Promise<void>;
}

export const useItemStore = create<ItemState & ItemActions>()((set, get) => ({
  items: [],
  selectedIds: new Set<string>(),
  loading: false,
  total: 0,

  setItems: (items, total) =>
    set({ items, total, selectedIds: new Set<string>() }),

  toggleSelect: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  selectRange: (fromId, toId) => {
    const { items } = get();
    const fromIndex = items.findIndex((item) => item.id === fromId);
    const toIndex = items.findIndex((item) => item.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const rangeIds = items.slice(start, end + 1).map((item) => item.id);
    set({ selectedIds: new Set(rangeIds) });
  },

  clearSelection: () => set({ selectedIds: new Set<string>() }),

  setLoading: (loading) => set({ loading }),

  loadItems: async (libraryId, filter, sort, page) => {
    set({ loading: true });
    try {
      const result = await invoke<ItemPage>('query_items', {
        libraryId,
        filter,
        sort,
        page,
      });
      set({
        items: result.items,
        total: result.total,
        selectedIds: new Set<string>(),
      });
    } finally {
      set({ loading: false });
    }
  },
}));

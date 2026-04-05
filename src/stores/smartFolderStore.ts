import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { SmartFolder, RuleGroup } from '@/lib/types';
import { useUiStore } from './uiStore';

interface SmartFolderState {
  folders: SmartFolder[];
  loading: boolean;
  selectedId: string | null;
}

interface SmartFolderActions {
  fetchFolders: () => Promise<void>;
  create: (name: string, rules: RuleGroup, parentId?: string | null) => Promise<void>;
  update: (id: string, name: string, rules: RuleGroup, parentId?: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setSelectedId: (id: string | null) => void;
}

export const useSmartFolderStore = create<SmartFolderState & SmartFolderActions>()(
  (set, get) => ({
    folders: [],
    loading: false,
    selectedId: null,

    fetchFolders: async () => {
      set({ loading: true });
      try {
        const folders = await invoke<SmartFolder[]>('list_smart_folders');
        set({ folders });
      } catch (e) {
        useUiStore.getState().setError(String(e));
      } finally {
        set({ loading: false });
      }
    },

    create: async (name, rules, parentId = null) => {
      try {
        await invoke<SmartFolder>('create_smart_folder', {
          name,
          rules: JSON.stringify(rules),
          parentId,
        });
        await get().fetchFolders();
      } catch (e) {
        useUiStore.getState().setError(String(e));
      }
    },

    update: async (id, name, rules, parentId = null) => {
      try {
        await invoke<SmartFolder>('update_smart_folder', {
          id,
          name,
          rules: JSON.stringify(rules),
          parentId,
        });
        await get().fetchFolders();
      } catch (e) {
        useUiStore.getState().setError(String(e));
      }
    },

    remove: async (id) => {
      try {
        await invoke('delete_smart_folder', { id });
        const { selectedId } = get();
        if (selectedId === id) {
          set({ selectedId: null });
        }
        await get().fetchFolders();
      } catch (e) {
        useUiStore.getState().setError(String(e));
      }
    },

    setSelectedId: (id) => set({ selectedId: id }),
  }),
);

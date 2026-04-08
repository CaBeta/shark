import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLibraryStore } from '@/stores/libraryStore';
import { useViewStore } from '@/stores/viewStore';
import { useFilterStore } from '@/stores/filterStore';
import { useUiStore } from '@/stores/uiStore';
import { useItemStore } from '@/stores/itemStore';
import { ImportButton } from '@/components/Import/ImportButton';
import type { SearchResult } from '@/lib/types';
import {
  Search, LayoutGrid, List, SlidersHorizontal,
  ChevronLeft, ChevronRight, Sidebar as SidebarIcon,
  Image as ImageIcon,
} from 'lucide-react';

export function Toolbar() {
  const { libraries, activeLibraryId } = useLibraryStore();
  const { toggleSidebar, gridSize, setGridSize, viewMode, setViewMode } = useViewStore();
  const { searchQuery, setSearchQuery } = useFilterStore();
  const { setItems, loadItems } = useItemStore();
  const activeLib = libraries.find((l) => l.id === activeLibraryId);

  // Map gridSize (100-400) to zoom slider (10-100)
  const zoom = Math.round(((gridSize - 100) / 300) * 90 + 10);
  const handleZoomChange = (z: number) => {
    const size = Math.round(((z - 10) / 90) * 300 + 100);
    setGridSize(size);
  };

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (!activeLibraryId) return;

      if (value.trim()) {
        invoke<SearchResult[]>('search_items_cmd', {
          libraryId: activeLibraryId,
          query: value,
          limit: 100,
        })
          .then((results) => setItems(results.map((r) => r.item), results.length))
          .catch((e) => useUiStore.getState().setError(String(e)));
      } else {
        loadItems(
          activeLibraryId,
          {},
          { field: 'created_at', direction: 'desc' },
          { page: 0, page_size: 100 },
        );
      }
    },
    [activeLibraryId, setSearchQuery, setItems, loadItems],
  );

  return (
    <div className="h-14 border-b border-gray-200 bg-[#F6F6F6] flex items-center px-4 justify-between shrink-0">
      {/* Left: Traffic Lights & Nav */}
      <div className="flex items-center gap-6 w-64 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
        </div>
        <div className="flex items-center gap-3 text-gray-500">
          <SidebarIcon size={18} className="hover:text-gray-800 cursor-pointer" onClick={toggleSidebar} />
          <div className="flex items-center gap-1">
            <ChevronLeft size={20} className="text-gray-400" />
            <ChevronRight size={20} className="text-gray-400" />
          </div>
        </div>
      </div>

      {/* Center: View Controls */}
      <div className="flex items-center justify-center flex-1">
        <div className="flex items-center bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 border-l border-gray-200 ${viewMode === 'list' ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <List size={16} />
          </button>
        </div>
        <div className="mx-4 text-[13px] font-medium text-gray-700">
          {activeLib ? activeLib.name : 'Shark'}
        </div>
        <div className="flex items-center gap-2 w-32">
          <ImageIcon size={14} className="text-gray-400" />
          <input
            type="range"
            min="10"
            max="100"
            value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="w-full accent-blue-500 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <ImageIcon size={18} className="text-gray-400" />
        </div>
      </div>

      {/* Right: Search & Actions */}
      <div className="flex items-center gap-3 w-72 justify-end shrink-0">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-1 text-[13px] bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <button className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-md">
          <SlidersHorizontal size={16} />
        </button>
        <ImportButton />
      </div>
    </div>
  );
}

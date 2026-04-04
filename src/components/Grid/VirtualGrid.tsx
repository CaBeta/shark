import { useRef, useEffect, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useItemStore } from '@/stores/itemStore';
import { useViewStore } from '@/stores/viewStore';
import { useUiStore } from '@/stores/uiStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { AssetCard } from './AssetCard';

export function VirtualGrid() {
  const { items, selectedIds, thumbnailPaths, toggleSelect, selectRange, clearSelection } = useItemStore();
  const gridSize = useViewStore((s) => s.gridSize);
  const openViewer = useUiStore((s) => s.openViewer);
  const activeLibraryId = useLibraryStore((s) => s.activeLibraryId);
  const [columnCount, setColumnCount] = useState(4);
  const lastClickedId = useRef<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Calculate columns based on container width
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const gap = 8;
        const cols = Math.max(1, Math.floor((width + gap) / (gridSize + gap)));
        setColumnCount(cols);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [gridSize]);

  const rowCount = Math.ceil(items.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => gridSize + 32, // thumbnail + filename
    overscan: 5,
  });

  const handleClick = useCallback(
    (e: React.MouseEvent, itemId: string) => {
      if (e.shiftKey && lastClickedId.current) {
        selectRange(lastClickedId.current, itemId);
      } else if (e.ctrlKey || e.metaKey) {
        toggleSelect(itemId);
        lastClickedId.current = itemId;
      } else {
        clearSelection();
        toggleSelect(itemId);
        lastClickedId.current = itemId;
      }
    },
    [toggleSelect, selectRange, clearSelection],
  );

  const handleDoubleClick = useCallback(
    (itemId: string) => {
      openViewer(itemId);
    },
    [openViewer],
  );

  if (!activeLibraryId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 gap-2">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor" className="text-neutral-600 mb-2">
          <rect x="4" y="8" width="40" height="32" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="22" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M4 32l10-8 8 6 8-10 14 12" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className="text-base font-medium text-neutral-400">Welcome to Shark</span>
        <span className="text-sm">Create a library in the sidebar to get started.</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div ref={parentRef} className="flex-1 flex items-center justify-center text-neutral-500 text-sm">
        No items yet. Click Import to add files.
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * columnCount;
          const rowItems = items.slice(startIdx, startIdx + columnCount);

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="flex gap-2 px-3"
            >
              {rowItems.map((item) => (
                <AssetCard
                  key={item.id}
                  item={item}
                  size={gridSize}
                  selected={selectedIds.has(item.id)}
                  thumbnailPath={thumbnailPaths[item.id]}
                  onClick={(e) => handleClick(e, item.id)}
                  onDoubleClick={() => handleDoubleClick(item.id)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

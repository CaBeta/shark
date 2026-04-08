import { useUiStore } from '@/stores/uiStore';

export function SidebarDropZone() {
  const isDragOver = useUiStore((s) => s.isDragOver);

  return (
    <div
      className={`mt-auto mx-2 mb-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
        isDragOver
          ? 'border-blue-400 bg-blue-500/10 text-blue-300'
          : 'border-neutral-600 text-neutral-500'
      }`}
    >
      <svg
        className={`w-6 h-6 mx-auto mb-1 ${isDragOver ? 'text-blue-400' : 'text-neutral-600'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
      <span className="text-xs">拖入文件或文件夹</span>
    </div>
  );
}

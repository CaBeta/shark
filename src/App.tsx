import { useViewStore } from '@/stores/viewStore';
import { useUiStore } from '@/stores/uiStore';
import { Toolbar } from '@/components/Toolbar/Toolbar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { VirtualGrid } from '@/components/Grid/VirtualGrid';
import { ImageViewer } from '@/components/Viewer/ImageViewer';
import { ImportProgress } from '@/components/Import/ImportProgress';
import { DedupDialog } from '@/components/Import/DedupDialog';

function App() {
  const sidebarOpen = useViewStore((s) => s.sidebarOpen);
  const { error, setError } = useUiStore();

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white select-none">
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded shadow-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}
        <VirtualGrid />
      </div>
      <ImageViewer />
      <ImportProgress />
      <DedupDialog />
    </div>
  );
}

export default App;

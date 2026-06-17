'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Film, Download, Presentation, Scissors } from 'lucide-react';
import VfxPullListTable from './VfxPullListTable';

interface DashboardStats {
  total_scenes: number;
  total_takes: number;
  circled_takes: number;
  vfx_shots: number;
}

export default function DeliverablesDashboard() {
  const params = useParams();
  const projectId = params.id as string;
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/deliverables/dashboard`)
      .then(res => res.json())
      .then(data => setStats(data));
  }, [projectId]);

  const handleDownloadTurnover = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/deliverables/editor-turnover`;
  };

  if (!stats) return <div className="p-12 text-neutral-500">Loading Deliverables...</div>;

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 font-sans p-8 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex justify-between items-end border-b border-neutral-300 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Film className="w-6 h-6 text-neutral-400" />
              <h1 className="text-3xl font-semibold tracking-tight">Post-Production Turnover</h1>
            </div>
            <p className="text-neutral-500">Structured data handoffs for the Editor and VFX Supervisor.</p>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-6 border border-neutral-200 rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">Total Scenes</p>
            <p className="text-3xl font-black font-mono">{stats.total_scenes}</p>
          </div>
          <div className="bg-white p-6 border border-neutral-200 rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">Total Takes</p>
            <p className="text-3xl font-black font-mono">{stats.total_takes}</p>
          </div>
          <div className="bg-white p-6 border border-neutral-200 rounded-sm bg-blue-50/50">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">Circled Takes</p>
            <p className="text-3xl font-black font-mono text-blue-700">{stats.circled_takes}</p>
          </div>
          <div className="bg-white p-6 border border-neutral-200 rounded-sm bg-purple-50/50">
            <p className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-1">VFX Shots</p>
            <p className="text-3xl font-black font-mono text-purple-700">{stats.vfx_shots}</p>
          </div>
        </div>

        {/* Action Engine */}
        <div className="grid grid-cols-2 gap-8 mt-12">
          
          {/* Editor Turnover Card */}
          <div className="bg-white border border-neutral-300 p-8 flex flex-col items-start rounded-sm shadow-sm">
            <div className="bg-blue-100 p-3 rounded-full mb-6">
              <Scissors className="w-6 h-6 text-blue-700" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Editor Turnover (CSV)</h2>
            <p className="text-neutral-600 mb-8 flex-1">
              Download a structured log of all circled takes linked to their corresponding scenes. Drop this CSV directly into Premiere Pro or DaVinci Resolve to instantly map continuity metadata to your timeline.
            </p>
            <button 
              onClick={handleDownloadTurnover}
              className="w-full flex items-center justify-center gap-2 bg-black text-white px-6 py-4 rounded-sm font-bold tracking-wider hover:bg-neutral-800 transition-colors"
            >
              <Download className="w-5 h-5" />
              DOWNLOAD EDITOR TURNOVER
            </button>
          </div>

          {/* VFX Pull List Visualizer */}
          <div className="bg-white border border-neutral-300 p-8 flex flex-col items-start rounded-sm shadow-sm">
            <div className="bg-purple-100 p-3 rounded-full mb-6">
              <Presentation className="w-6 h-6 text-purple-700" />
            </div>
            <h2 className="text-2xl font-bold mb-2">VFX Pull List</h2>
            <p className="text-neutral-600 mb-8 flex-1">
              An isolated view of every circled take that requires visual effects, aggregated using the script breakdown's VFX element tags.
            </p>
            <VfxPullListTable projectId={projectId} />
          </div>

        </div>
      </div>
    </main>
  );
}

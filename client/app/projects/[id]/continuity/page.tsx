'use client';
import { useState, useEffect } from 'react';
import { Video, CheckCircle, Activity, LayoutGrid } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function ContinuityLogPage() {
  const { id } = useParams();
  
  const [activeSceneId, setActiveSceneId] = useState(''); 
  const [activeSceneNumber, setActiveSceneNumber] = useState('');
  const [takeNumber, setTakeNumber] = useState(1);
  const [lens, setLens] = useState('50mm');
  const [duration, setDuration] = useState('');
  
  const [takes, setTakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch the active scene from the Schedule
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const schedRes = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${id}/schedule`);
        if (schedRes.ok) {
            const data = await schedRes.json();
            if (data && data.length > 0) {
                setActiveSceneId(data[0].scene_id);
                setActiveSceneNumber(data[0].scene_number);
            }
        }
        
        // Fetch existing takes
        const takesRes = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${id}/takes`);
        if (takesRes.ok) {
            const takesData = await takesRes.json();
            if (takesData && takesData.length > 0) {
                setTakes(takesData);
                // Assume next take is highest take number + 1 for active scene
                const sceneTakes = takesData.filter((t: any) => t.scene_id === activeSceneId);
                if (sceneTakes.length > 0) {
                    const maxTake = Math.max(...sceneTakes.map((t: any) => t.take_number));
                    setTakeNumber(maxTake + 1);
                }
            }
        }
      } catch (err) {
        console.error("Failed to fetch context:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, [id, activeSceneId]);

  const logTake = async (isCircled: boolean) => {
    if (!activeSceneId) return;

    const payload = {
      scene_id: activeSceneId,
      take_number: takeNumber,
      lens: lens,
      duration_seconds: parseInt(duration) || 0,
      is_circled: isCircled,
      supervisor_notes: isCircled ? "Great performance" : ""
    };

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${id}/takes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const resData = await response.json();
        
        // Optimistic UI update
        const newTake = {
            id: resData.take_id,
            scene_id: activeSceneId,
            scene_number: activeSceneNumber,
            take_number: takeNumber,
            lens: lens,
            duration_seconds: parseInt(duration) || 0,
            is_circled: isCircled,
            supervisor_notes: payload.supervisor_notes,
            created_at: new Date().toISOString()
        };
        setTakes([newTake, ...takes]);
        setTakeNumber(prev => prev + 1);
        setDuration('');
      } else {
        console.error("Failed to log take");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center">Loading Log Workspace...</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans p-6 md:p-10 selection:bg-neutral-700">
      <header className="mb-12 border-b border-neutral-800 pb-6 flex justify-between items-center">
         <div>
             <h1 className="text-3xl font-bold tracking-tight text-neutral-100">Continuity Log</h1>
             <p className="text-neutral-400 mt-2 text-lg">Scene {activeSceneNumber || 'N/A'} • Live Environment</p>
         </div>
         <div className="flex items-center gap-4 text-emerald-500 font-bold bg-neutral-800 px-4 py-2 rounded-xl">
             <Activity className="animate-pulse" size={20} /> LIVE ON SET
         </div>
      </header>
      
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Execution Area (Left, 2 columns) */}
        <div className="lg:col-span-2">
            {/* Massive Take Display */}
            <div className="text-center mb-16">
            <p className="text-neutral-500 uppercase tracking-widest text-sm mb-4 font-semibold">Current Take</p>
            <div className="text-9xl font-black text-white tabular-nums tracking-tighter">
                {takeNumber}
            </div>
            </div>

            {/* Tactile Input Grid */}
            <div className="grid grid-cols-2 gap-6 mb-12">
                <div className="bg-neutral-800 p-6 rounded-2xl">
                    <label className="block text-neutral-400 text-sm mb-3 uppercase tracking-wider font-semibold">Lens</label>
                    <div className="flex gap-3">
                        {['35mm', '50mm', '85mm'].map(l => (
                            <button 
                                key={l}
                                onClick={() => setLens(l)}
                                className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${lens === l ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="bg-neutral-800 p-6 rounded-2xl flex flex-col justify-center">
                    <label className="block text-neutral-400 text-sm mb-3 uppercase tracking-wider font-semibold">Duration (Secs)</label>
                    <input 
                        type="number" 
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-4 text-2xl font-bold text-center text-white focus:outline-none focus:border-neutral-500 focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                    />
                </div>
            </div>

            {/* Massive Execution Buttons */}
            <div className="flex gap-6">
                <button 
                    onClick={() => logTake(false)}
                    className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white p-8 rounded-3xl font-bold text-2xl flex items-center justify-center gap-4 transition-colors active:scale-95"
                >
                    <Video size={32} /> Log Take {takeNumber}
                </button>
                <button 
                    onClick={() => logTake(true)}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white p-8 rounded-3xl font-bold text-2xl flex items-center justify-center gap-4 transition-colors shadow-xl shadow-green-900/30 active:scale-95"
                >
                    <CheckCircle size={32} /> Circle Take
                </button>
            </div>
        </div>

        {/* Timeline Area (Right, 1 column) */}
        <div className="bg-neutral-800 rounded-3xl p-6 h-[800px] flex flex-col overflow-hidden">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <LayoutGrid size={24} className="text-blue-500" />
                Session Timeline
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-transparent">
                {takes.length === 0 ? (
                    <div className="text-neutral-500 text-center mt-10">No takes logged yet.</div>
                ) : (
                    takes.map((take) => (
                        <div key={take.id} className={`p-4 rounded-xl border ${take.is_circled ? 'bg-green-900/20 border-green-500/50' : 'bg-neutral-900 border-neutral-700'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className="text-sm text-neutral-400 font-semibold uppercase tracking-wider">Scene {take.scene_number}</span>
                                    <div className="text-xl font-bold text-white">Take {take.take_number}</div>
                                </div>
                                {take.is_circled && (
                                    <div className="bg-green-500 text-black text-xs font-bold px-2 py-1 rounded uppercase flex items-center gap-1">
                                        <CheckCircle size={12} /> Circled
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-4 text-sm text-neutral-400 mt-2 border-t border-neutral-800 pt-2">
                                <span><span className="font-semibold">Lens:</span> {take.lens}</span>
                                <span><span className="font-semibold">Dur:</span> {take.duration_seconds}s</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </main>
    </div>
  );
}

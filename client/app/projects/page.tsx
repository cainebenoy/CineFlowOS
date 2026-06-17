'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Plus, Clapperboard, MonitorPlay, Film } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function StudioDashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [projectType, setProjectType] = useState('Feature Film');
  const router = useRouter();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('cineflow_token');
      const res = await fetch('http://localhost:8080/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('cineflow_token');
      const res = await fetch('http://localhost:8080/api/projects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, project_type: projectType }),
      });
      if (res.ok) {
        const newProject = await res.json();
        router.push(`/projects/${newProject.id}/schedule`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return <div className="p-12 text-neutral-500 font-medium tracking-widest uppercase">Loading Active Productions...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-neutral-800 bg-neutral-950 px-8 py-6 flex justify-between items-end sticky top-0 z-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight uppercase flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-indigo-500" />
            Studio Dashboard
          </h1>
          <p className="text-sm text-neutral-400 font-medium tracking-widest uppercase mt-2">
            Active Productions
          </p>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-bold uppercase tracking-wider hover:bg-indigo-500 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Production
        </button>
      </div>

      <div className="p-8 max-w-7xl w-full mx-auto">
        {projects.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-neutral-800 rounded-xl">
            <p className="text-neutral-500 font-medium mb-4">No active productions found.</p>
            <button 
              onClick={() => setShowCreate(true)}
              className="text-indigo-400 font-bold hover:text-indigo-300 transition"
            >
              Initialize your first project &rarr;
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project: any) => (
              <Link 
                key={project.id} 
                href={`/projects/${project.id}/schedule`}
                className="group relative bg-neutral-900 border border-neutral-800 rounded-xl p-6 hover:border-indigo-500/50 hover:bg-neutral-800/80 transition block"
              >
                <div className="flex justify-between items-start mb-4">
                  {project.project_type === 'Commercial' ? (
                    <MonitorPlay className="w-6 h-6 text-neutral-500 group-hover:text-indigo-400 transition" />
                  ) : project.project_type === 'Short Film' ? (
                    <Film className="w-6 h-6 text-neutral-500 group-hover:text-indigo-400 transition" />
                  ) : (
                    <Clapperboard className="w-6 h-6 text-neutral-500 group-hover:text-indigo-400 transition" />
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400">
                    {project.status}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-neutral-100 mb-1">{project.title}</h3>
                <p className="text-sm text-neutral-500 mb-6">{project.project_type}</p>
                
                <div className="border-t border-neutral-800 pt-4 flex justify-between items-center">
                  <span className="text-xs font-mono text-neutral-600">ID: {project.id.split('-')[0]}...</span>
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">
                    {project.role}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold uppercase tracking-wide mb-6">Initialize Production</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Project Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Untitled Sci-Fi Thriller"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Format
                </label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-neutral-100 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option>Feature Film</option>
                  <option>Short Film</option>
                  <option>Commercial</option>
                  <option>Web Series</option>
                </select>
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm font-bold text-neutral-400 hover:text-neutral-200 transition uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold uppercase tracking-wider hover:bg-indigo-500 transition"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

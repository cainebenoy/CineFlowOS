'use client';

import { useState, useEffect, use } from 'react';
import { Upload, Film, FileVideo, HardDrive, CheckCircle2, Clock } from 'lucide-react';

export default function VFXDashboard({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const [shots, setShots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchShots();
  }, [projectId]);

  const fetchShots = async () => {
    try {
      const res = await fetch(`http://localhost:8080/api/projects/${projectId}/vfx`);
      if (res.ok) {
        const data = await res.json();
        setShots(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (shotId: string, file: File) => {
    try {
      setUploadingId(shotId);

      // 1. Get Presigned URL
      const presignRes = await fetch(`http://localhost:8080/api/projects/${projectId}/vfx/presigned-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
        })
      });
      
      const { upload_url, file_url } = await presignRes.json();

      // 2. Upload directly to S3 / MinIO
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file
      });

      if (!uploadRes.ok) throw new Error('Direct upload failed');

      // 3. Log asset in PostgreSQL
      await fetch(`http://localhost:8080/api/projects/${projectId}/vfx/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vfx_shot_id: shotId,
          asset_type: 'V1 Render', // Simplified for demo
          file_url: file_url,
          notes: 'Direct upload from pipeline'
        })
      });

      // Refresh data
      await fetchShots();

    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. See console.');
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) return <div className="p-8 text-neutral-400">Loading pipeline...</div>;

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-200 p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-white mb-2">VFX Pipeline</h1>
          <p className="text-neutral-500 font-medium">Direct-to-Cloud Asset Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shots.map(shot => (
          <div key={shot.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
              <div className="flex items-center gap-3">
                <Film className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white tracking-wide">{shot.shot_code}</h3>
              </div>
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {shot.status}
              </span>
            </div>
            
            <div className="p-5 flex-1 flex flex-col gap-4">
              {shot.assets && shot.assets.length > 0 ? (
                <div className="space-y-3">
                  {shot.assets.map((asset: any) => (
                    <div key={asset.id} className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-neutral-800/50">
                      <div className="flex items-center gap-3">
                        <FileVideo className="w-4 h-4 text-emerald-400" />
                        <div>
                          <p className="text-sm font-medium text-neutral-200">{asset.asset_type}</p>
                          <a href={asset.file_url} target="_blank" rel="noreferrer" className="text-xs text-neutral-500 hover:text-neutral-300 truncate w-32 inline-block">
                            View Asset
                          </a>
                        </div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500/50" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral-600 min-h-[120px] bg-black/20 rounded-lg border border-dashed border-neutral-800">
                  <Clock className="w-6 h-6 mb-2 opacity-50" />
                  <p className="text-sm">Awaiting Plates</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-black/40 border-t border-neutral-800">
              <label className={`
                flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg
                text-sm font-semibold transition-all cursor-pointer
                ${uploadingId === shot.id 
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                  : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                }
              `}>
                <HardDrive className="w-4 h-4" />
                {uploadingId === shot.id ? 'Uploading to S3...' : 'Upload Iteration'}
                <input 
                  type="file" 
                  className="hidden"
                  disabled={uploadingId === shot.id}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(shot.id, e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        ))}

        {shots.length === 0 && (
          <div className="col-span-full py-20 text-center border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/50">
            <h3 className="text-xl font-medium text-white mb-2">No VFX Shots Found</h3>
            <p className="text-neutral-500">Upload a script with VFX-heavy scenes to auto-populate the pipeline.</p>
          </div>
        )}
      </div>
    </div>
  );
}

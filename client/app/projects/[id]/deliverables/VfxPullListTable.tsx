'use client';

import { useState, useEffect } from 'react';

interface VFXShot {
  scene_number: string;
  setting: string;
  time_of_day: string;
  take_number: number;
  lens: string;
  vfx_elements: string;
}

export default function VfxPullListTable({ projectId }: { projectId: string }) {
  const [shots, setShots] = useState<VFXShot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/deliverables/vfx-pulls`)
      .then(res => res.json())
      .then(data => {
        setShots(data || []);
        setIsLoading(false);
      });
  }, [projectId]);

  if (isLoading) return <div className="text-neutral-500 text-sm">Loading VFX pulls...</div>;

  if (shots.length === 0) return (
    <div className="w-full bg-neutral-50 border border-dashed border-neutral-300 p-6 text-center text-neutral-500 text-sm">
      No circled VFX takes found.
    </div>
  );

  return (
    <div className="w-full border border-neutral-300 rounded-sm overflow-hidden overflow-y-auto max-h-[300px]">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-neutral-100 text-neutral-600 uppercase tracking-wider sticky top-0">
          <tr>
            <th className="p-3 font-bold border-b border-r border-neutral-300 w-12 text-center">Sc</th>
            <th className="p-3 font-bold border-b border-r border-neutral-300 w-16 text-center">Tk</th>
            <th className="p-3 font-bold border-b border-r border-neutral-300 w-16">Lens</th>
            <th className="p-3 font-bold border-b border-neutral-300">VFX Elements Required</th>
          </tr>
        </thead>
        <tbody className="font-mono bg-white">
          {shots.map((shot, idx) => (
            <tr key={idx} className="border-b border-neutral-200 hover:bg-purple-50 transition-colors">
              <td className="p-3 text-center border-r border-neutral-200 font-bold">{shot.scene_number}</td>
              <td className="p-3 text-center border-r border-neutral-200 text-purple-700 font-bold">Tk {shot.take_number}</td>
              <td className="p-3 border-r border-neutral-200">{shot.lens || '-'}</td>
              <td className="p-3 whitespace-normal break-words text-purple-900 font-medium">
                {shot.vfx_elements}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

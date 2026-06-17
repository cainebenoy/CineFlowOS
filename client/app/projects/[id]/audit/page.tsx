'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ShieldAlert, Terminal } from 'lucide-react';

interface AuditLog {
  id: string;
  table_name: string;
  action: string;
  old_data: any;
  new_data: any;
  created_at: string;
}

export default function AuditPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/audit`)
      .then(res => res.json())
      .then(data => {
        setLogs(data || []);
        setIsLoading(false);
      });
  }, [projectId]);

  if (isLoading) return <div className="p-12 text-neutral-500 font-mono">Connecting to secure ledger...</div>;

  return (
    <main className="min-h-screen bg-black text-neutral-300 font-mono p-8 md:p-12 selection:bg-neutral-800">
      <div className="max-w-5xl mx-auto">
        
        <header className="mb-8 flex justify-between items-end border-b border-neutral-800 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2 text-white">
              <ShieldAlert className="w-6 h-6" />
              <h1 className="text-3xl font-semibold tracking-tight font-sans">System Audit Logs</h1>
            </div>
            <p className="text-neutral-500 text-sm">Immutable ledger of destructive actions and financial updates.</p>
          </div>
          <Terminal className="w-8 h-8 text-neutral-700" />
        </header>

        <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="text-neutral-600">No system events recorded for this project.</div>
          ) : (
            logs.map((log) => {
              const oldCost = log.old_data?.estimated_cost;
              const newCost = log.new_data?.estimated_cost;
              const actualOld = log.old_data?.actual_cost;
              const actualNew = log.new_data?.actual_cost;
              const name = log.new_data?.name;

              return (
                <div key={log.id} className="bg-neutral-900 border border-neutral-800 p-4 rounded text-sm">
                  <div className="flex items-center justify-between mb-3 border-b border-neutral-800 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-yellow-900/30 text-yellow-500 text-xs font-bold rounded">
                        {log.action}
                      </span>
                      <span className="text-neutral-500">TABLE: {log.table_name}</span>
                    </div>
                    <span className="text-neutral-500 text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="text-white">
                    <span className="text-blue-400">System logged financial variance</span> for element: <strong>{name}</strong>
                  </div>
                  
                  <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                    <div className="bg-neutral-950 p-3 rounded border border-red-900/30">
                      <div className="text-neutral-500 mb-1">PREVIOUS STATE</div>
                      <div>EST: ₹{oldCost} | ACT: ₹{actualOld}</div>
                    </div>
                    <div className="bg-neutral-950 p-3 rounded border border-green-900/30">
                      <div className="text-neutral-500 mb-1">NEW STATE</div>
                      <div className="text-green-400">EST: ₹{newCost} | ACT: ₹{actualNew}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </main>
  );
}

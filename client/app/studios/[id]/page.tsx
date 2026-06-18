"use client";

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProjectFinance {
  id: string;
  title: string;
  project_type: string;
  status: string;
  total_estimated: number;
  total_actual: number;
}

export default function StudioDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studioId } = use(params);
  const router = useRouter();
  const [slate, setSlate] = useState<ProjectFinance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSlate = async () => {
      const token = localStorage.getItem('cineflow_token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/studios/${studioId}/finance/slate`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) {
          throw new Error('Failed to fetch studio slate');
        }

        const data = await res.json();
        setSlate(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSlate();
  }, [studioId]);

  if (isLoading) return <div className="p-8 text-neutral-500">Loading studio financials...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  // Aggregate slate totals
  const totalSlateEstimated = slate.reduce((sum, p) => sum + p.total_estimated, 0);
  const totalSlateActual = slate.reduce((sum, p) => sum + p.total_actual, 0);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Studio Slate</h1>
          <p className="text-neutral-500 mt-2 text-lg">Cross-project financial overview and burn rates.</p>
        </div>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
            <h3 className="text-neutral-500 text-sm font-medium mb-1">Total Slate Budget (Estimated)</h3>
            <p className="text-4xl font-semibold tracking-tight">
              ₹{totalSlateEstimated.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
            <h3 className="text-neutral-500 text-sm font-medium mb-1">Total Slate Burn (Actuals)</h3>
            <p className={`text-4xl font-semibold tracking-tight ${totalSlateActual > totalSlateEstimated ? 'text-red-500' : 'text-neutral-900'}`}>
              ₹{totalSlateActual.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Breakdown by Project */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
          <h2 className="text-xl font-bold mb-6">Financials by Project</h2>
          
          <div className="space-y-6">
            {slate.map((project) => {
              const estimated = project.total_estimated;
              const actual = project.total_actual;
              
              // Handle division by zero
              let progressPercent = 0;
              if (estimated > 0) {
                progressPercent = Math.min((actual / estimated) * 100, 100);
              } else if (actual > 0) {
                progressPercent = 100;
              }

              const isOverBudget = actual > estimated && estimated > 0;

              return (
                <div key={project.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-100 hover:border-neutral-300 transition-colors cursor-pointer group" onClick={() => router.push(`/projects/${project.id}`)}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold group-hover:text-blue-600 transition-colors">{project.title}</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-200 text-neutral-800 mt-1">
                        {project.project_type} • {project.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-neutral-500">Burn Rate</p>
                      <p className={`text-lg font-bold ${isOverBudget ? 'text-red-500' : 'text-neutral-900'}`}>
                        ₹{actual.toLocaleString('en-IN', { maximumFractionDigits: 0 })} <span className="text-neutral-400 text-sm font-normal">/ ₹{estimated.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar Visualization */}
                  <div className="h-4 w-full bg-neutral-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${isOverBudget ? 'bg-red-500' : 'bg-neutral-900'}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {isOverBudget && (
                    <p className="text-red-500 text-xs mt-2 font-medium">Over budget by ₹{(actual - estimated).toLocaleString('en-IN')}</p>
                  )}
                </div>
              );
            })}
          </div>
          
          {slate.length === 0 && (
            <div className="text-center py-12 text-neutral-500">
              No projects found in this studio slate.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

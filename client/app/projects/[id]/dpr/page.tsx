'use client';

import { useState, useEffect, use } from 'react';
import { Calendar, Users, FileText, IndianRupee, Printer, CheckCircle2, Clock } from 'lucide-react';

export default function DPRDashboard({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const [dpr, setDpr] = useState<any>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDPR();
  }, [projectId, date]);

  const fetchDPR = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/dpr?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setDpr(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !dpr) return <div className="p-8 text-neutral-400">Loading Report...</div>;

  const scheduledCount = dpr?.scheduled_scenes?.length || 0;
  const completedCount = dpr?.completed_scenes?.filter((s: any) => s.was_scheduled)?.length || 0;
  const progress = scheduledCount === 0 ? 0 : Math.round((completedCount / scheduledCount) * 100);

  return (
    <div className="flex flex-col h-full bg-neutral-100 print:bg-white text-neutral-900 overflow-y-auto">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="bg-white border-b border-neutral-200 px-8 py-4 flex justify-between items-center print:hidden sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-neutral-500" />
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
          />
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition shadow-sm"
        >
          <Printer className="w-4 h-4" />
          Export PDF
        </button>
      </div>

      {/* Printable Report Content */}
      <div className="p-8 max-w-4xl mx-auto w-full print:p-0 print:max-w-none space-y-8">
        
        {/* Header */}
        <div className="border-b-2 border-neutral-900 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-1 uppercase">Daily Progress Report</h1>
            <p className="text-xl text-neutral-600 font-medium">CineFlow OS</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-1">Shoot Date</p>
            <p className="text-2xl font-medium text-neutral-900">{date}</p>
            {dpr?.day_number && (
              <p className="text-sm font-medium text-indigo-600 mt-1">Day {dpr.day_number}</p>
            )}
          </div>
        </div>

        {/* High-Level Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
          <div className="bg-white print:border print:border-neutral-300 p-5 rounded-xl shadow-sm border border-neutral-200 flex flex-col justify-center items-center text-center">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Scenes Scheduled</p>
            <p className="text-3xl font-light text-neutral-900">{scheduledCount}</p>
          </div>
          <div className="bg-white print:border print:border-neutral-300 p-5 rounded-xl shadow-sm border border-neutral-200 flex flex-col justify-center items-center text-center">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Scenes Completed</p>
            <p className="text-3xl font-bold text-emerald-600">{completedCount}</p>
          </div>
          <div className="bg-white print:border print:border-neutral-300 p-5 rounded-xl shadow-sm border border-neutral-200 flex flex-col justify-center items-center text-center">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Crew Present</p>
            <p className="text-3xl font-light text-neutral-900">{dpr?.attendance?.length || 0}</p>
          </div>
          <div className="bg-white print:border print:border-neutral-300 p-5 rounded-xl shadow-sm border border-neutral-200 flex flex-col justify-center items-center text-center">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Daily Burn (Petty)</p>
            <p className="text-2xl font-medium text-rose-600">₹{dpr?.total_burn?.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Scene Progress */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-neutral-400" />
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Shoot Progress</h2>
          </div>
          <div className="bg-white print:border-none print:shadow-none border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold text-xs">
                <tr>
                  <th className="px-6 py-3">Scene</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Takes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {dpr?.scheduled_scenes?.map((scene: any) => {
                  const completedMatch = dpr?.completed_scenes?.find((c: any) => c.scene_id === scene.id);
                  const isDone = !!completedMatch;

                  return (
                    <tr key={scene.id} className={isDone ? 'bg-emerald-50/30' : ''}>
                      <td className="px-6 py-4 font-bold text-neutral-900 w-24">{scene.scene_number}</td>
                      <td className="px-6 py-4 text-neutral-600 max-w-sm truncate" title={scene.summary}>{scene.summary}</td>
                      <td className="px-6 py-4 text-center">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                            <Clock className="w-3.5 h-3.5" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-neutral-500 font-medium">
                        {isDone ? `${completedMatch.take_count} Takes` : '-'}
                      </td>
                    </tr>
                  );
                })}
                {(!dpr?.scheduled_scenes || dpr.scheduled_scenes.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                      No scenes scheduled for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
          {/* Crew Attendance */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-neutral-400" />
              <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Geo-fenced Attendance</h2>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold text-xs">
                  <tr>
                    <th className="px-6 py-3">Crew Member</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3 text-right">Time In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {dpr?.attendance?.map((log: any, i: number) => (
                    <tr key={i}>
                      <td className="px-6 py-3 font-medium text-neutral-900">{log.name}</td>
                      <td className="px-6 py-3 text-neutral-500">{log.role}</td>
                      <td className="px-6 py-3 text-right text-neutral-900 font-mono text-xs">
                        {new Date(log.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                  {(!dpr?.attendance || dpr.attendance.length === 0) && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-neutral-500">
                        No clock-ins recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Petty Cash */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <IndianRupee className="w-5 h-5 text-neutral-400" />
              <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Petty Cash Scans</h2>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold text-xs">
                  <tr>
                    <th className="px-6 py-3">Vendor / Category</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {dpr?.expenses?.map((exp: any, i: number) => (
                    <tr key={i}>
                      <td className="px-6 py-3">
                        <p className="font-medium text-neutral-900">{exp.vendor_name}</p>
                        <p className="text-xs text-neutral-500">{exp.category}</p>
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-rose-600">
                        ₹{exp.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  {(!dpr?.expenses || dpr.expenses.length === 0) && (
                    <tr>
                      <td colSpan={2} className="px-6 py-8 text-center text-neutral-500">
                        No expenses logged today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Users, Clock, MapPin, RefreshCw, IndianRupee, Link } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  crew_name: string;
  role: string;
  phone: string;
  daily_rate: number;
  check_in_time: string;
  latitude: number;
  longitude: number;
  status: string;
}

interface CrewMember {
  id: string;
  name: string;
  role: string;
  phone: string;
  daily_rate: number;
  upi_id: string;
  is_active: boolean;
}

export default function CrewAttendancePage() {
  const params = useParams();
  const projectId = params.id as string;
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [roster, setRoster] = useState<CrewMember[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080';

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    const [attRes, rosterRes] = await Promise.all([
      fetch(`${apiBase}/api/projects/${projectId}/attendance/today`),
      fetch(`${apiBase}/api/projects/${projectId}/crew`),
    ]);
    const attData = await attRes.json();
    const rosterData = await rosterRes.json();
    setAttendance(attData || []);
    setRoster(rosterData || []);
    setIsRefreshing(false);
  }, [projectId, apiBase]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds so the Line Producer sees live punches
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const checkedInIds = new Set(attendance.map(a => a.crew_name));
  const absentCrew = roster.filter(c => !checkedInIds.has(c.name));
  const todayWageBill = attendance.reduce((sum, rec) => sum + rec.daily_rate, 0);

  const copyCheckInLink = (crewId: string) => {
    const link = `${window.location.origin}/projects/${projectId}/crew/portal?crew_id=${crewId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(crewId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 font-sans p-8 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex justify-between items-end border-b border-neutral-300 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-neutral-400" />
              <h1 className="text-3xl font-semibold tracking-tight">Crew Attendance</h1>
            </div>
            <p className="text-neutral-500">Live geo-fenced check-ins for today's shoot.</p>
          </div>
          <button
            onClick={fetchData}
            disabled={isRefreshing}
            className="flex items-center gap-2 text-sm text-neutral-500 border border-neutral-300 bg-white px-4 py-2 rounded-sm hover:bg-neutral-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-neutral-200 p-6 rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">Total Crew</p>
            <p className="text-3xl font-black font-mono">{roster.length}</p>
          </div>
          <div className="bg-white border border-neutral-200 p-6 rounded-sm bg-green-50/50">
            <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-1">Checked In</p>
            <p className="text-3xl font-black font-mono text-green-700">{attendance.length}</p>
          </div>
          <div className="bg-white border border-neutral-200 p-6 rounded-sm bg-blue-50/50">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">Today's Wage Bill</p>
            <div className="flex items-center gap-1">
              <IndianRupee className="w-5 h-5 text-blue-700 font-bold" />
              <p className="text-3xl font-black font-mono text-blue-700">
                {todayWageBill.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">

          {/* Checked In Panel */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500 mb-4">On Set Today</h2>
            <div className="space-y-2">
              {attendance.length === 0 ? (
                <div className="bg-white border border-dashed border-neutral-300 p-6 text-center text-neutral-400 text-sm">
                  No check-ins yet today.
                </div>
              ) : (
                attendance.map(rec => (
                  <div key={rec.id} className="bg-white border border-neutral-200 p-4 rounded-sm flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{rec.crew_name}</p>
                      <p className="text-xs text-neutral-500">{rec.role}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-xs text-green-700 font-mono font-bold">
                        <Clock className="w-3 h-3" />
                        {new Date(rec.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {(rec.latitude !== 0 || rec.longitude !== 0) && (
                        <div className="flex items-center gap-1 text-xs text-neutral-400 mt-1 justify-end">
                          <MapPin className="w-3 h-3" />
                          <span>{rec.latitude.toFixed(4)}, {rec.longitude.toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Absent / Roster Panel */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500 mb-4">Full Roster</h2>
            <div className="space-y-2">
              {roster.map(member => {
                const isPresent = checkedInIds.has(member.name);
                return (
                  <div
                    key={member.id}
                    className={`bg-white border p-4 rounded-sm flex items-center justify-between ${isPresent ? 'border-green-200 bg-green-50/30' : 'border-neutral-200'}`}
                  >
                    <div>
                      <p className="font-bold text-sm flex items-center gap-2">
                        {member.name}
                        {isPresent && (
                          <span className="text-xs text-green-700 font-bold bg-green-100 px-1.5 py-0.5 rounded">IN</span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-500">{member.role}</p>
                      {member.daily_rate > 0 && (
                        <p className="text-xs text-neutral-400 font-mono mt-0.5">₹{member.daily_rate.toLocaleString('en-IN')}/day</p>
                      )}
                    </div>
                    <button
                      onClick={() => copyCheckInLink(member.id)}
                      title="Copy WhatsApp check-in link"
                      className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50"
                    >
                      <Link className="w-3.5 h-3.5" />
                      {copiedId === member.id ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

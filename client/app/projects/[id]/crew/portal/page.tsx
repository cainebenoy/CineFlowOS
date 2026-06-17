'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { MapPin, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function CrewPortalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;

  // crew_id is passed as a query param in the WhatsApp link
  // e.g. /projects/[id]/crew/portal?crew_id=xxxx
  const crewId = searchParams.get('crew_id') || '';

  const [crewName, setCrewName] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'submitting' | 'success' | 'error' | 'already_checked_in'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Resolve crew name from the API on mount
  useEffect(() => {
    if (!crewId) return;
    fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/crew`)
      .then(res => res.json())
      .then((crew: any[]) => {
        const member = crew?.find(c => c.id === crewId);
        if (member) setCrewName(member.name);
      });
  }, [crewId, projectId]);

  const handleCheckIn = () => {
    if (!crewId) {
      setErrorMessage('No crew ID found. Please use the link sent to your WhatsApp.');
      setStatus('error');
      return;
    }

    setStatus('locating');

    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      setStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus('submitting');
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/attendance/check-in`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                crew_id: crewId,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
            }
          );

          if (res.status === 409) {
            setStatus('already_checked_in');
            return;
          }

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Check-in failed');
          }

          setStatus('success');
        } catch (err: any) {
          setErrorMessage(err.message);
          setStatus('error');
        }
      },
      () => {
        setErrorMessage('Please allow location access to check in on set.');
        setStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const isLoading = status === 'locating' || status === 'submitting';

  return (
    <main className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">

        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-neutral-600 mb-3">CineFlow OS</p>
          <h1 className="text-3xl font-bold tracking-tight">
            {crewName ? `Welcome, ${crewName}` : 'Daily Check-In'}
          </h1>
          <p className="text-neutral-500 text-sm mt-2">
            Ensure you are physically on set before tapping.
          </p>
        </div>

        {/* States */}
        {status === 'success' && (
          <div className="bg-green-950 border border-green-900 p-10 rounded-2xl flex flex-col items-center gap-4">
            <CheckCircle2 className="w-20 h-20 text-green-500" />
            <div>
              <h2 className="text-2xl font-semibold text-green-400">You're In</h2>
              <p className="text-green-700 mt-1 text-sm">Attendance logged. Have a great shoot.</p>
            </div>
          </div>
        )}

        {status === 'already_checked_in' && (
          <div className="bg-yellow-950 border border-yellow-900 p-10 rounded-2xl flex flex-col items-center gap-4">
            <CheckCircle2 className="w-20 h-20 text-yellow-500" />
            <div>
              <h2 className="text-2xl font-semibold text-yellow-400">Already Checked In</h2>
              <p className="text-yellow-700 mt-1 text-sm">Your attendance for today has already been recorded.</p>
            </div>
          </div>
        )}

        {(status === 'idle' || status === 'locating' || status === 'submitting') && (
          <button
            onClick={handleCheckIn}
            disabled={isLoading}
            className="mx-auto w-64 h-64 rounded-full bg-neutral-900 border-4 border-neutral-800 flex flex-col items-center justify-center gap-4 hover:border-white hover:bg-neutral-800 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-14 h-14 animate-spin text-blue-400" />
                <span className="font-bold uppercase tracking-widest text-sm text-blue-400">
                  {status === 'locating' ? 'Finding GPS...' : 'Syncing...'}
                </span>
              </>
            ) : (
              <>
                <MapPin className="w-14 h-14 text-white" />
                <span className="font-bold uppercase tracking-widest text-sm">Tap to Check In</span>
              </>
            )}
          </button>
        )}

        {status === 'error' && (
          <>
            <div className="flex items-start gap-3 bg-red-950/50 border border-red-900/50 text-red-400 p-4 rounded-xl text-left text-sm mb-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
            <button
              onClick={() => setStatus('idle')}
              className="text-sm text-neutral-500 underline underline-offset-4"
            >
              Try again
            </button>
          </>
        )}

      </div>
    </main>
  );
}

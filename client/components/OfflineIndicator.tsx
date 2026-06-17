'use client';

import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Service Worker registration failed:', err);
      });
    }

    // Initial check
    setIsOffline(!window.navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      setIsSyncing(true);
      
      // Tell service worker to flush queue
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'FLUSH_QUEUE' });
      }

      // Hide syncing badge after 3 seconds
      setTimeout(() => setIsSyncing(false), 3000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !isSyncing) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-full shadow-lg border border-neutral-700 animate-in slide-in-from-bottom-5">
      {isOffline ? (
        <>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
          <WifiOff className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-semibold tracking-wide">Working Offline</span>
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 text-green-400 animate-spin" />
          <span className="text-xs font-semibold tracking-wide text-green-400">Syncing...</span>
        </>
      )}
    </div>
  );
}

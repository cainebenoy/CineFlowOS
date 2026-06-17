'use client';

import { Send } from 'lucide-react';
import { useState } from 'react';

export default function DistributeButton({ projectId }: { projectId: string }) {
  const [isDistributing, setIsDistributing] = useState(false);

  async function handleDistribute() {
    setIsDistributing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/distribute`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to distribute');
      alert('Call Sheet successfully pushed to crew via WhatsApp.');
    } catch (error) {
      alert('Distribution failed.');
    } finally {
      setIsDistributing(false);
    }
  }

  return (
    <button 
      onClick={handleDistribute}
      disabled={isDistributing}
      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded shadow text-sm font-medium hover:bg-green-700 disabled:opacity-50 print:hidden"
    >
      <Send className="w-4 h-4" />
      {isDistributing ? 'Sending...' : 'WhatsApp Crew'}
    </button>
  );
}

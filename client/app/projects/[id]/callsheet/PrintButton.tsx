'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button 
      onClick={() => window.print()} 
      className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded shadow text-sm font-medium hover:bg-neutral-800"
    >
      <Printer className="w-4 h-4" />
      Print Call Sheet
    </button>
  );
}

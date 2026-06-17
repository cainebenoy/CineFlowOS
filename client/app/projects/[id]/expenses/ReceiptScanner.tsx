'use client';

import { useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Camera, Upload, Loader2, CheckCircle2, AlertCircle, ReceiptText, IndianRupee, X } from 'lucide-react';

type ScanState = 'idle' | 'scanning' | 'confirming' | 'saving' | 'saved' | 'error';

interface ExtractionResult {
  vendor_name: string;
  gstin: string | null;
  amount: number;
  category: string;
}

export default function ReceiptScanner({ projectId }: { projectId: string }) {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiBase = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080';

  const reset = () => {
    setScanState('idle');
    setPreview(null);
    setExtraction(null);
    setNotes('');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file (JPG or PNG).');
      setScanState('error');
      return;
    }

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setScanState('scanning');

      // Strip the data URL header to get raw base64
      const base64 = dataUrl.split(',')[1];

      try {
        // Route through Go gateway — NOT directly to Python
        const res = await fetch(`${apiBase}/api/projects/${projectId}/expenses/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64,
            mime_type: file.type,
          }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'AI scan failed');

        setExtraction(json.data);
        setScanState('confirming');
      } catch (err: any) {
        setErrorMsg(err.message);
        setScanState('error');
      }
    };
    reader.readAsDataURL(file);
  }, [projectId, apiBase]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleConfirm = async () => {
    if (!extraction) return;
    setScanState('saving');

    try {
      const res = await fetch(`${apiBase}/api/projects/${projectId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...extraction, notes }),
      });
      if (!res.ok) throw new Error('Failed to save expense');
      setScanState('saved');
    } catch (err: any) {
      setErrorMsg(err.message);
      setScanState('error');
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <ReceiptText className="w-5 h-5 text-neutral-400" />
        <h2 className="font-bold text-lg">Scan Receipt</h2>
      </div>

      {/* IDLE: Upload Zone */}
      {scanState === 'idle' && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-neutral-300 rounded-sm p-10 text-center cursor-pointer hover:border-black hover:bg-neutral-50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Camera className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="font-semibold text-sm">Tap to snap or upload receipt</p>
          <p className="text-xs text-neutral-400 mt-1">JPG, PNG · Camera access required on mobile</p>
        </div>
      )}

      {/* SCANNING: AI Processing */}
      {scanState === 'scanning' && (
        <div className="text-center py-12 space-y-4">
          {preview && (
            <img src={preview} alt="Receipt" className="max-h-48 mx-auto object-contain rounded border border-neutral-200 mb-6" />
          )}
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
          <p className="font-semibold text-sm">Gemini is reading your receipt...</p>
          <p className="text-xs text-neutral-400">Extracting vendor, GSTIN, and amount</p>
        </div>
      )}

      {/* CONFIRMING: Show extraction, let user edit before saving */}
      {scanState === 'confirming' && extraction && (
        <div className="space-y-4">
          {preview && (
            <img src={preview} alt="Receipt" className="max-h-36 object-contain rounded border border-neutral-200 w-full" />
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-sm p-3 text-xs text-blue-700 font-medium">
            ✦ AI Extraction Complete — Review and confirm before saving
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 block mb-1">Vendor</label>
              <input
                className="w-full border border-neutral-300 rounded-sm px-3 py-2 text-sm font-mono"
                value={extraction.vendor_name}
                onChange={e => setExtraction({ ...extraction, vendor_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 block mb-1">Category</label>
              <select
                className="w-full border border-neutral-300 rounded-sm px-3 py-2 text-sm"
                value={extraction.category}
                onChange={e => setExtraction({ ...extraction, category: e.target.value })}
              >
                {['Catering','Transport','Art Department','Camera','Lighting','Location','Costume','Makeup','Post Production','Miscellaneous'].map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 block mb-1">Amount (₹)</label>
              <input
                type="number"
                className="w-full border border-neutral-300 rounded-sm px-3 py-2 text-sm font-mono font-bold"
                value={extraction.amount}
                onChange={e => setExtraction({ ...extraction, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 block mb-1">GSTIN</label>
              <input
                className="w-full border border-neutral-300 rounded-sm px-3 py-2 text-sm font-mono"
                value={extraction.gstin || ''}
                placeholder="Not detected"
                onChange={e => setExtraction({ ...extraction, gstin: e.target.value || null })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 block mb-1">Notes (optional)</label>
            <input
              className="w-full border border-neutral-300 rounded-sm px-3 py-2 text-sm"
              placeholder="e.g. Day 3 lunch for unit crew"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleConfirm}
              className="flex-1 bg-black text-white py-3 rounded-sm font-bold text-sm hover:bg-neutral-800 transition-colors"
            >
              Confirm & Save Expense
            </button>
            <button onClick={reset} className="px-4 py-3 border border-neutral-300 rounded-sm text-sm hover:bg-neutral-50">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SAVING */}
      {scanState === 'saving' && (
        <div className="text-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-black mx-auto mb-3" />
          <p className="text-sm font-semibold">Logging expense...</p>
        </div>
      )}

      {/* SAVED */}
      {scanState === 'saved' && (
        <div className="text-center py-10 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <p className="font-bold">Expense logged for approval</p>
          <button onClick={reset} className="text-sm text-neutral-500 underline underline-offset-4">Scan another receipt</button>
        </div>
      )}

      {/* ERROR */}
      {scanState === 'error' && (
        <div className="space-y-4 py-4">
          <div className="flex gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-sm text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{errorMsg}</p>
          </div>
          <button onClick={reset} className="text-sm text-neutral-500 underline underline-offset-4">Try again</button>
        </div>
      )}
    </div>
  );
}

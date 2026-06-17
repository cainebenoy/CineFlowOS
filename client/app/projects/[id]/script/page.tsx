'use client';

import { useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText, Upload, Loader2, CheckCircle2, AlertCircle,
  X, Play, ChevronDown, ChevronUp,
} from 'lucide-react';

type Mode = 'file' | 'text';
type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface ParseResult {
  scenes_parsed: number;
  scenes_failed: number;
  failures: { scene: number; heading: string; error: string }[];
}

export default function ScriptIngestionPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [mode, setMode] = useState<Mode>('file');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showFailures, setShowFailures] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiBase = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080';

  // ── File mode ──────────────────────────────────────────────────────────────

  const validateFile = (file: File): string | null => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.fountain') && !name.endsWith('.txt')) {
      return 'Only .fountain and .txt files are accepted.';
    }
    if (file.size > 10 * 1024 * 1024) return 'File exceeds 10 MB limit.';
    return null;
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setErrorMsg(err); setUploadState('error'); return; }
    setSelectedFile(file);
    setUploadState('idle');
    setErrorMsg('');
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setErrorMsg(err); setUploadState('error'); return; }
    setSelectedFile(file);
    setUploadState('idle');
    setErrorMsg('');
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setUploadState('uploading');
    setErrorMsg('');
    setResult(null);

    const form = new FormData();
    form.append('file', selectedFile);

    try {
      // POST to Go gateway — Go reads the file, proxies text to Python
      const res = await fetch(`${apiBase}/api/projects/${projectId}/script/upload`, {
        method: 'POST',
        body: form,
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Upload failed');

      setResult(json);
      setUploadState('success');
    } catch (err: any) {
      setErrorMsg(err.message);
      setUploadState('error');
    }
  };

  // ── Text mode (legacy) ─────────────────────────────────────────────────────

  const handleTextAnalyze = async () => {
    if (!text.trim()) return;
    setUploadState('uploading');
    setErrorMsg('');
    setResult(null);

    try {
      // Text mode still hits Python directly for backward compatibility
      const res = await fetch(`${process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8000'}/api/ai/parse-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, text }),
      });

      if (!res.ok) throw new Error('Failed to analyze script');
      setUploadState('success');
    } catch (err: any) {
      setErrorMsg(err.message);
      setUploadState('error');
    }
  };

  const goToSchedule = () => router.push(`/projects/${projectId}/schedule`);
  const reset = () => {
    setSelectedFile(null);
    setUploadState('idle');
    setErrorMsg('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="p-8 md:p-12 min-h-screen bg-neutral-100">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <header className="border-b border-neutral-300 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6 text-neutral-400" />
            <h1 className="text-3xl font-semibold tracking-tight">Script Ingestion</h1>
          </div>
          <p className="text-neutral-500 text-sm">
            Upload a <code className="bg-neutral-200 px-1.5 py-0.5 rounded text-xs font-mono">.fountain</code> file exported from Final Draft, Fade In, or Highland — or paste a brief directly.
          </p>
        </header>

        {/* Mode toggle */}
        <div className="flex border border-neutral-300 rounded-sm bg-white overflow-hidden w-fit">
          {(['file', 'text'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); reset(); }}
              className={`px-5 py-2 text-sm font-bold transition-colors ${
                mode === m ? 'bg-black text-white' : 'text-neutral-500 hover:bg-neutral-50'
              }`}
            >
              {m === 'file' ? '.fountain / .txt Upload' : 'Paste Text (Legacy)'}
            </button>
          ))}
        </div>

        {/* ── FILE MODE ── */}
        {mode === 'file' && (
          <div className="space-y-4">

            {/* Dropzone */}
            {uploadState !== 'success' && (
              <div
                onDrop={handleFileDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => !selectedFile && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-sm p-12 text-center transition-colors
                  ${selectedFile ? 'border-black bg-white cursor-default' : 'cursor-pointer'}
                  ${dragOver ? 'border-black bg-neutral-50' : 'border-neutral-300 bg-white hover:border-neutral-500 hover:bg-neutral-50'}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".fountain,.txt"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {selectedFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-black rounded flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm">{selectedFile.name}</p>
                        <p className="text-xs text-neutral-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); reset(); }}
                      className="text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-neutral-300 mx-auto mb-4" />
                    <p className="font-bold text-sm">Drop your script file here</p>
                    <p className="text-xs text-neutral-400 mt-1">.fountain or .txt · Max 10 MB</p>
                  </>
                )}
              </div>
            )}

            {/* Uploading */}
            {uploadState === 'uploading' && (
              <div className="bg-white border border-neutral-200 rounded-sm p-8 text-center space-y-3">
                <Loader2 className="w-10 h-10 animate-spin text-black mx-auto" />
                <p className="font-bold text-sm">Parsing script with Gemini...</p>
                <p className="text-xs text-neutral-400">Each scene is analysed individually. Large scripts may take up to 60 seconds.</p>
              </div>
            )}

            {/* Success */}
            {uploadState === 'success' && result && (
              <div className="bg-white border border-neutral-200 rounded-sm p-8 space-y-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
                  <div>
                    <p className="font-bold">Breakdown complete</p>
                    <p className="text-sm text-neutral-500">
                      {result.scenes_parsed} scene{result.scenes_parsed !== 1 ? 's' : ''} extracted and saved.
                      {result.scenes_failed > 0 && (
                        <span className="text-yellow-600"> {result.scenes_failed} scene{result.scenes_failed !== 1 ? 's' : ''} failed.</span>
                      )}
                    </p>
                  </div>
                </div>

                {result.scenes_failed > 0 && (
                  <div>
                    <button
                      onClick={() => setShowFailures(!showFailures)}
                      className="flex items-center gap-1 text-xs text-yellow-600 font-bold"
                    >
                      {showFailures ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showFailures ? 'Hide' : 'Show'} failures
                    </button>
                    {showFailures && (
                      <div className="mt-2 space-y-1">
                        {result.failures.map(f => (
                          <div key={f.scene} className="text-xs bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                            <span className="font-bold">Scene {f.scene}:</span> {f.heading} — {f.error}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={goToSchedule}
                  className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-sm font-bold text-sm hover:bg-neutral-800 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Open Schedule Board
                </button>
              </div>
            )}

            {/* Error */}
            {uploadState === 'error' && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-sm text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Upload failed</p>
                  <p className="mt-0.5">{errorMsg}</p>
                  <button onClick={reset} className="mt-2 underline underline-offset-4 text-xs">Try again</button>
                </div>
              </div>
            )}

            {/* Upload button */}
            {selectedFile && uploadState === 'idle' && (
              <button
                onClick={handleFileUpload}
                className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-sm font-bold text-sm hover:bg-neutral-800 transition-colors"
              >
                <Play className="w-4 h-4" />
                Parse &amp; Break Down Script
              </button>
            )}
          </div>
        )}

        {/* ── TEXT MODE (legacy) ── */}
        {mode === 'text' && (
          <div className="bg-white border border-neutral-200 rounded-sm overflow-hidden">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={'INT. TEA BUNGALOW - DAY\n\nWe see the tea gardens from the porch. ANJALI (30s) stares out...'}
              className="w-full h-80 p-6 resize-none focus:outline-none text-neutral-800 leading-relaxed text-sm font-mono"
              disabled={uploadState === 'uploading'}
            />
            <div className="bg-neutral-50 border-t border-neutral-200 p-4 flex items-center justify-between">
              <div className="text-sm text-red-600 font-medium">
                {errorMsg && <span>{errorMsg}</span>}
                {uploadState === 'success' && (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Done
                  </span>
                )}
              </div>
              <button
                onClick={uploadState === 'success' ? goToSchedule : handleTextAnalyze}
                disabled={uploadState === 'uploading' || (!text.trim() && uploadState !== 'success')}
                className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-sm text-sm font-bold transition-colors"
              >
                {uploadState === 'uploading' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                ) : uploadState === 'success' ? (
                  <><Play className="w-4 h-4" /> Open Schedule Board</>
                ) : (
                  <><Play className="w-4 h-4" /> Analyze &amp; Break Down</>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

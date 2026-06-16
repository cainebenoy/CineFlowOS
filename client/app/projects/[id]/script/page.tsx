'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FileText, Loader2, Play } from 'lucide-react';

export default function ScriptIngestionPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!text.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);

    try {
      // Send the text to your FastAPI AI Worker
      const res = await fetch('http://localhost:8000/api/ai/parse-brief', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          text: text,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to analyze script');
      }

      // Once successful, instantly route the user to their newly populated schedule
      router.push(`/projects/${projectId}/schedule`);
      
    } catch (err: any) {
      setError(err.message || 'Something went wrong connecting to the AI worker.');
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6 text-neutral-400" />
            <h1 className="text-3xl font-semibold tracking-tight">Script Ingestion</h1>
          </div>
          <p className="text-neutral-500">
            Paste your screenplay scene, client brief, or treatment. The AI engine will automatically extract scenes, cast, props, and timing constraints.
          </p>
        </header>

        <div className="bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="INT. TEA BUNGALOW - DAY. We see the tea gardens from the porch..."
            className="w-full h-96 p-6 resize-none focus:outline-none focus:ring-0 text-neutral-800 leading-relaxed"
            disabled={isAnalyzing}
          />
          
          <div className="bg-neutral-50 border-t border-neutral-200 p-4 flex items-center justify-between">
            <div className="text-sm text-red-600 font-medium">
              {error && <span>{error}</span>}
            </div>
            
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !text.trim()}
              className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-md text-sm font-medium transition-colors"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Production...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Analyze & Break Down
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}

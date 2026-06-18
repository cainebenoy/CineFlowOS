'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";

export default function NewProjectButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [projectType, setProjectType] = useState("ad_film");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('cineflow_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          project_type: projectType,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create project");
      }

      const newProject = await res.json();
      setIsOpen(false);
      setTitle("");
      setProjectType("ad_film");
      
      // Refresh the server component to show the new project
      router.refresh();
      
      // Navigate to the script ingestion for the new project
      router.push(`/projects/${newProject.id}/script`);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        New Project
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-lg shadow-xl max-w-md w-full overflow-hidden">
            <header className="flex justify-between items-center border-b border-neutral-100 p-5">
              <h2 className="text-lg font-semibold text-neutral-950">Create New Project</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Project Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Autumn Clothing Shoot"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 bg-white text-neutral-900"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Project Type
                </label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 bg-white text-neutral-900"
                  disabled={isSubmitting}
                >
                  <option value="ad_film">Ad Film (Commercial)</option>
                  <option value="wedding">Wedding / Event</option>
                  <option value="feature_film">Feature Film / Movie</option>
                  <option value="other">Other Production</option>
                </select>
              </div>

              <footer className="pt-4 flex justify-end gap-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-neutral-300 rounded-md text-sm font-medium hover:bg-neutral-50 text-neutral-700 transition-colors cursor-pointer"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
                  disabled={isSubmitting || !title.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

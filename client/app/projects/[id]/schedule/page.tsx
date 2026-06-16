import StripboardClient from './StripboardClient';

// Force dynamic rendering so it always fetches fresh data from Postgres
export const dynamic = 'force-dynamic';

async function getSchedule(projectId: string) {
  const res = await fetch(`http://localhost:8080/api/projects/${projectId}/schedule`, {
    cache: 'no-store'
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch schedule');
  }
  
  return res.json();
}

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenes = await getSchedule(id);

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 font-sans p-8 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="border-b border-neutral-300 pb-6 mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Scheduling Board</h1>
          <p className="text-neutral-500 mt-1">Drag and drop scenes to organize your shoot days.</p>
        </header>

        {/* Render the interactive client component */}
        <StripboardClient initialScenes={scenes} />
      </div>
    </main>
  );
}

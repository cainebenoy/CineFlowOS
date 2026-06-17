import PrintButton from './PrintButton';
import DistributeButton from './DistributeButton';

export const dynamic = 'force-dynamic';

interface Element {
  category: string;
  name: string;
}

interface CallSheetScene {
  scene_number: string;
  setting: string;
  time_of_day: string;
  summary: string;
  elements: Element[];
}

async function getCallSheet(projectId: string): Promise<CallSheetScene[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/callsheet`, {
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('Failed to fetch call sheet');
  return res.json();
}

export default async function CallSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenesRaw = await getCallSheet(id);
  const scenes = scenesRaw || [];

  // Helper to extract just the Cast members from the elements array
  const getCast = (elements: Element[]) => 
    elements.filter(e => e.category.toLowerCase() === 'cast').map(e => e.name).join(', ');

  // Helper to extract Props/Vehicles
  const getProps = (elements: Element[]) => 
    elements.filter(e => e.category.toLowerCase() !== 'cast').map(e => e.name).join(', ');

  return (
    <main className="bg-neutral-200 p-8 md:p-12 min-h-screen print:bg-white print:p-0">
      {/* Action Bar (Hidden when printing) */}
      <div className="max-w-[800px] mx-auto mb-4 flex justify-end gap-3 print:hidden">
        <DistributeButton projectId={id} />
        <PrintButton />
      </div>

      {/* The Printable Document */}
      <div className="max-w-[800px] mx-auto bg-white border border-neutral-300 shadow-sm p-10 print:border-none print:shadow-none print:p-0">
        
        {/* Header */}
        <div className="border-b-4 border-black pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">Daily Call Sheet</h1>
            <p className="text-neutral-600 font-medium mt-1">CineFlow OS Production</p>
          </div>
          <div className="text-right text-sm font-bold uppercase tracking-widest text-neutral-500">
            Crew Call: 06:00 AM
          </div>
        </div>

        {/* Scene Table */}
        <table className="w-full text-left text-sm border-collapse mb-8">
          <thead>
            <tr className="bg-black text-white uppercase text-xs tracking-wider">
              <th className="p-2 w-12 text-center">Sc</th>
              <th className="p-2 w-16">Set</th>
              <th className="p-2 w-20">Time</th>
              <th className="p-2">Description</th>
              <th className="p-2 w-48">Cast / Props</th>
            </tr>
          </thead>
          <tbody>
            {scenes.map((scene, idx) => (
              <tr key={idx} className="border-b border-neutral-300 align-top">
                <td className="p-3 text-center font-bold font-mono">{scene.scene_number}</td>
                <td className="p-3 font-bold">{scene.setting}</td>
                <td className="p-3 text-neutral-600">{scene.time_of_day}</td>
                <td className="p-3 font-medium">{scene.summary}</td>
                <td className="p-3 text-xs">
                  {getCast(scene.elements) && <div className="font-bold text-black mb-1">CAST: {getCast(scene.elements)}</div>}
                  {getProps(scene.elements) && <div className="text-neutral-600 border-t border-neutral-200 pt-1 mt-1">REQ: {getProps(scene.elements)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer info */}
        <div className="text-xs text-center text-neutral-400 font-mono mt-12 print:mt-auto">
          Generated automatically by CineFlow OS
        </div>
      </div>
    </main>
  );
}

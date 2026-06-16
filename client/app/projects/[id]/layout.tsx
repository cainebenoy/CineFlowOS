import ProjectNav from './ProjectNav';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900">
      {/* Inject the persistent navigation bar */}
      <ProjectNav projectId={id} />
      
      {/* The active page (Script, Schedule, or Call Sheet) will render here */}
      <div className="pt-4">
        {children}
      </div>
    </div>
  );
}

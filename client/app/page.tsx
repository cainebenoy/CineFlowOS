import { Calendar, Film, LayoutGrid, Video } from "lucide-react";
import Link from "next/link";
import NewProjectButton from "./NewProjectButton";

// 1. Define the TypeScript interface matching our Go struct
interface Project {
  id: string;
  title: string;
  project_type: string;
  status: string;
  created_at: string;
}

// 2. Fetch data directly from our Go API Gateway
async function getProjects(): Promise<Project[]> {
  // We use "no-store" to ensure it always fetches the freshest data from Postgres
  const res = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch projects");
  }
  return res.json();
}

// Helper to format the Postgres timestamp into a readable date
function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// Helper to render the correct icon based on project type
function getProjectIcon(type: string) {
  switch (type) {
    case "ad_film": return <Video className="w-5 h-5 text-neutral-500" />;
    case "wedding": return <Calendar className="w-5 h-5 text-neutral-500" />;
    default: return <Film className="w-5 h-5 text-neutral-500" />;
  }
}

// 3. Render the Server Component
export default async function Dashboard() {
  const projects = await getProjects();

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 font-sans p-8 md:p-12">
      <div className="max-w-6xl mx-auto">

        {/* Header Section */}
        <header className="flex justify-between items-center mb-10 border-b border-neutral-200 pb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">CineFlow OS</h1>
            <p className="text-neutral-500 mt-1">Production Operations Dashboard</p>
          </div>
          <NewProjectButton />
        </header>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 ? (
            <div className="col-span-full py-12 text-center text-neutral-400 border border-dashed border-neutral-300 rounded-lg">
              No projects found. Create your first production.
            </div>
          ) : (
            projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}/script`}
                className="group bg-white border border-neutral-200 rounded-lg p-5 hover:shadow-sm hover:border-neutral-300 transition-all flex flex-col justify-between h-40"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-neutral-100 rounded-md">
                      {getProjectIcon(project.project_type)}
                    </div>
                    <div>
                      <h3 className="font-medium text-neutral-900 truncate max-w-[200px]">
                        {project.title}
                      </h3>
                      <p className="text-xs text-neutral-500 capitalize mt-0.5">
                        {project.project_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium bg-green-50 text-green-700 uppercase tracking-wider">
                    {project.status}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-neutral-100 text-xs text-neutral-500 flex items-center justify-between">
                  <span>Created {formatDate(project.created_at)}</span>
                  <LayoutGrid className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                </div>
              </Link>
            ))
          )}
        </div>

      </div>
    </main>
  );
}
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutGrid, FileText, CalendarDays, Printer, Clapperboard, Calculator, Film, Terminal, UserCheck, Wallet, FileSpreadsheet, Archive, LayoutDashboard, Video } from 'lucide-react';

export default function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('cineflow_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setRole(user.role);
      } catch (e) {}
    }
  }, []);

  const allNavItems = [
    { name: 'All Projects', path: `/`, icon: LayoutGrid, exact: true },
    { name: 'Script Ingestion', path: `/projects/${projectId}/script`, icon: FileText, exact: false },
    { name: 'Schedule Board', path: `/projects/${projectId}/schedule`, icon: CalendarDays, exact: false },
    { name: 'Call Sheet', path: `/projects/${projectId}/callsheet`, icon: Printer, exact: false },
    { name: 'Daily Progress', path: `/projects/${projectId}/dpr`, icon: LayoutGrid, exact: false },
    { name: 'Continuity Log', path: `/projects/${projectId}/continuity`, icon: Clapperboard, exact: false },
    { name: 'Financial Ledger', path: `/projects/${projectId}/budget`, icon: Calculator, exact: false, roles: ['Line Producer'] },
    { name: 'Tax & Compliance', path: `/projects/${projectId}/taxes`, icon: FileSpreadsheet, exact: false, roles: ['Line Producer'] },
    { name: 'VFX Pipeline', path: `/projects/${projectId}/vfx`, icon: Video, exact: false },
    { name: 'Deliverables', path: `/projects/${projectId}/deliverables`, icon: Archive, exact: false },
    { name: 'Crew & Attendance', path: `/projects/${projectId}/crew`, icon: UserCheck, exact: false },
    { name: 'Petty Cash', path: `/projects/${projectId}/expenses`, icon: Wallet, exact: false },
    { name: 'Activity Feed', path: `/projects/${projectId}/audit`, icon: Terminal, exact: false, roles: ['Line Producer'] },
  ];

  const navItems = allNavItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(role || '');
  });

  return (
    <nav className="bg-white border-b border-neutral-200 sticky top-0 z-50 print:hidden">
      <div className="max-w-6xl mx-auto px-8 md:px-12">
        <div className="flex items-center gap-8 h-14">
          {navItems.map((item) => {
            // Check if the current path matches the item's path
            const isActive = item.exact 
              ? pathname === item.path 
              : pathname.includes(item.path);
            
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center gap-2 text-sm font-medium transition-all h-full border-b-2 ${
                  isActive 
                    ? 'border-neutral-900 text-neutral-900' 
                    : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

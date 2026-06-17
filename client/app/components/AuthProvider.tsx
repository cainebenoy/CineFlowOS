'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if the route is protected
    const isProtectedRoute = pathname.startsWith('/projects');
    
    if (isProtectedRoute) {
      const token = localStorage.getItem('cineflow_token');
      if (!token) {
        router.push('/login');
      } else {
        setIsAuthenticated(true);
      }
    } else {
      setIsAuthenticated(true);
    }
  }, [pathname, router]);

  // Prevent flash of protected content before redirect
  if (pathname.startsWith('/projects') && !isAuthenticated) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-500 text-sm font-medium tracking-widest uppercase">Verifying Access...</div>;
  }

  return <>{children}</>;
}

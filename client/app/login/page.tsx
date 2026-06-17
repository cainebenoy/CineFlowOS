'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('lp@cineflow.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await res.json();
      
      // Store JWT in localStorage
      localStorage.setItem('cineflow_token', data.token);
      localStorage.setItem('cineflow_user', JSON.stringify(data.user));

      // Redirect to the multi-tenant Studio Dashboard
      router.push('/projects');
      
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-neutral-50 selection:bg-indigo-500/30">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-4xl font-black tracking-tight uppercase">
          CineFlow OS
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-400 font-medium tracking-wide">
          RESTRICTED PRODUCTION ACCESS
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-neutral-900 py-8 px-4 shadow-2xl sm:rounded-lg sm:px-10 border border-neutral-800">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Email Address
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-neutral-700 rounded-md shadow-sm placeholder-neutral-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-neutral-950 text-neutral-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-neutral-700 rounded-md shadow-sm placeholder-neutral-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-neutral-950 text-neutral-100"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm font-medium text-rose-500 bg-rose-500/10 p-3 rounded border border-rose-500/20">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-neutral-900 transition-colors uppercase tracking-wider disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : (
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Sign In
                  </span>
                )}
              </button>
            </div>
            
            <div className="pt-4 mt-6 border-t border-neutral-800">
              <p className="text-xs text-neutral-500 text-center font-mono">
                Demo Accounts:<br/>
                lp@cineflow.com (Line Producer)<br/>
                ad@cineflow.com (Assistant Director)<br/>
                vfx@cineflow.com (VFX Supervisor)<br/>
                Password: password123
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

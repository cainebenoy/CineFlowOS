'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Calculator } from 'lucide-react';

interface BudgetItem {
  id: string;
  category: string;
  name: string;
  estimated_cost: number;
  actual_cost: number;
}

export default function BudgetPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/budget`)
      .then(res => res.json())
      .then(data => {
        setItems(data || []);
        setIsLoading(false);
      });
  }, [projectId]);

  const handleUpdate = async (id: string, field: 'estimated_cost' | 'actual_cost', value: string) => {
    const numValue = parseFloat(value) || 0;
    
    // Optimistic UI update
    setItems(current => 
      current.map(item => item.id === id ? { ...item, [field]: numValue } : item)
    );

    const itemToUpdate = items.find(i => i.id === id);
    if (!itemToUpdate) return;

    const payload = {
      estimated_cost: field === 'estimated_cost' ? numValue : itemToUpdate.estimated_cost,
      actual_cost: field === 'actual_cost' ? numValue : itemToUpdate.actual_cost,
    };

    // Background sync to Go API
    await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080'}/api/projects/${projectId}/budget/elements/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const totalEstimate = items.reduce((acc, curr) => acc + curr.estimated_cost, 0);
  const totalActual = items.reduce((acc, curr) => acc + curr.actual_cost, 0);
  const variance = totalEstimate - totalActual;

  if (isLoading) return <div className="p-12 text-neutral-500">Loading ledger...</div>;

  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans p-8 md:p-12">
      <div className="max-w-5xl mx-auto">
        
        <header className="mb-8 flex justify-between items-end border-b border-neutral-300 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Calculator className="w-6 h-6 text-neutral-400" />
              <h1 className="text-3xl font-semibold tracking-tight">Financial Ledger</h1>
            </div>
            <p className="text-neutral-500">Track estimates vs actuals across all AI-extracted breakdown elements.</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-neutral-500 font-bold uppercase tracking-widest mb-1">Total Variance</p>
            <p className={`text-3xl font-mono font-black ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{variance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </header>

        {/* Dense Data Grid */}
        <div className="border border-neutral-300 rounded-sm overflow-hidden">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-100 border-b border-neutral-300 text-xs uppercase tracking-wider text-neutral-600">
                <th className="p-3 font-bold border-r border-neutral-300 w-48">Category</th>
                <th className="p-3 font-bold border-r border-neutral-300">Element Name</th>
                <th className="p-3 font-bold border-r border-neutral-300 w-48 bg-neutral-50">Estimated (₹)</th>
                <th className="p-3 font-bold w-48 bg-neutral-50">Actual (₹)</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {items.map((item) => (
                <tr key={item.id} className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <td className="p-3 border-r border-neutral-200 text-neutral-500">{item.category}</td>
                  <td className="p-3 border-r border-neutral-200 font-medium">{item.name}</td>
                  <td className="p-0 border-r border-neutral-200">
                    <input 
                      type="number" 
                      defaultValue={item.estimated_cost}
                      onBlur={(e) => handleUpdate(item.id, 'estimated_cost', e.target.value)}
                      className="w-full h-full p-3 bg-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    />
                  </td>
                  <td className="p-0">
                    <input 
                      type="number" 
                      defaultValue={item.actual_cost}
                      onBlur={(e) => handleUpdate(item.id, 'actual_cost', e.target.value)}
                      className="w-full h-full p-3 bg-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    />
                  </td>
                </tr>
              ))}
              {/* Rollup Row */}
              <tr className="bg-neutral-900 text-white font-bold">
                <td colSpan={2} className="p-3 text-right uppercase tracking-wider text-xs">Totals</td>
                <td className="p-3 border-r border-neutral-700">₹{totalEstimate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="p-3">₹{totalActual.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}

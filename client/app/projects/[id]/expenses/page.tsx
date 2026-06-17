'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Wallet, CheckCircle2, XCircle, Clock, IndianRupee, RefreshCw } from 'lucide-react';
import ReceiptScanner from './ReceiptScanner';

interface Expense {
  id: string;
  vendor_name: string;
  gstin: string;
  amount: number;
  category: string;
  status: string;
  notes: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  Pending:  'bg-yellow-100 text-yellow-700 border-yellow-300',
  Approved: 'bg-green-100 text-green-700 border-green-300',
  Rejected: 'bg-red-100 text-red-700 border-red-300',
};

export default function ExpensesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const apiBase = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080';

  const fetchExpenses = useCallback(async () => {
    const res = await fetch(`${apiBase}/api/projects/${projectId}/expenses`);
    const data = await res.json();
    setExpenses(data || []);
    setIsLoading(false);
  }, [projectId, apiBase]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const updateStatus = async (expenseId: string, status: 'Approved' | 'Rejected') => {
    // Optimistic update
    setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status } : e));

    await fetch(`${apiBase}/api/projects/${projectId}/expenses/${expenseId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  };

  const totalPending  = expenses.filter(e => e.status === 'Pending').reduce((s, e) => s + e.amount, 0);
  const totalApproved = expenses.filter(e => e.status === 'Approved').reduce((s, e) => s + e.amount, 0);

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 font-sans p-8 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex justify-between items-end border-b border-neutral-300 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="w-6 h-6 text-neutral-400" />
              <h1 className="text-3xl font-semibold tracking-tight">Petty Cash Ledger</h1>
            </div>
            <p className="text-neutral-500">OCR-powered receipts with Line Producer approval workflow.</p>
          </div>
          <button
            onClick={fetchExpenses}
            className="flex items-center gap-2 text-sm text-neutral-500 border border-neutral-300 bg-white px-4 py-2 rounded-sm hover:bg-neutral-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-neutral-200 p-6 rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">Total Receipts</p>
            <p className="text-3xl font-black font-mono">{expenses.length}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-600 mb-1">Pending Approval</p>
            <div className="flex items-center gap-1">
              <IndianRupee className="w-5 h-5 text-yellow-700" />
              <p className="text-3xl font-black font-mono text-yellow-700">{totalPending.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 p-6 rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-1">Approved Spend</p>
            <div className="flex items-center gap-1">
              <IndianRupee className="w-5 h-5 text-green-700" />
              <p className="text-3xl font-black font-mono text-green-700">{totalApproved.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-8">

          {/* Left: Scanner */}
          <div className="col-span-2">
            <ReceiptScanner projectId={projectId} />
          </div>

          {/* Right: Ledger */}
          <div className="col-span-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500 mb-4">Approval Queue</h2>

            {isLoading ? (
              <div className="text-neutral-400 text-sm">Loading ledger...</div>
            ) : expenses.length === 0 ? (
              <div className="bg-white border border-dashed border-neutral-300 p-8 text-center text-neutral-400 text-sm rounded-sm">
                No expenses logged yet. Scan a receipt to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {expenses.map(expense => (
                  <div key={expense.id} className="bg-white border border-neutral-200 p-4 rounded-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm truncate">{expense.vendor_name || 'Unknown Vendor'}</p>
                          <span className={`text-xs px-2 py-0.5 rounded border font-bold ${STATUS_STYLES[expense.status] || ''}`}>
                            {expense.status}
                          </span>
                          <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
                            {expense.category}
                          </span>
                        </div>
                        {expense.gstin && (
                          <p className="text-xs text-neutral-400 font-mono mt-0.5">GSTIN: {expense.gstin}</p>
                        )}
                        {expense.notes && (
                          <p className="text-xs text-neutral-500 mt-1 italic">"{expense.notes}"</p>
                        )}
                        <p className="text-xs text-neutral-400 mt-1">
                          {new Date(expense.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-0.5 justify-end mb-2">
                          <IndianRupee className="w-4 h-4 text-neutral-700" />
                          <p className="text-lg font-black font-mono">{expense.amount.toLocaleString('en-IN')}</p>
                        </div>

                        {expense.status === 'Pending' && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => updateStatus(expense.id, 'Approved')}
                              className="flex items-center gap-1 text-xs text-green-700 border border-green-300 bg-green-50 px-2 py-1.5 rounded hover:bg-green-100 transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Approve
                            </button>
                            <button
                              onClick={() => updateStatus(expense.id, 'Rejected')}
                              className="flex items-center gap-1 text-xs text-red-700 border border-red-300 bg-red-50 px-2 py-1.5 rounded hover:bg-red-100 transition-colors"
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}

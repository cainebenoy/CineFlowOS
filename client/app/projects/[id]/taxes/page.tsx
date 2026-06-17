'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { FileDown, RefreshCw, Landmark, IndianRupee, PieChart } from 'lucide-react';

interface TaxWithholding {
  id: string;
  entity_type: string;
  entity_name: string;
  pan_number: string;
  section: string;
  gross_amount: number;
  tds_deducted: number;
  net_payable: number;
  created_at: string;
}

export default function TaxesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [ledger, setLedger] = useState<TaxWithholding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const apiBase = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080';

  const fetchLedger = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/projects/${projectId}/taxes`);
      const data = await res.json();
      setLedger(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, apiBase]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  const handleExport = () => {
    window.open(`${apiBase}/api/projects/${projectId}/taxes/export`, '_blank');
  };

  const totalTDS = ledger.reduce((sum, item) => sum + item.tds_deducted, 0);
  const totalGross = ledger.reduce((sum, item) => sum + item.gross_amount, 0);
  const tds194C = ledger.filter(i => i.section === '194C').reduce((sum, item) => sum + item.tds_deducted, 0);
  const tds194J = ledger.filter(i => i.section === '194J').reduce((sum, item) => sum + item.tds_deducted, 0);

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 font-sans p-8 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex justify-between items-end border-b border-neutral-300 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Landmark className="w-6 h-6 text-neutral-400" />
              <h1 className="text-3xl font-semibold tracking-tight">Tax &amp; Compliance</h1>
            </div>
            <p className="text-neutral-500 text-sm">Automated TDS withholding ledger for accounting and Challan generation.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchLedger}
              className="flex items-center gap-2 text-sm text-neutral-500 border border-neutral-300 bg-white px-4 py-2 rounded-sm hover:bg-neutral-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 text-sm text-white bg-black px-4 py-2 rounded-sm hover:bg-neutral-800 transition-colors font-bold"
            >
              <FileDown className="w-4 h-4" />
              Export CSV Report
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-1 bg-white border border-neutral-200 p-6 rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">Total TDS Liability</p>
            <div className="flex items-center gap-1">
              <IndianRupee className="w-5 h-5 text-neutral-800" />
              <p className="text-3xl font-black font-mono text-neutral-800">{totalTDS.toLocaleString('en-IN')}</p>
            </div>
            <p className="text-xs text-neutral-400 mt-2">On ₹{totalGross.toLocaleString('en-IN')} Gross</p>
          </div>
          
          <div className="col-span-1 bg-blue-50 border border-blue-200 p-6 rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1">Sec 194C (Contractors)</p>
            <div className="flex items-center gap-1">
              <IndianRupee className="w-5 h-5 text-blue-700" />
              <p className="text-3xl font-black font-mono text-blue-700">{tds194C.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="col-span-1 bg-purple-50 border border-purple-200 p-6 rounded-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-1">Sec 194J (Professional)</p>
            <div className="flex items-center gap-1">
              <IndianRupee className="w-5 h-5 text-purple-700" />
              <p className="text-3xl font-black font-mono text-purple-700">{tds194J.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="col-span-1 bg-neutral-900 text-white p-6 rounded-sm flex flex-col justify-center items-center text-center">
            <PieChart className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Total Deductions</p>
            <p className="text-2xl font-black font-mono">{ledger.length}</p>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white border border-neutral-200 rounded-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Entity</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">PAN Number</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500">Sec</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500 text-right">Gross (₹)</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-red-600 text-right">TDS (₹)</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-green-600 text-right">Net Payable (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-neutral-400">Loading ledger...</td>
                </tr>
              ) : ledger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-400">
                    No tax deductions logged yet. Approve a petty cash expense or run crew payroll to generate ledger entries.
                  </td>
                </tr>
              ) : (
                ledger.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-neutral-500">
                      {new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-neutral-900">{row.entity_name}</div>
                      <div className="text-xs text-neutral-400">{row.entity_type}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-mono text-xs px-2 py-1 rounded border ${
                        row.pan_number === 'UNREGISTERED' || !row.pan_number 
                          ? 'bg-red-50 text-red-700 border-red-200' 
                          : 'bg-neutral-100 text-neutral-700 border-neutral-300'
                      }`}>
                        {row.pan_number || 'UNREGISTERED'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-neutral-600 bg-neutral-100 px-2 py-1 rounded">
                        {row.section}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-neutral-600">
                      {row.gross_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-red-600">
                      -{row.tds_deducted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-green-700">
                      {row.net_payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}

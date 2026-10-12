import React, { useEffect, useState } from 'react';
import { Activity, Cpu, Layers, Database, ShieldCheck, RefreshCw, Key, Settings as SettingsIcon } from 'lucide-react';
import { fetchHealth, syncAllDocuments, SystemHealth } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    }
  };

  const handleFullReindex = async () => {
    if (!window.confirm('Force reindex all discovered PDFs? This will recreate dense vectors and BM25 index.')) {
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncAllDocuments(true);
      setSyncMessage(`Reindexed ${res.indexed_count} documents successfully.`);
      await loadHealth();
    } catch (err: any) {
      setSyncMessage(`Reindexing failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">System Configuration & Health</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Diagnostic verification of Gemini API connectivity, retrieval indexes, and local database
          </p>
        </div>

        {syncMessage && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs flex items-center justify-between">
            <span>{syncMessage}</span>
            <button onClick={() => setSyncMessage(null)} className="text-blue-500 hover:text-blue-700">×</button>
          </div>
        )}

        {/* Live Diagnostics Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Operational Health Check</h3>
                <p className="text-[11px] text-slate-500">Real-time status of backend services</p>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 ${
                health?.status === 'healthy'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{health?.status === 'healthy' ? 'All Systems Operational' : 'Degraded State'}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <span className="text-slate-600 flex items-center space-x-2">
                <Key className="w-4 h-4 text-brand-500" />
                <span>Gemini API Key:</span>
              </span>
              <span className="font-semibold text-emerald-600">
                {health?.gemini_api_configured ? 'Configured & Active' : 'Missing'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <span className="text-slate-600 flex items-center space-x-2">
                <Database className="w-4 h-4 text-brand-500" />
                <span>SQLite Database:</span>
              </span>
              <span className="font-semibold text-emerald-600">
                {health?.database_connected ? 'Connected' : 'Error'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <span className="text-slate-600 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-brand-500" />
                <span>FAISS Dense Index:</span>
              </span>
              <span className="font-semibold text-emerald-600">
                {health?.vector_index_present ? 'Ready on Disk' : 'Missing'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <span className="text-slate-600 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-brand-500" />
                <span>BM25 Keyword Index:</span>
              </span>
              <span className="font-semibold text-emerald-600">
                {health?.bm25_index_present ? 'Ready on Disk' : 'Missing'}
              </span>
            </div>
          </div>
        </div>

        {/* Configuration & Retrieval Tuning Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Engine & Retrieval Pipeline Configuration</h3>
              <p className="text-[11px] text-slate-500">Parameters controlling parsing, hybrid fusion, and LLM inference</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-600">Generative Model:</span>
              <span className="font-mono font-semibold text-slate-800">{health?.gemini_model || 'gemini-flash-latest'}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-600">Dense Embedding Model:</span>
              <span className="font-mono font-semibold text-slate-800">{health?.embedding_model || 'models/gemini-embedding-001'}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-600">Hybrid Fusion Algorithm:</span>
              <span className="font-semibold text-slate-800">Reciprocal Rank Fusion (RRF, k=60)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-600">Retrieval Candidates:</span>
              <span className="font-semibold text-slate-800">10 Dense + 10 BM25 → Top 5 Fused Contexts</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-slate-50 border border-slate-100">
              <span className="text-slate-600">Target Chunk Size & Overlap:</span>
              <span className="font-semibold text-slate-800">~600 tokens (100 token overlap)</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              To update API keys or parameters, adjust the backend `.env` configuration file.
            </span>
            <button
              onClick={handleFullReindex}
              disabled={syncing}
              className="px-3.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Rebuilding Index...' : 'Force Full Reindex'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

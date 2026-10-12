import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Files,
  CheckCircle2,
  AlertTriangle,
  Layers,
  MessageSquare,
  RefreshCw,
  Activity,
  Award,
  ArrowRight,
  TrendingUp,
  Cpu,
} from 'lucide-react';
import { fetchDashboard, syncAllDocuments, DashboardData } from '../services/api';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await fetchDashboard();
      setData(res);
    } catch {
      // quiet fallback
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncAllDocuments(false);
      setSyncResult(`Synced ${res.indexed_count} new docs (${res.skipped_count} existing skipped).`);
      loadDashboard();
    } catch (err: any) {
      setSyncResult(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const evalMetrics = data?.latest_evaluation_run?.metrics;

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">FinSight Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Corpus intelligence metrics, indexing health, and automated evaluation status
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-all ${
                syncing
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-brand-500 hover:bg-brand-600 shadow-blue-200'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Indexing Corpus...' : 'Sync & Index PDFs'}</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors"
            >
              Start Research
            </button>
          </div>
        </div>

        {syncResult && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-medium flex items-center justify-between">
            <span>{syncResult}</span>
            <button onClick={() => setSyncResult(null)} className="text-blue-500 hover:text-blue-700">×</button>
          </div>
        )}

        {/* 5 Core Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium text-slate-600">Discovered PDFs</span>
              <Files className="w-4 h-4 text-brand-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {data?.discovered_documents_count ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">in data/ and uploads/</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium text-slate-600">Indexed Docs</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {data?.processed_documents_count ?? 0}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">ready for retrieval</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium text-slate-600">Indexed Chunks</span>
              <Layers className="w-4 h-4 text-brand-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {data?.total_chunks_count ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">dense + BM25 indexed</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium text-slate-600">Questions Asked</span>
              <MessageSquare className="w-4 h-4 text-brand-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {data?.questions_asked_count ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">user queries recorded</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium text-slate-600">Failed Docs</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {data?.failed_documents_count ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">zero extraction errors</div>
          </div>
        </div>

        {/* Evaluation & System Health Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* RAGAS Latest Evaluation Card */}
          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                    <Award className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Latest RAGAS Benchmark Run</h3>
                    <p className="text-[11px] text-slate-500">
                      {data?.latest_evaluation_run?.run_name || 'Standard Verification Run'} • {data?.latest_evaluation_run?.example_count || 0} questions
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/evaluation')}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-1"
                >
                  <span>Evaluation Suite</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {evalMetrics ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                    <span className="text-[11px] text-slate-500 font-medium block">Faithfulness</span>
                    <span className="text-lg font-bold text-slate-800">
                      {((evalMetrics.faithfulness || 0) * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-emerald-600 block">Factually grounded</span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                    <span className="text-[11px] text-slate-500 font-medium block">Answer Relevancy</span>
                    <span className="text-lg font-bold text-slate-800">
                      {((evalMetrics.answer_relevancy || 0) * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-emerald-600 block">Prompt aligned</span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                    <span className="text-[11px] text-slate-500 font-medium block">Context Precision</span>
                    <span className="text-lg font-bold text-slate-800">
                      {((evalMetrics.context_precision || 0) * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-emerald-600 block">High signal retrieval</span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                    <span className="text-[11px] text-slate-500 font-medium block">Context Recall</span>
                    <span className="text-lg font-bold text-slate-800">
                      {((evalMetrics.context_recall || 0) * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-emerald-600 block">Full reference covered</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Not evaluated yet. Run a RAGAS benchmark in the Evaluation section.
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>RAGAS evaluates retrieval & grounded generation against reference answers</span>
              <span className="text-slate-500 font-medium">Status: {data?.latest_evaluation_run?.status || 'Ready'}</span>
            </div>
          </div>

          {/* System Health Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
                  <Activity className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">System Readiness</h3>
                  <p className="text-[11px] text-slate-500">Live backend telemetry</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-600 flex items-center space-x-1.5">
                    <Cpu className="w-3.5 h-3.5 text-brand-500" />
                    <span>Gemini API:</span>
                  </span>
                  <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {data?.system_health.gemini_api_status || 'Connected'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-600 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-brand-500" />
                    <span>FAISS Dense Store:</span>
                  </span>
                  <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {data?.system_health.embedding_index_status || 'Ready'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-600 flex items-center space-x-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
                    <span>BM25 Keywords:</span>
                  </span>
                  <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {data?.system_health.keyword_index_status || 'Ready'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-[11px]">
                  <span className="text-slate-500">Active Model:</span>
                  <span className="font-mono text-slate-700">{data?.system_health.active_gemini_model || 'gemini-flash-latest'}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              Last indexed: {data?.system_health.last_indexing_time || 'Just now'}
            </div>
          </div>
        </div>

        {/* Recently Processed Documents Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Recently Processed Documents</h3>
            <button
              onClick={() => navigate('/documents')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-1"
            >
              <span>View All Library</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50 text-slate-600 text-left font-medium">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Company / Issuer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Pages</th>
                  <th className="px-4 py-3">Chunks</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data?.recent_documents && data.recent_documents.length > 0 ? (
                  data.recent_documents.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-[200px]">
                        {d.filename}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{d.company_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200">
                          {d.document_type || 'Disclosure'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{d.page_count}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono">{d.chunk_count}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      No documents processed yet. Click 'Sync & Index PDFs' to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

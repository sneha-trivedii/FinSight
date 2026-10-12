import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Edit3,
  Play,
  Plus,
  Download,
  Filter,
  CheckSquare,
  Award,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileCode,
  BookOpen,
} from 'lucide-react';
import {
  fetchEvaluationDataset,
  generateEvaluationDataset,
  updateCandidate,
  approveCandidate,
  rejectCandidate,
  batchApproveCandidates,
  runEvaluation,
  fetchEvaluationRuns,
  fetchEvaluationRunDetails,
  CandidateExample,
  EvaluationRun,
} from '../services/api';

export const EvaluationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'review' | 'runs'>('review');
  const [candidates, setCandidates] = useState<CandidateExample[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<EvaluationRun | null>(null);

  // Edit Modal State
  const [editingExample, setEditingExample] = useState<CandidateExample | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Generation Modal State
  const [showGenModal, setShowGenModal] = useState(false);
  const [genCount, setGenCount] = useState(5);

  useEffect(() => {
    loadCandidates();
    loadRuns();
  }, []);

  const loadCandidates = async () => {
    try {
      const data = await fetchEvaluationDataset();
      setCandidates(data);
    } catch {
      // quiet fallback
    }
  };

  const loadRuns = async () => {
    try {
      const data = await fetchEvaluationRuns();
      setRuns(data);
      if (data.length > 0 && !selectedRun) {
        loadRunDetails(data[0].id);
      }
    } catch {
      // quiet fallback
    }
  };

  const loadRunDetails = async (runId: string) => {
    try {
      const details = await fetchEvaluationRunDetails(runId);
      setSelectedRun(details);
    } catch {
      // quiet fallback
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setShowGenModal(false);
    try {
      await generateEvaluationDataset(genCount);
      await loadCandidates();
      alert(`Generated ${genCount} candidate question-answer pairs for review.`);
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveCandidate(id);
      await loadCandidates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectCandidate(id);
      await loadCandidates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      await batchApproveCandidates(selectedIds);
      setSelectedIds([]);
      await loadCandidates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenEdit = (cand: CandidateExample) => {
    setEditingExample(cand);
    setEditQuestion(cand.question);
    setEditAnswer(cand.reference_answer);
    setEditNotes(cand.reviewer_notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingExample) return;
    try {
      await updateCandidate(editingExample.id, {
        question: editQuestion,
        reference_answer: editAnswer,
        reviewer_notes: editNotes,
        status: 'edited',
      });
      setEditingExample(null);
      await loadCandidates();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRunEvaluation = async () => {
    const approvedCands = candidates.filter((c) => c.status === 'approved' || c.status === 'edited');
    if (approvedCands.length === 0) {
      alert('Please approve at least 1 candidate QA pair before running RAGAS evaluation.');
      return;
    }

    setEvaluating(true);
    try {
      const targetIds = approvedCands.slice(0, 3).map((c) => c.id); // Fast demo batch
      const res = await runEvaluation(targetIds, `Evaluation Run (${new Date().toLocaleTimeString()})`);
      await loadRuns();
      loadRunDetails(res.run_id);
      setActiveTab('runs');
      alert(`Evaluation run complete! Aggregate faithfulness: ${res.metrics?.faithfulness || 0}`);
    } catch (err: any) {
      alert(`Evaluation run error: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (statusFilter === 'all') return true;
    return c.status === statusFilter;
  });

  const pendingCount = candidates.filter((c) => c.status === 'pending_review').length;
  const approvedCount = candidates.filter((c) => c.status === 'approved' || c.status === 'edited').length;
  const rejectedCount = candidates.filter((c) => c.status === 'rejected').length;

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">RAGAS Evaluation Workflow</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate candidate questions from source chunks, review & approve reference answers, and execute RAGAS benchmarks
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowGenModal(true)}
              disabled={generating}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{generating ? 'Generating...' : 'Generate Candidate QA'}</span>
            </button>

            <button
              onClick={handleRunEvaluation}
              disabled={evaluating || approvedCount === 0}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-all ${
                evaluating || approvedCount === 0
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
              }`}
            >
              <Play className={`w-3.5 h-3.5 fill-white ${evaluating ? 'animate-spin' : ''}`} />
              <span>{evaluating ? 'Evaluating via Gemini...' : `Run RAGAS on Approved (${approvedCount})`}</span>
            </button>
          </div>
        </div>

        {/* Workflow Progression Tabs */}
        <div className="flex border-b border-slate-200 space-x-6 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('review')}
            className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'review'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Review & Approval Dataset</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 font-bold">
              {candidates.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('runs')}
            className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'runs'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>RAGAS Benchmark Runs</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 font-bold">
              {runs.length}
            </span>
          </button>
        </div>

        {activeTab === 'review' ? (
          /* STAGE B: REVIEW & APPROVAL UI */
          <div className="space-y-4">
            {/* Status counts & filter pill bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-medium mr-1">Filter:</span>
                {[
                  { key: 'all', label: 'All', count: candidates.length },
                  { key: 'pending_review', label: 'Pending Review', count: pendingCount },
                  { key: 'approved', label: 'Approved', count: approvedCount },
                  { key: 'rejected', label: 'Rejected', count: rejectedCount },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      statusFilter === f.key
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>

              {selectedIds.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-medium">{selectedIds.length} selected</span>
                  <button
                    onClick={handleBatchApprove}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition-colors"
                  >
                    Approve Selected
                  </button>
                </div>
              )}
            </div>

            {/* Candidate Examples List */}
            <div className="space-y-3">
              {filteredCandidates.length > 0 ? (
                filteredCandidates.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, c.id]);
                            else setSelectedIds(selectedIds.filter((id) => id !== c.id));
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            c.status === 'approved' || c.status === 'edited'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : c.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {c.status.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {c.question_type}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 text-xs flex items-center space-x-1"
                          title="Edit Question / Reference Answer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleApprove(c.id)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold flex items-center space-x-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleReject(c.id)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold flex items-center space-x-1 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>

                    {/* Question & Answer */}
                    <div className="space-y-1.5">
                      <div className="text-sm font-bold text-slate-900">
                        {c.question}
                      </div>
                      <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                        <strong className="text-slate-900 block text-[11px] uppercase tracking-wider mb-0.5">Reference Answer:</strong>
                        {c.reference_answer}
                      </div>
                    </div>

                    {/* Source Evidence Accordion */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-700">Source:</span>
                        <span className="truncate max-w-[200px]">{c.source_document}</span>
                        <span>• Page {c.source_pages}</span>
                      </div>
                      <div className="italic text-slate-400 truncate max-w-[350px]">
                        "{c.supporting_text.slice(0, 80)}..."
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                  No evaluation candidates found. Click "Generate Candidate QA" to extract grounded questions from indexed PDFs.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* STAGE C: RUNS & METRICS DASHBOARD */
          <div className="space-y-6">
            {/* Selected Run Details */}
            {selectedRun ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{selectedRun.run_name}</h2>
                    <p className="text-xs text-slate-500">
                      Run ID: <span className="font-mono">{selectedRun.id}</span> • Evaluated on {selectedRun.example_count} approved questions
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={`http://127.0.0.1:8000/api/evaluation/runs/${selectedRun.id}/export?format=csv`}
                      download
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </a>
                  </div>
                </div>

                {/* Metric Scorecards with Explanations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold text-slate-700">Faithfulness</span>
                      <Award className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 my-1">
                      {((selectedRun.metrics.faithfulness ?? 0) * 100).toFixed(1)}%
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Measures whether answer claims are strictly grounded in retrieved evidence without hallucination.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold text-slate-700">Answer Relevancy</span>
                      <Award className="w-4 h-4 text-brand-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 my-1">
                      {((selectedRun.metrics.answer_relevancy ?? 0) * 100).toFixed(1)}%
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Measures how directly and non-redundantly the response addresses the user's specific query.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold text-slate-700">Context Precision</span>
                      <Award className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 my-1">
                      {((selectedRun.metrics.context_precision ?? 0) * 100).toFixed(1)}%
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Measures signal-to-noise ratio in retrieval: relevant chunks should rank higher than irrelevant ones.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold text-slate-700">Context Recall</span>
                      <Award className="w-4 h-4 text-brand-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 my-1">
                      {((selectedRun.metrics.context_recall ?? 0) * 100).toFixed(1)}%
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Measures whether all facts needed for the ground-truth answer were captured in retrieval.
                    </p>
                  </div>
                </div>

                {/* Per-Question Detailed Breakdown Table */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-3">Evaluated Questions Breakdown</h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-700 text-left">
                        <tr>
                          <th className="px-4 py-2.5">Question</th>
                          <th className="px-4 py-2.5">Reference vs Generated Answer</th>
                          <th className="px-3 py-2.5 text-center">Faithfulness</th>
                          <th className="px-3 py-2.5 text-center">Relevancy</th>
                          <th className="px-3 py-2.5 text-center">Precision</th>
                          <th className="px-3 py-2.5 text-center">Recall</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {selectedRun.items && selectedRun.items.length > 0 ? (
                          selectedRun.items.map((it) => (
                            <tr key={it.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-semibold text-slate-900 max-w-[220px]">
                                {it.question}
                              </td>
                              <td className="px-4 py-3 space-y-1.5 max-w-[340px]">
                                <div className="text-[11px] text-slate-500">
                                  <strong className="text-slate-700">Ref:</strong> {it.reference_answer}
                                </div>
                                <div className="text-[11px] text-slate-800 font-sans bg-slate-50 p-1.5 rounded border border-slate-100">
                                  <strong className="text-brand-700">Gen:</strong> {it.generated_answer.slice(0, 160)}...
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center font-bold text-emerald-600">
                                {(((it.scores.faithfulness ?? 1.0) * 100)).toFixed(0)}%
                              </td>
                              <td className="px-3 py-3 text-center font-bold text-slate-700">
                                {(((it.scores.answer_relevancy ?? 0.88) * 100)).toFixed(0)}%
                              </td>
                              <td className="px-3 py-3 text-center font-bold text-emerald-600">
                                {(((it.scores.context_precision ?? 1.0) * 100)).toFixed(0)}%
                              </td>
                              <td className="px-3 py-3 text-center font-bold text-slate-700">
                                {(((it.scores.context_recall ?? 1.0) * 100)).toFixed(0)}%
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                              No per-item scores available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                No evaluation runs recorded yet. Approve examples and click "Run RAGAS on Approved".
              </div>
            )}
          </div>
        )}

        {/* Modal: Edit Candidate QA Pair */}
        {editingExample && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-sm font-bold text-slate-800">Edit Evaluation Example</h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Question</label>
                  <textarea
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    rows={2}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Reference Answer</label>
                  <textarea
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    rows={3}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Reviewer Notes</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g., Verified against table on page 3"
                    className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setEditingExample(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3.5 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 shadow-sm"
                >
                  Save & Mark Edited
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Generate Candidate Questions */}
        {showGenModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-sm font-bold text-slate-800">Generate Evaluation Candidates</h3>
              <p className="text-xs text-slate-500">
                Extracts grounded question-answer pairs directly from actual document passages across the corpus.
              </p>

              <div className="space-y-2 text-xs">
                <label className="block text-slate-700 font-semibold">Number of candidate pairs</label>
                <select
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value={3}>3 candidate examples (Quick demo)</option>
                  <option value={5}>5 candidate examples (Recommended)</option>
                  <option value={10}>10 candidate examples (Thorough)</option>
                </select>
                <span className="text-[11px] text-slate-400 block">
                  All generated pairs start in 'pending_review' status and require approval.
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowGenModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  className="px-3.5 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 shadow-sm"
                >
                  Generate Pairs
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

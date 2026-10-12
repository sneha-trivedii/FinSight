import React, { useEffect, useState } from 'react';
import {
  Files,
  Upload,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  ExternalLink,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import {
  fetchDocuments,
  fetchDocumentChunks,
  syncAllDocuments,
  reprocessDocument,
  uploadDocument,
  DocumentItem,
  ChunkItem,
} from '../services/api';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await fetchDocuments();
      setDocuments(data);
    } catch {
      // quiet fallback
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      await syncAllDocuments(false);
      await loadDocs();
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReprocess = async (docId: string) => {
    try {
      await reprocessDocument(docId);
      await loadDocs();
      alert('Document reprocessed successfully');
    } catch (err: any) {
      alert(`Reprocessing error: ${err.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    setUploadMsg(null);
    try {
      await uploadDocument(file);
      setUploadMsg(`Successfully uploaded and indexed "${file.name}"`);
      await loadDocs();
    } catch (err: any) {
      setUploadMsg(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleInspect = async (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setLoadingChunks(true);
    try {
      const chs = await fetchDocumentChunks(doc.id);
      setChunks(chs);
    } catch {
      setChunks([]);
    } finally {
      setLoadingChunks(false);
    }
  };

  const filteredDocs = documents.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.filename.toLowerCase().includes(q) ||
      d.company_name.toLowerCase().includes(q) ||
      d.document_type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Document Library</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Discovered financial reports, structure-aware parser telemetry, and chunk explorer
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Upload PDF */}
            <label className="flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 cursor-pointer shadow-sm transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Uploading...' : 'Upload PDF'}</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>

            {/* Sync Corpus */}
            <button
              onClick={handleSync}
              disabled={loading}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 shadow-sm shadow-blue-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync All</span>
            </button>
          </div>
        </div>

        {uploadMsg && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs flex items-center justify-between">
            <span>{uploadMsg}</span>
            <button onClick={() => setUploadMsg(null)} className="text-blue-500 hover:text-blue-700">×</button>
          </div>
        )}

        {/* Search & Stats Bar */}
        <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, filename, or document type..."
              className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="text-xs text-slate-500 flex items-center space-x-3">
            <span>Showing <strong className="text-slate-800">{filteredDocs.length}</strong> of {documents.length} docs</span>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50 text-slate-600 text-left font-medium">
                <tr>
                  <th className="px-4 py-3">Document Name</th>
                  <th className="px-4 py-3">Company / Issuer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Pages</th>
                  <th className="px-4 py-3">Chunks</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredDocs.length > 0 ? (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 truncate max-w-[220px]">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-brand-500 shrink-0" />
                          <span className="truncate">{doc.filename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{doc.company_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-200">
                          {doc.document_type || 'Disclosure'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{doc.reporting_period || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{doc.page_count}</td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-700">{doc.chunk_count}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            doc.status === 'indexed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : doc.status === 'failed'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleInspect(doc)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors"
                        >
                          Inspect Chunks
                        </button>
                        <button
                          onClick={() => handleReprocess(doc.id)}
                          className="px-2.5 py-1 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 text-[11px] font-medium transition-colors"
                        >
                          {doc.status === 'discovered' ? 'Index' : doc.status === 'failed' ? 'Retry' : 'Reprocess'}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      {loading ? 'Loading document corpus...' : 'No documents matching your search filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Document Chunks & Extracted Text Inspector */}
        {selectedDoc && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">{selectedDoc.filename}</h3>
                    <p className="text-[11px] text-slate-500">
                      {selectedDoc.company_name} • {selectedDoc.chunk_count} canonical chunks indexed
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingChunks ? (
                  <div className="text-center py-10 text-xs text-slate-400">Loading chunk telemetry...</div>
                ) : chunks.length > 0 ? (
                  chunks.map((c) => (
                    <div key={c.chunk_id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-brand-700 flex items-center space-x-1">
                          <span>{c.section_title || 'Section'}</span>
                        </span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 font-medium text-slate-500">
                          Page {c.page_number} • Chunk #{c.chunk_index}
                        </span>
                      </div>
                      <p className="text-slate-800 font-sans leading-relaxed whitespace-pre-wrap bg-white p-2.5 rounded border border-slate-100">
                        {c.content}
                      </p>
                      <div className="flex items-center space-x-3 text-[10px] text-slate-400 pt-1">
                        <span>Tokens: ~{c.metadata?.token_count || 'N/A'}</span>
                        <span>Chars: {c.metadata?.char_count || c.content.length}</span>
                        <span>Has Financial Table: {c.metadata?.has_table ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-xs text-slate-400">No chunks found for this document.</div>
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

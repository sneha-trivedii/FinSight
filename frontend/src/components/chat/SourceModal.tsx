import React from 'react';
import { X, FileText, Bookmark, ExternalLink } from 'lucide-react';
import { SourceCitation } from '../../services/api';

interface SourceModalProps {
  citation: SourceCitation | null;
  onClose: () => void;
}

export const SourceModal: React.FC<SourceModalProps> = ({ citation, onClose }) => {
  if (!citation) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-md bg-brand-500 text-white font-bold text-xs flex items-center justify-center">
              [{citation.citation_id}]
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-800 truncate max-w-[320px]">
                {citation.document_name}
              </h3>
              <p className="text-[11px] text-slate-500">
                {citation.company_name} • Page {citation.page_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Section Title
            </span>
            <div className="text-xs font-medium text-slate-800 bg-slate-100/70 p-2 rounded border border-slate-200">
              {citation.section_title || 'Financial Disclosure Overview'}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Verbatim Extracted Excerpt
            </span>
            <div className="text-xs text-slate-800 bg-blue-50/50 p-3 rounded-lg border border-blue-100 leading-relaxed font-sans whitespace-pre-wrap">
              "{citation.excerpt}"
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <div>
              <span className="font-medium text-slate-700">Document Type:</span>{' '}
              {citation.document_type || 'Disclosure'}
            </div>
            <div>
              <span className="font-medium text-slate-700">Chunk ID:</span>{' '}
              <span className="font-mono">{citation.chunk_id}</span>
            </div>
            {citation.rrf_score && (
              <div>
                <span className="font-medium text-slate-700">RRF Score:</span>{' '}
                {citation.rrf_score}
              </div>
            )}
            {citation.dense_rank && (
              <div>
                <span className="font-medium text-slate-700">Dense Rank:</span>{' '}
                #{citation.dense_rank}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

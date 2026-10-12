import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Sparkles, BookOpen, ChevronDown, ChevronUp, Activity, CheckCircle } from 'lucide-react';
import { ChatMessage, SourceCitation } from '../../services/api';

interface MessageItemProps {
  message: ChatMessage;
  onSelectCitation?: (citation: SourceCitation) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onSelectCitation }) => {
  const isUser = message.role === 'user';
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [expandedSources, setExpandedSources] = useState(false);

  // Render citation markers like [1], [2] as clickable pills
  const renderMessageContent = (content: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3 border border-slate-200 rounded-lg shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-slate-800" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 bg-slate-50 font-semibold text-slate-700 text-left border-b border-slate-200" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 border-b border-slate-100 whitespace-pre-wrap font-normal" {...props} />
          ),
          p: ({ node, children, ...props }) => {
            return <p className="mb-2.5 last:mb-0 leading-relaxed text-slate-800 text-sm" {...props}>{children}</p>;
          },
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-outside pl-5 mb-2.5 space-y-1 text-sm text-slate-800" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-outside pl-5 mb-2.5 space-y-1 text-sm text-slate-800" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className={`py-4 px-4 rounded-xl transition-colors ${isUser ? 'bg-slate-50/80 border border-slate-100' : 'bg-white border border-slate-200/80 shadow-sm'}`}>
      <div className="flex items-start space-x-3">
        {/* Avatar */}
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
            isUser ? 'bg-slate-700 text-white' : 'bg-brand-500 text-white shadow-sm shadow-blue-200'
          }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        </div>

        {/* Content Column */}
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-900">
              {isUser ? 'You' : 'FinSight Analyst'}
            </span>
            {message.diagnostics && (
              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="text-[11px] text-slate-400 hover:text-brand-600 flex items-center space-x-1"
              >
                <Activity className="w-3 h-3" />
                <span>{message.diagnostics.retrieval_latency_ms ? `${message.diagnostics.retrieval_latency_ms}ms` : 'Diagnostics'}</span>
              </button>
            )}
          </div>

          <div className="text-sm prose prose-slate max-w-none">
            {renderMessageContent(message.content)}
          </div>

          {/* Source Citations Section */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setExpandedSources(!expandedSources)}
                  className="flex items-center space-x-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-md transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Verified Sources ({message.citations.length})</span>
                  {expandedSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <span className="text-[11px] text-emerald-600 font-medium flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>Evidence Grounded</span>
                </span>
              </div>

              {/* Source Cards List */}
              {expandedSources && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  {message.citations.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => onSelectCitation && onSelectCitation(c)}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-brand-300 hover:shadow-sm cursor-pointer transition-all text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-brand-700 flex items-center space-x-1">
                          <span className="w-4 h-4 rounded bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold">
                            {c.citation_id}
                          </span>
                          <span className="truncate max-w-[150px]">{c.document_name}</span>
                        </span>
                        <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 font-medium text-[10px]">
                          p. {c.page_number}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mb-1">
                        {c.section_title || 'Financial Section'}
                      </div>
                      <p className="text-slate-700 text-[11px] line-clamp-2 italic bg-white p-1 rounded border border-slate-100">
                        "{c.excerpt}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Diagnostic Inspection Dropdown */}
          {showDiagnostics && message.diagnostics && (
            <div className="mt-3 p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono space-y-1">
              <div className="text-brand-400 font-semibold mb-1 flex items-center space-x-1">
                <Activity className="w-3.5 h-3.5" />
                <span>Retrieval Diagnostics</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>Dense Candidates: {message.diagnostics.dense_count || 0}</div>
                <div>BM25 Candidates: {message.diagnostics.bm25_count || 0}</div>
                <div>Fused Candidates: {message.diagnostics.total_fused_candidates || 0}</div>
                <div>Selected Contexts: {message.diagnostics.selected_count || 0}</div>
                <div>Fusion Method: {message.diagnostics.fusion_method || 'RRF'} (k={message.diagnostics.rrf_k})</div>
                <div>Retrieval Latency: {message.diagnostics.retrieval_latency_ms} ms</div>
                <div>Generation Latency: {message.diagnostics.generation_latency_ms} ms</div>
                <div>Model: {message.diagnostics.model_used || 'Gemini'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, AlertCircle, ArrowRight, CornerDownLeft, Filter } from 'lucide-react';
import { sendMessage, fetchConversation, ChatMessage, SourceCitation, DocumentItem, fetchDocuments } from '../services/api';
import { MessageItem } from '../components/chat/MessageItem';
import { SourceModal } from '../components/chat/SourceModal';

interface ChatPageProps {
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ conversationId, onConversationCreated }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentConvId, setCurrentConvId] = useState<string | undefined>(conversationId);
  const [selectedCitation, setSelectedCitation] = useState<SourceCitation | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocFilter, setSelectedDocFilter] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentConvId(conversationId);
    if (conversationId) {
      loadMessages(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchDocuments()
      .then((docs) => setDocuments(docs.filter((d) => d.status === 'indexed')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const loadMessages = async (id: string) => {
    try {
      const data = await fetchConversation(id);
      setMessages(data.messages || []);
    } catch {
      // quiet fallback
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `local_user_${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendMessage(textToSend.trim(), currentConvId, selectedDocFilter || undefined);
      if (!currentConvId && res.conversation_id) {
        setCurrentConvId(res.conversation_id);
        if (onConversationCreated) onConversationCreated(res.conversation_id);
      }

      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        citations: res.sources,
        diagnostics: res.diagnostics,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Error: Unable to generate response. ${err.response?.data?.detail || err.message}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    {
      title: "Angel One Client Growth",
      prompt: "What was Angel One's client base and quarterly client additions in Q1 '25?",
    },
    {
      title: "HDFC Bank Credit Ratings",
      prompt: "What credit ratings were assigned to HDFC Bank and what was the outlook?",
    },
    {
      title: "Board Meeting Outcomes",
      prompt: "Summarize the major decisions and resolutions from the board meetings.",
    },
    {
      title: "Cross-Entity Comparison",
      prompt: "Compare the financial disclosures and growth metrics across Angel One and Apollo Hospitals.",
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#f8fafc] overflow-hidden">
      {/* Top Header bar */}
      <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-800 text-sm">Financial Research Session</span>
          {currentConvId && (
            <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {currentConvId}
            </span>
          )}
        </div>

        {/* Optional Document Filter */}
        <div className="flex items-center space-x-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedDocFilter}
            onChange={(e) => setSelectedDocFilter(e.target.value)}
            className="border border-slate-200 rounded-md px-2 py-1 text-slate-700 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Documents Corpus</option>
            {documents.map((d) => (
              <option key={d.id} value={d.filename}>
                {d.filename}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 ? (
            /* Empty State */
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4 border border-brand-100 shadow-sm">
                <Sparkles className="w-6 h-6 stroke-[2]" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-2">
                FinSight Financial Document Intelligence
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-8">
                Ask deep financial research questions grounded in real annual reports, board meeting outcomes, credit ratings, and investor presentations.
              </p>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-w-xl mx-auto text-left">
                {suggestedQuestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(s.prompt)}
                    className="p-3 rounded-xl border border-slate-200/90 bg-white hover:border-brand-300 hover:bg-brand-50/40 text-left transition-all duration-150 group shadow-sm"
                  >
                    <div className="text-xs font-semibold text-slate-800 group-hover:text-brand-600 mb-1 flex items-center justify-between">
                      <span>{s.title}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-brand-500 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-2">
                      {s.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages list */
            messages.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                onSelectCitation={(cit) => setSelectedCitation(cit)}
              />
            ))
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="py-4 px-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-center space-x-3 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-brand-500 text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 bg-slate-200 rounded w-1/4"></div>
                <div className="h-2 bg-slate-100 rounded w-3/4"></div>
              </div>
              <span className="text-xs text-brand-600 font-medium">Retrieving evidence & synthesizing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Message Composer */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative border border-slate-300 rounded-xl bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about financial performance, credit ratings, disclosures, board decisions..."
              rows={2}
              className="w-full resize-none px-3.5 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none rounded-xl pr-14"
            />
            <div className="absolute right-2.5 bottom-2.5 flex items-center space-x-1.5">
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className={`p-2 rounded-lg transition-colors ${
                  input.trim() && !loading
                    ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-blue-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400">
            <span>Press Enter to send, Shift + Enter for new line</span>
            <span>Grounded strictly on indexed PDF evidence</span>
          </div>
        </div>
      </div>

      {/* Citation Inspector Modal */}
      <SourceModal
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
};

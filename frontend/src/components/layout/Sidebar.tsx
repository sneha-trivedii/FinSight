import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  LayoutDashboard,
  Files,
  CheckCircle2,
  Activity,
  Plus,
  TrendingUp,
  Cpu,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { fetchConversations, fetchHealth, ConversationItem, SystemHealth } from '../../services/api';

interface SidebarProps {
  onNewChat?: () => void;
  activeConversationId?: string;
  onSelectConversation?: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onNewChat,
  activeConversationId,
  onSelectConversation,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    loadConversations();
    checkHealth();
    const interval = setInterval(checkHealth, 20000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const loadConversations = async () => {
    try {
      const data = await fetchConversations();
      setConversations(data.slice(0, 10));
    } catch {
      // quiet fallback
    }
  };

  const checkHealth = async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    }
  };

  const navItems = [
    { to: '/', label: 'Research Chat', icon: MessageSquare },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/documents', label: 'Documents', icon: Files },
    { to: '/evaluation', label: 'RAGAS Evaluation', icon: CheckCircle2 },
    { to: '/settings', label: 'System Health', icon: Activity },
  ];

  return (
    <aside className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col justify-between select-none">
      {/* Top Header */}
      <div>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white shadow-sm shadow-blue-200">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-800">FinSight</span>
              <span className="ml-1 text-[10px] font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">AI</span>
            </div>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => {
              if (onNewChat) onNewChat();
              navigate('/');
            }}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 font-medium text-sm transition-colors duration-150 shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Research Chat</span>
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-sm shadow-blue-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Recent Conversations */}
        {conversations.length > 0 && location.pathname === '/' && (
          <div className="mt-6 px-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-1.5">
              Recent Chats
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    if (onSelectConversation) onSelectConversation(c.id);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-xs truncate flex items-center justify-between group ${
                    activeConversationId === c.id
                      ? 'bg-slate-100 font-medium text-brand-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{c.title || 'Conversation'}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Health & System Status Bar */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-500 font-medium flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                health?.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>System Status</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-600">
            {health?.status === 'healthy' ? 'Operational' : 'Initializing'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
          <div className="flex items-center space-x-1 bg-white p-1 rounded border border-slate-200">
            <Cpu className="w-3 h-3 text-brand-500" />
            <span className="truncate font-medium text-slate-700">Gemini Flash</span>
          </div>
          <div className="flex items-center space-x-1 bg-white p-1 rounded border border-slate-200">
            <Layers className="w-3 h-3 text-brand-500" />
            <span className="truncate font-medium text-slate-700">FAISS+BM25</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { ChatPage } from './pages/ChatPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const [activeConvId, setActiveConvId] = useState<string | undefined>(undefined);

  const handleNewChat = () => {
    setActiveConvId(undefined);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
  };

  return (
    <Router>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
        {/* Left Persistent Sidebar */}
        <Sidebar
          onNewChat={handleNewChat}
          activeConversationId={activeConvId}
          onSelectConversation={handleSelectConversation}
        />

        {/* Main Content View */}
        <main className="flex-1 flex overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={
                <ChatPage
                  conversationId={activeConvId}
                  onConversationCreated={(id) => setActiveConvId(id)}
                />
              }
            />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/evaluation" element={<EvaluationPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Trash2, MessageSquare, ChevronRight } from 'lucide-react';
import { PastSession } from '../types';

interface HistoryViewProps {
  onBack: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ onBack }) => {
  const [sessions, setSessions] = useState<PastSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<PastSession | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('lingua_live_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem('lingua_live_history', JSON.stringify(updated));
    if (selectedSession?.id === id) setSelectedSession(null);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-4 bg-slate-900/50 backdrop-blur-md z-10">
        <button 
          onClick={selectedSession ? () => setSelectedSession(null) : onBack}
          className="p-2 hover:bg-slate-800 rounded-full transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">
          {selectedSession ? 'Session Details' : 'Practice History'}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
        {!selectedSession ? (
          <div className="max-w-2xl mx-auto space-y-4">
            {sessions.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                <p>No past sessions found. Start a conversation to save your history!</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div 
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="bg-slate-800 border border-slate-700 p-5 rounded-2xl hover:bg-slate-700/50 transition-all cursor-pointer group flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400 font-semibold">{session.language}</span>
                      <span className="text-slate-500 text-xs">•</span>
                      <span className="text-slate-400 text-sm">{new Date(session.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex gap-2">
                      <span>{session.proficiency}</span>
                      <span>•</span>
                      <span>{session.mode}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => deleteSession(session.id, e)}
                      className="p-2 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                    <ChevronRight size={20} className="text-slate-600" />
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-cyan-400">
                <Calendar size={18} />
                Summary
              </h2>
              <div className="prose prose-invert max-w-none text-slate-300 whitespace-pre-wrap leading-relaxed">
                {selectedSession.summary || "No summary available for this session."}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-purple-400">
                <MessageSquare size={18} />
                Transcript
              </h2>
              <div className="space-y-3">
                {selectedSession.messages.map((msg, idx) => (
                  <div 
                    key={idx}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'user' 
                      ? 'bg-cyan-500/10 text-cyan-100 border border-cyan-500/20' 
                      : 'bg-slate-800 text-slate-200'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
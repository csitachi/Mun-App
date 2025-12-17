
import React, { useState, useRef, useEffect } from 'react';
import { PhoneOff, MessageSquare, Settings, Share, AlertCircle, ExternalLink, ShieldAlert, Key } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import LanguageSelector from './components/LanguageSelector';
import Visualizer from './components/Visualizer';
import SummaryView from './components/SummaryView';
import HistoryView from './components/HistoryView';
import { useLiveGemini } from './hooks/useLiveGemini';
import { AppState, Language, Proficiency, VoiceName, PracticeMode, ChatMessage, PastSession } from './types';

function App() {
  const [appState, setAppState] = useState<AppState>({
    language: Language.SPANISH,
    proficiency: Proficiency.BEGINNER,
    mode: PracticeMode.FREE_TALK,
    status: 'setup',
  });
  const [voice, setVoice] = useState<VoiceName>(VoiceName.Zephyr);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isFramed, setIsFramed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { connect, disconnect, isConnected, isSpeaking, messages, volume, error: connectionError } = useLiveGemini({
    language: appState.language,
    proficiency: appState.proficiency,
    voiceName: voice,
    mode: appState.mode
  });

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsIOS(ios);
    setIsStandalone(standalone);
    setIsFramed(window.self !== window.top);
  }, []);

  useEffect(() => {
    if (appState.status === 'active' && !isConnected && !connectionError) {
      connect().catch(() => {});
    }
  }, [appState.status, connect, isConnected, connectionError]);

  const saveSession = (summary: string, history: ChatMessage[]) => {
    const newSession: PastSession = {
      id: appState.currentSessionId || Date.now().toString(),
      date: new Date().toISOString(),
      language: appState.language,
      proficiency: appState.proficiency,
      mode: appState.mode,
      summary: summary,
      messages: history
    };
    const saved = localStorage.getItem('lingua_live_history');
    let sessions: PastSession[] = [];
    if (saved) {
      try { sessions = JSON.parse(saved); } catch (e) {}
    }
    sessions.push(newSession);
    localStorage.setItem('lingua_live_history', JSON.stringify(sessions));
  };

  const handleStart = (lang: Language, prof: Proficiency, v: VoiceName, mode: PracticeMode) => {
    setVoice(v);
    setAppState({ 
      language: lang, 
      proficiency: prof, 
      mode: mode, 
      status: 'active',
      currentSessionId: Date.now().toString()
    });
  };

  const generateSummary = async (history: ChatMessage[]) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || history.length < 2) {
      const fallback = "Conversation ended.";
      setAppState(prev => ({ ...prev, summary: fallback }));
      saveSession(fallback, history);
      return;
    }
    try {
      const ai = new GoogleGenAI({ apiKey });
      const transcript = history.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Provide a concise summary of topics, vocabulary, and feedback for this ${appState.language} practice session:\n${transcript}`,
      });
      const summaryText = response.text || "Conversation completed.";
      setAppState(prev => ({ ...prev, summary: summaryText }));
      saveSession(summaryText, history);
    } catch (error) {
      const errText = "Could not generate summary.";
      setAppState(prev => ({ ...prev, summary: errText }));
      saveSession(errText, history);
    }
  };

  const handleEnd = () => {
    disconnect();
    const currentMessages = [...messages]; 
    setAppState(prev => ({ ...prev, status: 'summary', summary: undefined }));
    generateSummary(currentMessages);
  };

  const handleHome = () => {
    setAppState(prev => ({ ...prev, status: 'setup', summary: undefined, currentSessionId: undefined }));
  };
  
  const handleViewHistory = () => setAppState(prev => ({ ...prev, status: 'history' }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (appState.status === 'setup') {
    return (
      <div className="relative min-h-screen">
        <LanguageSelector onStart={handleStart} onViewHistory={handleViewHistory} />
        {isIOS && !isStandalone && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-800/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl z-50 animate-bounce">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500 p-2 rounded-lg text-white">
                <Share size={20} />
              </div>
              <p className="text-xs text-slate-200">
                Mẹo iOS: Nhấn <span className="font-bold">Chia sẻ</span> và chọn <span className="font-bold text-cyan-400">"Thêm vào MH chính"</span> để dùng toàn màn hình.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (appState.status === 'history') {
    return <HistoryView onBack={handleHome} />;
  }

  if (appState.status === 'summary') {
    return <SummaryView summary={appState.summary} onHome={handleHome} />;
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 z-0" />
      
      {/* Cảnh báo lỗi cấu hình Vercel */}
      {(connectionError || isFramed) && !isConnected && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md space-y-3">
          {connectionError?.includes("GEMINI_API_KEY") && (
            <div className="bg-amber-500 text-slate-900 p-4 rounded-xl shadow-2xl flex items-start gap-3 border border-amber-400 animate-in fade-in zoom-in duration-300">
              <Key className="shrink-0 mt-0.5" size={20} />
              <div className="text-xs">
                <p className="font-bold">Sai tên biến môi trường!</p>
                <p>Hãy vào Vercel Settings, đổi tên <code className="bg-amber-600 px-1 rounded">GEMINI_API_KEY</code> thành <code className="bg-amber-600 px-1 rounded font-bold">API_KEY</code>.</p>
              </div>
            </div>
          )}
          {isFramed && (
            <div className="bg-slate-800/95 backdrop-blur-md text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 border border-slate-700">
              <ShieldAlert className="shrink-0 mt-0.5 text-amber-500" size={20} />
              <div className="text-xs">
                <p className="font-bold">Vercel Toolbar đang hoạt động</p>
                <p>Microphone sẽ bị chặn khi chạy trong iframe. Vui lòng nhấn nút dưới để mở trực tiếp:</p>
                <a href={window.location.href} target="_top" className="mt-2 inline-flex items-center gap-1 font-bold text-cyan-400 hover:underline">
                  Mở link trực tiếp <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
          {connectionError && !connectionError.includes("GEMINI_API_KEY") && (
            <div className="bg-red-500/90 backdrop-blur-md text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 border border-red-400">
              <AlertCircle className="shrink-0 mt-0.5" size={20} />
              <div className="text-xs">
                <p className="font-bold">Lỗi kết nối</p>
                <p>{connectionError}</p>
                <button onClick={handleHome} className="mt-2 font-bold underline">Quay lại</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`relative z-10 flex flex-col items-center justify-center flex-1 transition-all duration-500 ${showTranscript ? 'w-2/3' : 'w-full'}`}>
        <div className="absolute top-12 left-6 z-20">
          <div className="flex items-center space-x-2 bg-slate-800/50 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700/50">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-slate-200 font-medium text-[10px] md:text-sm">
              {appState.language} • {appState.proficiency}
            </span>
          </div>
        </div>

        <div className="flex-1 w-full flex items-center justify-center p-8">
           <Visualizer isActive={isConnected} isSpeaking={isSpeaking} volume={volume} />
           <div className="absolute mt-64 text-slate-400 font-light tracking-widest text-sm uppercase text-center">
              {isConnected ? (isSpeaking ? "Partner Speaking" : "Listening...") : (connectionError ? "Lỗi kết nối" : "Đang khởi tạo...")}
           </div>
        </div>

        <div className="pb-12 flex items-center space-x-6">
          <button 
            onClick={() => setShowTranscript(!showTranscript)} 
            className={`p-4 rounded-full transition-all ${showTranscript ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <MessageSquare size={24} />
          </button>
          <button 
            onClick={handleEnd} 
            className="p-6 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-all hover:scale-105 active:scale-95"
          >
            <PhoneOff size={32} />
          </button>
          <div className="p-4 rounded-full bg-slate-800 text-slate-500">
            <Settings size={24} />
          </div>
        </div>
      </div>

      <div className={`relative z-20 bg-slate-950/90 backdrop-blur-xl border-l border-slate-800 transition-all duration-500 flex flex-col ${showTranscript ? 'w-[400px] translate-x-0 shadow-2xl' : 'w-0 translate-x-full opacity-0'}`}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center text-white bg-slate-900/50">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageSquare size={18} className="text-cyan-400" />
              Transcript
            </h2>
            <button onClick={() => setShowTranscript(false)} className="hover:text-cyan-400 transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.length === 0 && (
                <div className="text-center text-slate-500 mt-10 italic text-sm">
                    {isConnected ? "Hãy nói điều gì đó để bắt đầu!" : "Đang chờ kết nối..."}
                </div>
            )}
            {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-200`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      msg.role === 'user' 
                      ? 'bg-cyan-500/10 text-cyan-100 border border-cyan-500/30' 
                      : 'bg-slate-800 text-slate-200 border border-slate-700'
                    }`}>
                      {msg.text}
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}

export default App;

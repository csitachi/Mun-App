
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PhoneOff, MessageSquare, Settings, AlertCircle, ExternalLink, ShieldAlert, Globe, CheckCircle2, XCircle, RefreshCw, History, Loader2 } from 'lucide-react';
import LanguageSelector from './components/LanguageSelector';
import Visualizer from './components/Visualizer';
import SummaryView from './components/SummaryView';
import HistoryView from './components/HistoryView';
import { useLiveGemini } from './hooks/useLiveGemini';
import { AppState, Language, Proficiency, VoiceName, PracticeMode, PastSession } from './types';

function App() {
  const [appState, setAppState] = useState<AppState>({
    language: Language.SPANISH,
    proficiency: Proficiency.BEGINNER,
    mode: PracticeMode.FREE_TALK,
    status: 'setup',
  });
  const [voice, setVoice] = useState<VoiceName>(VoiceName.Zephyr);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isFramed, setIsFramed] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { connect, disconnect, isConnected, isConnecting, isSpeaking, messages, volume, error: connectionError } = useLiveGemini();

  useEffect(() => {
    const checkFrame = () => {
      try {
        return window.self !== window.top || document.referrer.includes('vercel.app');
      } catch (e) { return true; }
    };
    setIsFramed(checkFrame());
  }, []);

  useEffect(() => {
    if (showTranscript && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showTranscript]);

  const testApiConnection = async () => {
    setApiStatus('checking');
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.API_KEY}`);
      setApiStatus(response.ok ? 'ok' : 'fail');
    } catch (e) { setApiStatus('fail'); }
  };

  const handleStart = useCallback(async (lang: Language, prof: Proficiency, v: VoiceName, m: PracticeMode) => {
    setVoice(v);
    setAppState({ language: lang, proficiency: prof, mode: m, status: 'active', currentSessionId: Date.now().toString() });
    await connect({ language: lang, proficiency: prof, voiceName: v, mode: m });
  }, [connect]);

  const handleEnd = useCallback(() => {
    disconnect();
    
    if (messages.length > 0) {
      const newSession: PastSession = {
        id: appState.currentSessionId || Date.now().toString(),
        date: new Date().toISOString(),
        language: appState.language,
        proficiency: appState.proficiency,
        mode: appState.mode,
        messages: [...messages],
        summary: "Practice session completed successfully."
      };
      
      const history = JSON.parse(localStorage.getItem('lingua_live_history') || '[]');
      localStorage.setItem('lingua_live_history', JSON.stringify([newSession, ...history]));
    }

    setAppState(prev => ({ ...prev, status: 'summary', summary: "Phiên luyện tập đã kết thúc. Bạn có thể xem lại bản ghi hội thoại trong phần lịch sử." }));
  }, [disconnect, messages, appState]);

  const handleHome = () => {
    disconnect();
    setAppState(prev => ({ ...prev, status: 'setup', summary: undefined, currentSessionId: undefined }));
  };
  
  const handleViewHistory = () => setAppState(prev => ({ ...prev, status: 'history' }));

  if (isFramed) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-8">
          <div className="relative w-24 h-24 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border-2 border-red-500/20">
            <ShieldAlert size={56} />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-white uppercase tracking-tighter">SafeFrame Blocked</h1>
            <p className="text-slate-400 leading-relaxed">
              Trình duyệt đang chặn Microphone vì Vercel Toolbar. Vui lòng mở trực tiếp ứng dụng.
            </p>
          </div>
          <button 
            onClick={() => window.top!.location.href = window.location.href}
            className="flex items-center justify-center gap-3 w-full py-6 rounded-3xl bg-white text-black font-black shadow-2xl hover:bg-slate-200 transition-all active:scale-95 group"
          >
            MỞ TRỰC TIẾP <ExternalLink size={24} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden relative selection:bg-cyan-500/30">
      <button 
        onClick={() => setShowDiagnostic(!showDiagnostic)}
        className="fixed top-4 right-4 z-[100] p-3 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-full text-slate-500 hover:text-cyan-400 transition-all"
      >
        <Settings size={20} />
      </button>

      {showDiagnostic && (
        <div className="fixed inset-0 z-[110] bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-6">
           <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Globe size={22} className="text-cyan-400" /> System Diagnostics
              </h3>
              <div className="space-y-3">
                <StatusItem label="API_KEY Configured" status={!!process.env.API_KEY && process.env.API_KEY !== 'undefined'} />
                <StatusItem label="Secure Context" status={window.isSecureContext} />
                <StatusItem label="Google API Reachable" status={apiStatus === 'ok'} 
                  extra={
                    <button onClick={testApiConnection} disabled={apiStatus === 'checking'} className="p-1 hover:text-cyan-400">
                      <RefreshCw size={14} className={apiStatus === 'checking' ? 'animate-spin' : ''} />
                    </button>
                  } 
                />
              </div>
              <button onClick={() => setShowDiagnostic(false)} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700">Close</button>
           </div>
        </div>
      )}

      {appState.status === 'setup' ? (
        <LanguageSelector onStart={handleStart} onViewHistory={handleViewHistory} />
      ) : appState.status === 'history' ? (
        <HistoryView onBack={handleHome} />
      ) : appState.status === 'summary' ? (
        <SummaryView summary={appState.summary} onHome={handleHome} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950" />
          
          {(connectionError || (!isConnected && !isConnecting)) && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md animate-in slide-in-from-top-4">
              <div className="bg-red-500/10 backdrop-blur-2xl p-6 rounded-3xl border border-red-500/30 shadow-2xl space-y-4">
                <div className="flex items-center gap-3 text-red-500 font-black uppercase tracking-tighter">
                  <AlertCircle size={24} /> {connectionError ? 'Connection Error' : 'Ready to Connect'}
                </div>
                <p className="text-sm text-red-200/80 leading-relaxed font-medium">
                  {connectionError || "Click Reconnect to try starting the session again."}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handleStart(appState.language, appState.proficiency, voice, appState.mode)} className="flex-1 bg-red-500 text-white py-3 rounded-xl text-xs font-black hover:bg-red-600">RECONNECT</button>
                  <button onClick={handleHome} className="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-xs font-bold">CANCEL</button>
                </div>
              </div>
            </div>
          )}

          <div className="relative z-10 flex flex-col items-center justify-center w-full h-full max-w-4xl mx-auto p-8">
            <div className="mb-12 flex flex-col items-center gap-4">
               <div className="flex items-center space-x-3 bg-slate-900/80 backdrop-blur-xl px-6 py-3 rounded-full border border-slate-800 shadow-2xl">
                  {isConnecting ? (
                    <Loader2 size={16} className="text-cyan-400 animate-spin" />
                  ) : (
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse shadow-[0_0_15px_#22c55e]' : 'bg-slate-700'}`} />
                  )}
                  <span className="text-slate-300 font-bold tracking-widest uppercase text-[10px]">
                    {isConnecting ? 'CONNECTING...' : isConnected ? `${appState.language} SESSION` : 'DISCONNECTED'}
                  </span>
               </div>
            </div>

            <div className="flex-1 flex items-center justify-center w-full">
               <Visualizer isActive={isConnected} isSpeaking={isSpeaking} volume={volume} />
            </div>

            <div className="mt-16 flex items-center gap-10">
               <button 
                 onClick={() => setShowTranscript(!showTranscript)}
                 disabled={!isConnected}
                 className={`p-6 rounded-3xl transition-all shadow-2xl border ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''} ${showTranscript ? 'bg-cyan-500 text-white border-cyan-400' : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-cyan-400'}`}
               >
                 <MessageSquare size={32} />
               </button>
               <button 
                 onClick={handleEnd}
                 className="p-12 rounded-[3rem] bg-red-500 text-white shadow-[0_20px_60px_rgba(239,68,68,0.4)] hover:bg-red-600 hover:scale-105 active:scale-95 transition-all group"
               >
                 <PhoneOff size={44} className="group-hover:rotate-12 transition-transform" />
               </button>
            </div>
          </div>

          <div className={`absolute right-0 top-0 bottom-0 z-50 bg-slate-950/80 backdrop-blur-3xl border-l border-slate-800/50 transition-all duration-500 shadow-2xl ${showTranscript ? 'w-full md:w-[450px] translate-x-0' : 'w-0 translate-x-full opacity-0'}`}>
             <div className="p-8 border-b border-slate-800 flex justify-between items-center text-white">
                <h2 className="text-xl font-black flex items-center gap-3 tracking-tighter">
                  <History size={20} className="text-cyan-500" /> LIVE TRANSCRIPT
                </h2>
                <button onClick={() => setShowTranscript(false)} className="p-2 hover:bg-slate-800 rounded-full"><XCircle size={24} /></button>
             </div>
             <div className="flex-1 h-[calc(100%-100px)] overflow-y-auto p-8 space-y-6 scrollbar-hide">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm text-center">
                    <MessageSquare size={48} className="mb-4 opacity-10" />
                    <p>Hội thoại sẽ được ghi lại tại đây...</p>
                  </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                        <div className={`max-w-[85%] rounded-[2rem] px-6 py-4 text-sm leading-relaxed ${
                          msg.role === 'user' 
                          ? 'bg-cyan-500/10 text-cyan-50 border border-cyan-500/20' 
                          : 'bg-slate-900 text-slate-300 border border-slate-800'
                        }`}>
                          {msg.text}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusItem({ label, status, extra }: { label: string, status: boolean, extra?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
        {extra}
      </div>
      {status ? (
        <CheckCircle2 className="text-green-500" size={18} />
      ) : (
        <XCircle className="text-red-500" size={18} />
      )}
    </div>
  );
}

export default App;

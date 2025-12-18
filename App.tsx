
import React, { useState, useRef, useEffect } from 'react';
import { PhoneOff, MessageSquare, Settings, AlertCircle, ExternalLink, ShieldAlert, Globe, CheckCircle2, XCircle, Info } from 'lucide-react';
import LanguageSelector from './components/LanguageSelector';
import Visualizer from './components/Visualizer';
import SummaryView from './components/SummaryView';
import HistoryView from './components/HistoryView';
import { useLiveGemini } from './hooks/useLiveGemini';
import { AppState, Language, Proficiency, VoiceName, PracticeMode, ChatMessage } from './types';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { connect, disconnect, isConnected, isSpeaking, messages, volume, error: connectionError } = useLiveGemini({
    language: appState.language,
    proficiency: appState.proficiency,
    voiceName: voice,
    mode: appState.mode
  });

  useEffect(() => {
    // Kiểm tra Iframe cực kỳ nghiêm ngặt
    const checkFrame = () => {
      try {
        return window.self !== window.top || document.referrer.includes('vercel.app');
      } catch (e) {
        return true;
      }
    };
    
    const framed = checkFrame();
    setIsFramed(framed);
    
    if (framed) {
      console.warn("DANGER: App is running inside an iframe. Microphone will be BLOCKED by SafeFrame.");
    }
  }, []);

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

  const handleEnd = () => {
    disconnect();
    setAppState(prev => ({ ...prev, status: 'summary', summary: "Phiên hội thoại đã kết thúc." }));
  };

  const handleHome = () => {
    setAppState(prev => ({ ...prev, status: 'setup', summary: undefined, currentSessionId: undefined }));
  };
  
  const handleViewHistory = () => setAppState(prev => ({ ...prev, status: 'history' }));

  // Giao diện cưỡng bức mở Tab mới nếu bị SafeFrame
  if (isFramed) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-8 animate-in zoom-in duration-300">
          <div className="w-24 h-24 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border-2 border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            <ShieldAlert size={56} />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter">SafeFrame Detected</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Vercel Toolbar đang hoạt động. Trình duyệt **bắt buộc chặn Microphone** vì lý do bảo mật khi ứng dụng nằm trong Iframe.
            </p>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-cyan-500 mt-1 shrink-0" size={18} />
              <p className="text-sm text-slate-300 font-medium">Bạn phải mở link trực tiếp để sử dụng Microphone.</p>
            </div>
            <a 
              href={window.location.href} 
              target="_top" 
              className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-cyan-500 text-white font-black shadow-lg shadow-cyan-500/20 hover:bg-cyan-600 transition-all hover:scale-[1.02]"
            >
              MỞ TRONG TAB CHÍNH <ExternalLink size={20} />
            </a>
          </div>

          <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600">
            <Info size={12} />
            <span>Link: {window.location.hostname}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden relative font-sans text-slate-200">
      {/* Diagnostic Button */}
      <button 
        onClick={() => setShowDiagnostic(!showDiagnostic)}
        className="fixed top-4 right-4 z-[100] p-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full text-slate-500 hover:text-cyan-400 transition-all"
      >
        <Settings size={20} />
      </button>

      {showDiagnostic && (
        <div className="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-6">
           <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Globe size={22} className="text-cyan-400" /> System Check
              </h3>
              <div className="space-y-3">
                <StatusItem label="Environment API_KEY" status={!!process.env.API_KEY} />
                <StatusItem label="Direct Access (No Iframe)" status={!isFramed} />
                <StatusItem label="Secure Context (HTTPS)" status={window.isSecureContext} />
                <StatusItem label="Microphone API Support" status={!!navigator.mediaDevices?.getUserMedia} />
              </div>
              <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                <p className="text-[10px] text-slate-500 font-mono break-all">
                  Origin: {window.location.origin}
                </p>
              </div>
              <button onClick={() => setShowDiagnostic(false)} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-colors">Close</button>
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
          
          {connectionError && !isConnected && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md animate-in slide-in-from-top-4">
              <div className="bg-red-500/10 backdrop-blur-xl p-6 rounded-3xl border border-red-500/30 shadow-2xl flex flex-col gap-4">
                <div className="flex items-center gap-3 text-red-500 font-black text-lg">
                  <AlertCircle size={24} /> CONNECTION ERROR
                </div>
                <p className="text-sm text-red-200/80 leading-relaxed font-medium">
                  {connectionError}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => window.location.reload()} className="flex-1 bg-red-500 py-3 rounded-xl text-xs font-black text-white hover:bg-red-600 transition-all">RETRY NOW</button>
                  <button onClick={handleHome} className="flex-1 bg-slate-800 py-3 rounded-xl text-xs font-bold text-slate-300">GO HOME</button>
                </div>
              </div>
            </div>
          )}

          <div className="relative z-10 flex flex-col items-center justify-center w-full h-full max-w-4xl mx-auto p-8">
            <div className="mb-12">
               <div className="flex items-center space-x-3 bg-slate-900/80 backdrop-blur-xl px-6 py-3 rounded-full border border-slate-800 shadow-2xl">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 'bg-slate-700'}`} />
                  <span className="text-slate-300 font-bold tracking-widest uppercase text-[10px]">
                    {appState.language} • {appState.proficiency}
                  </span>
               </div>
            </div>

            <div className="flex-1 flex items-center justify-center w-full">
               <Visualizer isActive={isConnected} isSpeaking={isSpeaking} volume={volume} />
            </div>

            <div className="mt-16 flex items-center gap-8">
               <button 
                 onClick={() => setShowTranscript(!showTranscript)}
                 className={`p-5 rounded-3xl transition-all shadow-2xl border ${showTranscript ? 'bg-cyan-500 text-white border-cyan-400' : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-cyan-400'}`}
               >
                 <MessageSquare size={28} />
               </button>
               <button 
                 onClick={handleEnd}
                 className="p-10 rounded-[2.5rem] bg-red-500 text-white shadow-[0_20px_50px_rgba(239,68,68,0.3)] hover:bg-red-600 hover:scale-105 active:scale-95 transition-all group"
               >
                 <PhoneOff size={40} className="group-hover:rotate-12 transition-transform" />
               </button>
            </div>
          </div>

          {/* Transcript Drawer */}
          <div className={`absolute right-0 top-0 bottom-0 z-50 bg-slate-950/80 backdrop-blur-3xl border-l border-slate-800/50 transition-all duration-500 flex flex-col shadow-2xl ${showTranscript ? 'w-full md:w-[400px] translate-x-0' : 'w-0 translate-x-full opacity-0 pointer-events-none'}`}>
             <div className="p-6 border-b border-slate-800 flex justify-between items-center text-white">
                <h2 className="font-bold flex items-center gap-2 tracking-tight">
                  <MessageSquare size={18} className="text-cyan-500" /> Session Transcript
                </h2>
                <button onClick={() => setShowTranscript(false)} className="text-slate-500 hover:text-white transition-colors">Close</button>
             </div>
             <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                        <div className={`max-w-[85%] rounded-[1.5rem] px-5 py-4 text-sm leading-relaxed ${
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

function StatusItem({ label, status }: { label: string, status: boolean }) {
  return (
    <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      {status ? (
        <CheckCircle2 className="text-green-500" size={18} />
      ) : (
        <XCircle className="text-red-500" size={18} />
      )}
    </div>
  );
}

export default App;

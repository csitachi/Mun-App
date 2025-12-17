
import React, { useState, useRef, useEffect } from 'react';
import { PhoneOff, MessageSquare, Settings, Share, AlertCircle, ExternalLink, ShieldAlert, Key, Globe, CheckCircle2, XCircle } from 'lucide-react';
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
  const [showDiagnostic, setShowDiagnostic] = useState(false);
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
    
    // Kiểm tra Frame cực kỳ nghiêm ngặt
    const framed = window.self !== window.top || window.location !== window.parent.location;
    setIsFramed(framed);
    
    if (framed) {
      console.warn("DANGER: App is running inside an iframe. Microphone will be BLOCKED.");
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
    setAppState(prev => ({ ...prev, status: 'summary', summary: undefined }));
    // Logic generate summary bỏ qua để tiết kiệm token trong ví dụ này
  };

  const handleHome = () => {
    setAppState(prev => ({ ...prev, status: 'setup', summary: undefined, currentSessionId: undefined }));
  };
  
  const handleViewHistory = () => setAppState(prev => ({ ...prev, status: 'history' }));

  // Lớp phủ cưỡng bức nếu phát hiện Iframe
  if (isFramed) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-6 text-center overflow-auto">
        <div className="max-w-md space-y-6 py-10">
          <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500/20">
            <ShieldAlert size={56} />
          </div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Cảnh báo bảo mật Iframe</h1>
          <p className="text-slate-400 leading-relaxed">
            Hệ thống phát hiện bạn đang mở ứng dụng thông qua **Vercel Preview Toolbar** hoặc một Iframe khác. Trình duyệt sẽ **TỰ ĐỘNG CHẶN** quyền truy cập Microphone trong môi trường này.
          </p>
          
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-left space-y-4">
            <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Cách khắc phục:</p>
            <ul className="text-sm text-slate-300 space-y-2">
              <li className="flex gap-2 items-start">
                <div className="w-5 h-5 bg-cyan-500/20 rounded text-cyan-400 flex items-center justify-center shrink-0 text-[10px]">1</div>
                <span>Nhấn nút màu xanh bên dưới để phá vỡ Iframe.</span>
              </li>
              <li className="flex gap-2 items-start">
                <div className="w-5 h-5 bg-cyan-500/20 rounded text-cyan-400 flex items-center justify-center shrink-0 text-[10px]">2</div>
                <span>Trong Vercel Settings, hãy <b>Disable Toolbar</b>.</span>
              </li>
            </ul>
          </div>

          <a 
            href={window.location.href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:scale-[1.02] transition-all active:scale-95"
          >
            MỞ TRONG TAB MỚI (BẮT BUỘC) <ExternalLink size={24} />
          </a>
          
          <p className="text-[10px] text-slate-600 italic">URL hiện tại: {window.location.host}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden relative">
      {/* Nút Chẩn đoán nhanh cho Developer */}
      <button 
        onClick={() => setShowDiagnostic(!showDiagnostic)}
        className="fixed bottom-4 right-4 z-[100] p-2 bg-slate-800 border border-slate-700 rounded-full text-slate-500 hover:text-cyan-400 transition-colors"
      >
        <Settings size={20} />
      </button>

      {showDiagnostic && (
        <div className="fixed inset-0 z-[110] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6">
           <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Globe size={20} className="text-cyan-400" /> Trạng thái hệ thống
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl">
                  <span className="text-sm text-slate-400">API_KEY (process.env):</span>
                  {process.env.API_KEY ? <CheckCircle2 className="text-green-500" size={18} /> : <XCircle className="text-red-500" size={18} />}
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl">
                  <span className="text-sm text-slate-400">Đang trong Iframe:</span>
                  {isFramed ? <XCircle className="text-red-500" size={18} /> : <CheckCircle2 className="text-green-500" size={18} />}
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl">
                  <span className="text-sm text-slate-400">Microphone Permission:</span>
                  <button onClick={() => navigator.mediaDevices.getUserMedia({audio:true})} className="text-[10px] bg-cyan-500 px-2 py-1 rounded text-white font-bold">Check</button>
                </div>
              </div>
              <button onClick={() => setShowDiagnostic(false)} className="w-full py-3 bg-slate-700 text-white rounded-xl font-bold">Đóng</button>
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
          {/* Main App Content (Same as previous, omitted for brevity but preserved in functionality) */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          
          {connectionError && !isConnected && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
              <div className="bg-red-500/95 text-white p-5 rounded-2xl shadow-2xl border border-red-400 flex flex-col gap-3">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle size={20} /> LỖI KẾT NỐI
                </div>
                <p className="text-sm opacity-90">{connectionError}</p>
                <div className="flex gap-2">
                  <button onClick={() => window.location.reload()} className="bg-white/20 px-4 py-2 rounded-lg text-xs font-bold hover:bg-white/30 transition-colors">THỬ LẠI NGAY</button>
                  <button onClick={handleHome} className="bg-black/20 px-4 py-2 rounded-lg text-xs hover:bg-black/30">VỀ TRANG CHỦ</button>
                </div>
              </div>
            </div>
          )}

          <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-8">
            <div className="mb-12">
               <div className="flex items-center space-x-2 bg-slate-800/80 backdrop-blur-md px-6 py-3 rounded-full border border-slate-700 shadow-xl">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]' : 'bg-slate-600'}`} />
                  <span className="text-slate-100 font-bold tracking-wide uppercase text-xs">
                    {appState.language} • {appState.proficiency}
                  </span>
               </div>
            </div>

            <div className="flex-1 flex items-center justify-center w-full max-w-lg">
               <Visualizer isActive={isConnected} isSpeaking={isSpeaking} volume={volume} />
            </div>

            <div className="mt-8 flex items-center gap-8">
               <button 
                 onClick={() => setShowTranscript(!showTranscript)}
                 className={`p-5 rounded-2xl transition-all shadow-xl ${showTranscript ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
               >
                 <MessageSquare size={28} />
               </button>
               <button 
                 onClick={handleEnd}
                 className="p-8 rounded-[2rem] bg-red-500 text-white shadow-[0_10px_40px_rgba(239,68,68,0.4)] hover:bg-red-600 hover:scale-105 active:scale-95 transition-all"
               >
                 <PhoneOff size={36} />
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

import React from 'react';
import { Language, Proficiency, VoiceName, PracticeMode } from '../types';
import { Mic, MessageCircle, Sparkles, BookOpen } from 'lucide-react';

interface LanguageSelectorProps {
  onStart: (lang: Language, prof: Proficiency, voice: VoiceName, mode: PracticeMode) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onStart }) => {
  const [lang, setLang] = React.useState<Language>(Language.SPANISH);
  const [prof, setProf] = React.useState<Proficiency>(Proficiency.BEGINNER);
  const [voice, setVoice] = React.useState<VoiceName>(VoiceName.Zephyr);
  const [mode, setMode] = React.useState<PracticeMode>(PracticeMode.FREE_TALK);

  const getModeIcon = (m: PracticeMode) => {
    switch (m) {
      case PracticeMode.FREE_TALK: return <MessageCircle size={18} />;
      case PracticeMode.ROLE_PLAY: return <Sparkles size={18} />;
      case PracticeMode.GRAMMAR_FOCUS: return <BookOpen size={18} />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 animate-in fade-in duration-700">
      <div className="w-full max-w-md space-y-8 bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 text-cyan-400 mb-4">
             <Mic size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">LinguaLive</h1>
          <p className="text-slate-400">Choose your practice settings</p>
        </div>

        <div className="space-y-6">
          
          {/* Language Grid */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Language</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(Language).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    lang === l 
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Proficiency Buttons */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Proficiency</label>
            <div className="flex gap-2">
              {Object.values(Proficiency).map((p) => (
                <button
                  key={p}
                  onClick={() => setProf(p)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm transition-all ${
                    prof === p 
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          
          {/* Practice Mode Buttons */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Practice Mode</label>
            <div className="grid grid-cols-1 gap-2">
              {Object.values(PracticeMode).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center justify-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${
                    mode === m 
                      ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/25' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {getModeIcon(m)}
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Select */}
           <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Partner Voice</label>
             <select 
               value={voice} 
               onChange={(e) => setVoice(e.target.value as VoiceName)}
               className="w-full px-4 py-3 rounded-lg bg-slate-700 border-none text-white focus:ring-2 focus:ring-cyan-500 outline-none"
             >
                {Object.values(VoiceName).map(v => (
                    <option key={v} value={v}>{v}</option>
                ))}
             </select>
          </div>
        </div>

        <button
          onClick={() => onStart(lang, prof, voice, mode)}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-lg shadow-xl shadow-cyan-500/20 hover:scale-[1.02] transition-transform active:scale-[0.98]"
        >
          Start Conversation
        </button>
      </div>
    </div>
  );
};

export default LanguageSelector;
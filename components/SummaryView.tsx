import React from 'react';
import { Home, RefreshCw } from 'lucide-react';

interface SummaryViewProps {
  summary?: string;
  onHome: () => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({ summary, onHome }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 animate-in fade-in duration-700 w-full">
      <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-2xl">
        <h2 className="text-3xl font-bold text-white mb-2 text-center">Session Recap</h2>
        <p className="text-slate-400 text-center mb-8">Here's a summary of your practice session.</p>
        
        {!summary ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
             <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
             <p className="text-slate-300 animate-pulse">Analyzing conversation...</p>
          </div>
        ) : (
          <div className="prose prose-invert max-w-none bg-slate-900/50 p-6 rounded-xl border border-slate-700/50">
             <div className="whitespace-pre-wrap text-slate-300 leading-relaxed font-light">
                {summary}
             </div>
          </div>
        )}

        <div className="flex gap-4 mt-8 pt-6 border-t border-slate-700">
           <button 
             onClick={onHome}
             className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-900/20 hover:scale-[1.02] transition-transform"
           >
             <Home size={20} />
             Back to Home
           </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryView;
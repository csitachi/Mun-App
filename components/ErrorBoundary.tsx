
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full space-y-8 animate-in zoom-in duration-300">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 animate-pulse"></div>
              <div className="relative bg-red-500/10 text-red-500 rounded-full flex items-center justify-center w-full h-full border-2 border-red-500/20">
                <AlertTriangle size={48} />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Something went wrong</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                An unexpected error occurred. This might be due to a connection issue or a temporary glitch in the application.
              </p>
              {this.state.error && (
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-left overflow-x-auto">
                  <p className="text-[10px] font-mono text-red-400 break-all">
                    {this.state.error.toString()}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-cyan-500 text-white font-black shadow-lg shadow-cyan-500/20 hover:bg-cyan-600 transition-all active:scale-95"
              >
                <RefreshCcw size={20} />
                RELOAD APPLICATION
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all"
              >
                <Home size={18} />
                GO TO HOME
              </button>
            </div>
            
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">
              LinguaLive Recovery System
            </p>
          </div>
        </div>
      );
    }

    // Fixed: In React class components, the children prop must be accessed via this.props.children
    return this.props.children;
  }
}

export default ErrorBoundary;

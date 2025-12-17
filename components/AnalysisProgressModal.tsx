
import React from 'react';
import { Loader2 } from 'lucide-react';

interface AnalysisProgressModalProps {
  isOpen: boolean;
  statusText: string;
  progress: { current: number; total: number };
}

export const AnalysisProgressModal: React.FC<AnalysisProgressModalProps> = ({
  isOpen,
  statusText,
  progress
}) => {
  if (!isOpen) return null;

  const percentage = progress.total > 0 
    ? Math.min(100, Math.round((progress.current / progress.total) * 100)) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg p-8 border border-gray-700 rounded-xl bg-spine-dark shadow-2xl flex flex-col items-center gap-6">
        
        <div className="relative">
          <div className="absolute inset-0 bg-spine-accent/20 blur-xl rounded-full"></div>
          <Loader2 className="relative w-12 h-12 text-spine-accent animate-spin" />
        </div>

        <div className="w-full text-center space-y-2">
          <h3 className="text-xl font-bold text-white tracking-tight">Processing Assets</h3>
          <p className="text-sm font-mono text-gray-400 h-6">{statusText}</p>
        </div>

        <div className="w-full space-y-2">
          <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden border border-gray-700/50">
            <div 
              className="h-full bg-gradient-to-r from-spine-accent to-red-500 transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 font-mono">
            <span>Progress</span>
            <span>{percentage}%</span>
          </div>
        </div>

      </div>
    </div>
  );
};

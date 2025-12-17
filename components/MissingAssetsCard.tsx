
import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, FileWarning } from 'lucide-react';

interface MissingAssetsCardProps {
  missingPaths: string[];
}

export const MissingAssetsCard: React.FC<MissingAssetsCardProps> = ({ missingPaths }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!missingPaths || missingPaths.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden border border-red-500/50 rounded-lg bg-red-950/20 shadow-lg shadow-red-900/10 animate-in fade-in slide-in-from-top-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 transition-colors bg-red-900/20 hover:bg-red-900/30"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-400">
            <AlertTriangle size={16} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-red-100">Missing Assets ({missingPaths.length})</h3>
            <p className="text-xs text-red-300/70">
              Referenced in JSON but not found in uploaded files. These will appear as missing placeholders.
            </p>
          </div>
        </div>
        <div>
          {isOpen ? <ChevronUp className="text-red-400" /> : <ChevronDown className="text-red-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="max-h-60 overflow-y-auto bg-black/20">
          <ul className="divide-y divide-red-900/30">
            {missingPaths.map((path, idx) => (
                <li key={idx} className="px-4 py-2.5 text-sm text-red-200 font-mono flex items-center gap-3 hover:bg-red-900/10 transition-colors">
                    <FileWarning size={14} className="text-red-500/70 shrink-0" />
                    <span className="truncate">{path}</span>
                </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Layers } from 'lucide-react';

interface PercentageOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (percentage: number) => void;
  initialValue?: number;
  assetPath: string;
  batchCount?: number;
}

export const PercentageOverrideModal: React.FC<PercentageOverrideModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialValue,
  assetPath,
  batchCount = 0
}) => {
  const [value, setValue] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue ? initialValue.toString() : '');
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      onConfirm(num);
      onClose();
    }
  };

  const handleReset = () => {
    onConfirm(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden border border-gray-700 rounded-xl bg-spine-dark shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <h3 className="text-lg font-semibold text-white">Override Resolution</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Target Asset(s)
            </label>
            {batchCount > 1 ? (
               <div className="p-3 bg-blue-900/30 border border-blue-700/50 rounded flex items-center gap-3">
                 <Layers className="text-blue-400" size={20} />
                 <div>
                   <p className="text-sm font-bold text-blue-200">Batch Update</p>
                   <p className="text-xs text-blue-300">Applying setting to {batchCount} selected assets</p>
                 </div>
               </div>
            ) : (
              <div className="p-2 bg-gray-800 rounded border border-gray-700 text-sm text-gray-300 truncate" title={assetPath}>
                {assetPath}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Max Resolution Percentage
            </label>
            <div className="relative">
              <input 
                type="number" 
                min="1"
                max="500"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. 50"
                className="w-full p-3 bg-gray-900 border border-gray-600 rounded text-white focus:border-spine-accent focus:outline-none"
                autoFocus
              />
              <span className="absolute right-4 top-3 text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Enter a percentage of the <strong>calculated MAX</strong> resolution to enforce.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-300 bg-red-900/20 border border-red-900/30 rounded hover:bg-red-900/40 transition-colors"
            >
              <RotateCcw size={16} />
              Reset
            </button>
            <div className="flex-1"></div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value}
              className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-spine-accent rounded hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

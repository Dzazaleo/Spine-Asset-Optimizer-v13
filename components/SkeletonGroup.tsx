
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Bone } from 'lucide-react';

interface SkeletonGroupProps {
  name: string;
  count: number;
  children: React.ReactNode;
  globalExpanded?: boolean;
  searchTerm?: string;
}

export const SkeletonGroup: React.FC<SkeletonGroupProps> = ({ 
  name, 
  count, 
  children,
  globalExpanded,
  searchTerm
}) => {
  const [isOpen, setIsOpen] = useState(true);

  // Sync with global expansion state
  useEffect(() => {
    if (typeof globalExpanded === 'boolean') {
      setIsOpen(globalExpanded);
    }
  }, [globalExpanded]);

  // Auto-expand on search
  useEffect(() => {
    if (searchTerm) {
      setIsOpen(true);
    }
  }, [searchTerm]);

  return (
    <div className="border border-gray-700 rounded-xl bg-gray-800/20 overflow-hidden mb-4 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 bg-gray-800/60 hover:bg-gray-800 transition-colors border-b border-gray-700/50"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-700/50 rounded-lg text-gray-400">
             <Bone size={18} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-gray-200 text-sm tracking-wide flex items-center gap-2">
              {name}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono uppercase tracking-wider">
               <span>{count} items</span>
            </div>
          </div>
        </div>
        <div className="text-gray-500">
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 space-y-3 bg-black/10">
           {children}
        </div>
      )}
    </div>
  );
};

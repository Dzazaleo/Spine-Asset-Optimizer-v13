
import React, { useState } from 'react';
import { GlobalAssetStat } from '../types';
import { Trophy, ChevronDown, ChevronUp, Scaling, Edit2, AlertTriangle, Bone } from 'lucide-react';
import clsx from 'clsx';

interface GlobalStatsSummaryProps {
  stats: GlobalAssetStat[];
  selectedKeys?: Set<string>;
  onMultiSelect?: (key: string, visibleKeys: string[], modifiers: { shiftKey: boolean, ctrlKey: boolean, metaKey: boolean }) => void;
  onOverrideClick?: (asset: GlobalAssetStat) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  onSort: (key: 'path' | 'originalSize' | 'maxRenderSize' | 'sourceAnimation' | 'sourceSkeleton') => void;
  onAnimationClick?: (animationName: string, skeletonName?: string) => void;
  isMultiSkeleton?: boolean;
}

// Remove onToggleSelect from props as it is replaced by onMultiSelect

export const GlobalStatsSummary: React.FC<GlobalStatsSummaryProps> = ({ 
  stats,
  selectedKeys,
  onMultiSelect,
  onOverrideClick,
  sortConfig,
  onSort,
  onAnimationClick,
  isMultiSkeleton = false
}) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!stats || stats.length === 0) return null;

  // Memoize keys for the current view to pass to multi-select logic
  // Since stats is already sorted/filtered by parent, we just map it.
  const visibleKeys = stats.map(s => s.lookupKey);

  // Helper for Sortable Headers
  const SortableHeader = ({ label, sortKey, align = 'left' }: { label: string, sortKey: 'path' | 'originalSize' | 'maxRenderSize' | 'sourceAnimation' | 'sourceSkeleton', align?: 'left' | 'center' | 'right' }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th 
        className={clsx(
          "px-4 py-3 cursor-pointer transition-colors hover:bg-white/5 group select-none",
          align === 'right' ? "text-right" : align === 'center' ? "text-center" : "text-left"
        )}
        onClick={() => onSort(sortKey)}
      >
        <div className={clsx("flex items-center gap-1", 
          align === 'right' && "justify-end",
          align === 'center' && "justify-center"
        )}>
          {label}
          {isActive ? (
             sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-spine-accent" /> : <ChevronDown size={14} className="text-spine-accent" />
          ) : (
             <div className="w-3.5 h-3.5 opacity-0 group-hover:opacity-30">
                <ChevronDown size={14} />
             </div>
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="mb-6 overflow-hidden border border-gray-700 rounded-lg bg-gray-800/40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 transition-colors bg-gray-800/60 hover:bg-gray-800"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-400">
            <Trophy size={16} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-100">Global Maximum Render Source</h3>
            <p className="text-xs text-gray-400">Identify which animation drives the highest resolution for each asset.</p>
          </div>
        </div>
        <div>
          {isOpen ? <ChevronUp className="text-gray-500" /> : <ChevronDown className="text-gray-500" />}
        </div>
      </button>

      {isOpen && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-t border-gray-700">
            <thead className="bg-gray-900/50 text-xs text-gray-400 uppercase font-semibold">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <SortableHeader label="Asset" sortKey="path" />
                <SortableHeader label="Original Size" sortKey="originalSize" align="center" />
                <SortableHeader label="Max Render Size" sortKey="maxRenderSize" align="center" />
                {isMultiSkeleton && <SortableHeader label="Source Skeleton" sortKey="sourceSkeleton" />}
                <SortableHeader label="Source Animation" sortKey="sourceAnimation" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stats.map((stat) => {
                const isUpscaled = stat.maxRenderWidth > stat.originalWidth || stat.maxRenderHeight > stat.originalHeight;
                const isSelected = selectedKeys?.has(stat.lookupKey);
                
                // Check mismatch
                // Only meaningful if physical dimensions are present (which they should be for raw image workflow)
                // We use != checks because sometimes they might be off by a pixel due to rounding, but strict equality is usually expected for matching files.
                const hasMismatch = (stat.physicalWidth !== undefined && stat.physicalHeight !== undefined) &&
                                    (stat.physicalWidth !== stat.originalWidth || stat.physicalHeight !== stat.originalHeight);

                // Fallback calculation if overridePercentage is missing but isOverridden is true
                // Note: Now represents % of Max
                const displayPercentage = stat.overridePercentage ?? 100;

                return (
                  <tr 
                    key={stat.lookupKey} 
                    onClick={(e) => onMultiSelect?.(stat.lookupKey, visibleKeys, e)}
                    className={clsx(
                      "transition-colors cursor-pointer select-none",
                      isSelected ? "bg-green-900/20 hover:bg-green-900/30" : "hover:bg-white/5"
                    )}
                  >
                    <td className="px-4 py-2.5">
                      {onMultiSelect && (
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                          onClick={(e) => e.stopPropagation()} // Prevent row click
                          onChange={() => {
                             // Checkbox behaves as specific toggle (simulating Ctrl+Click)
                             onMultiSelect(stat.lookupKey, visibleKeys, { shiftKey: false, ctrlKey: true, metaKey: true });
                          }}
                          className="w-4 h-4 rounded cursor-pointer accent-spine-accent border-gray-600 bg-gray-700"
                        />
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {hasMismatch && (
                          <div className="group/mismatch relative">
                             <AlertTriangle size={16} className="text-yellow-500/80 hover:text-yellow-400 cursor-help" />
                             <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-2 bg-gray-900 border border-yellow-500/30 rounded shadow-xl z-50 hidden group-hover/mismatch:block pointer-events-none">
                                <p className="text-xs font-bold text-yellow-400 mb-1 border-b border-yellow-500/20 pb-1">Dimension Mismatch Detected</p>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                                   <span className="text-gray-400">Canonical (JSON):</span>
                                   <span className="text-gray-200 font-mono text-right">{stat.originalWidth}x{stat.originalHeight}</span>
                                   <span className="text-gray-400">Physical Source:</span>
                                   <span className="text-gray-200 font-mono text-right">{stat.physicalWidth}x{stat.physicalHeight}</span>
                                </div>
                             </div>
                          </div>
                        )}
                        <div className="font-medium text-sm text-gray-200 truncate max-w-[200px]" title={stat.path}>
                          {stat.path}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-xs text-gray-500">
                      {stat.originalWidth}x{stat.originalHeight}
                    </td>
                    <td className="px-4 py-2.5">
                       <div className="flex flex-col items-center">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onOverrideClick?.(stat);
                            }}
                            className={clsx(
                              "flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 rounded transition-colors group cursor-pointer hover:bg-white/10",
                              stat.isOverridden ? "text-orange-400 font-bold border border-orange-500/30 bg-orange-900/20" : 
                              isUpscaled ? "text-yellow-400/90 border border-transparent" : "text-green-300 border border-transparent"
                            )}
                            title="Click to override max resolution"
                          >
                            {isUpscaled && !stat.isOverridden && <Scaling size={12} />}
                            {stat.isOverridden && <Edit2 size={10} />}
                            <span className={clsx("font-mono text-sm font-bold")}>
                              {stat.maxRenderWidth}x{stat.maxRenderHeight}
                            </span>
                          </button>
                          
                          <span className="text-[10px] text-gray-500 mt-0.5">
                             Scale: {Math.max(stat.maxScaleX, stat.maxScaleY).toFixed(2)}x
                             {stat.isOverridden && (
                               <span className="ml-1 text-orange-400">
                                 (User Override: {displayPercentage}% of Max)
                               </span>
                             )}
                          </span>
                       </div>
                    </td>
                    {isMultiSkeleton && (
                      <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                              <Bone size={14} className="text-gray-500" />
                              <span className="text-sm text-gray-300 font-medium">{stat.sourceSkeleton}</span>
                          </div>
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                       <div className="flex items-center gap-2 flex-wrap">
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             onAnimationClick?.(stat.sourceAnimation, stat.sourceSkeleton);
                           }}
                           className="px-2 py-1 text-xs font-medium text-blue-200 bg-blue-900/30 border border-blue-800/50 rounded hover:bg-blue-800 hover:text-white hover:border-blue-500 transition-all cursor-pointer"
                           title="Scroll to animation"
                         >
                           {stat.sourceAnimation}
                         </button>
                         <span className="text-[10px] text-gray-500 flex items-center gap-0.5 whitespace-nowrap">
                            @ Frame {stat.frameIndex}
                            {stat.skinName && stat.skinName !== 'default' && (
                              <span className="ml-1 text-gray-500">(SKIN: {stat.skinName})</span>
                            )}
                         </span>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

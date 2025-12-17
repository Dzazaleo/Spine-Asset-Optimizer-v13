
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Check, PackageOpen, Info, Scaling, Clock, Edit2, Ban, Bone } from 'lucide-react';
import { AnalysisResult, FoundImageResult } from '../types';
import clsx from 'clsx';

interface AnimationCardProps {
  result: AnalysisResult;
  searchTerm?: string;
  onOverrideClick?: (asset: FoundImageResult) => void;
  selectedKeys?: Set<string>;
  onMultiSelect?: (key: string, visibleKeys: string[], modifiers: { shiftKey: boolean, ctrlKey: boolean, metaKey: boolean }) => void;
  onLocalOverride?: (animationName: string, lookupKey: string) => void;
  globalExpanded?: boolean;
  expandTrigger?: { name: string, ts: number } | null;
  setRef?: (element: HTMLDivElement | null) => void;
  showSkeletonLabel?: boolean;
}

export const AnimationCard: React.FC<AnimationCardProps> = ({ 
  result, 
  searchTerm = "", 
  onOverrideClick,
  selectedKeys,
  onMultiSelect,
  onLocalOverride,
  globalExpanded,
  expandTrigger,
  setRef,
  showSkeletonLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    if (searchTerm) {
      setIsOpen(true);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (typeof globalExpanded === 'boolean') {
      setIsOpen(globalExpanded);
    }
  }, [globalExpanded]);

  useEffect(() => {
    if (expandTrigger && expandTrigger.name === result.animationName) {
      setIsOpen(true);
    }
  }, [expandTrigger, result.animationName]);

  const totalRefs = result.totalUniqueAssets;
  const missingCount = result.missingImages.length;
  const isHealthy = missingCount === 0;
  const isEmpty = result.foundImages.length === 0 && result.missingImages.length === 0;

  const { filteredFound, filteredMissing } = useMemo(() => {
    if (!searchTerm.trim()) {
      return { 
        filteredFound: result.foundImages, 
        filteredMissing: result.missingImages 
      };
    }

    const term = searchTerm.toLowerCase();
    // Allow partial keyword matching (e.g. "ov" -> "override")
    const isOverrideSearch = term.length >= 2 && 'override'.startsWith(term);
    const isSkinSearch = term.length >= 2 && 'skin'.startsWith(term);

    const match = (item: { path: string, bonePath: string, isLocalScaleOverridden?: boolean, showSkinLabel?: boolean, isOverridden?: boolean }) => {
      const textMatch = item.path.toLowerCase().includes(term) || item.bonePath.toLowerCase().includes(term);
      const overrideMatch = isOverrideSearch && (!!item.isLocalScaleOverridden || !!item.isOverridden);
      const skinMatch = isSkinSearch && !!item.showSkinLabel;
      return textMatch || overrideMatch || skinMatch;
    };

    return {
      filteredFound: result.foundImages.filter(match),
      filteredMissing: result.missingImages.filter(match)
    };
  }, [result, searchTerm]);

  // Compute visible keys for multi-select range logic
  const visibleKeys = useMemo(() => filteredFound.map(img => img.lookupKey), [filteredFound]);

  const hasFilteredItems = filteredFound.length > 0 || filteredMissing.length > 0;

  return (
    <div 
      ref={setRef}
      className="overflow-hidden border border-gray-700 rounded-lg bg-spine-card"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 transition-colors hover:bg-gray-700/50"
      >
        <div className="flex items-center gap-3">
          <div className={clsx(
            "flex items-center justify-center w-10 h-10 rounded-full",
            result.isSetupPose ? "bg-blue-500/20 text-blue-400" :
            isEmpty ? "bg-gray-600/20 text-gray-400" :
            isHealthy ? "bg-spine-success/20 text-spine-success" : "bg-red-500/20 text-red-400"
          )}>
            {result.isSetupPose ? <PackageOpen size={20} /> :
             isEmpty ? <Info size={20} /> :
             isHealthy ? <Check size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-100">{result.animationName}</h3>
              {showSkeletonLabel && result.skeletonName && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-800 border border-gray-600 rounded whitespace-nowrap" title={`Source Skeleton: ${result.skeletonName}`}>
                  <Bone size={10} />
                  {result.skeletonName}
                </span>
              )}
              {searchTerm && result.animationName.toLowerCase().includes(searchTerm.toLowerCase()) && (
                 <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-900 bg-spine-accent rounded">MATCH</span>
              )}
            </div>
            <p className="text-sm text-gray-400">
              {isEmpty 
                ? "No assets referenced" 
                : `${totalRefs} unique asset${totalRefs !== 1 ? 's' : ''} referenced`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {!isEmpty && !isHealthy && (
            <span className="px-3 py-1 text-xs font-medium text-red-200 bg-red-900/50 rounded-full">
              {missingCount} missing
            </span>
          )}
          {isOpen ? <ChevronUp className="text-gray-500" /> : <ChevronDown className="text-gray-500" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-gray-700 bg-gray-900/30">
          {isEmpty ? (
            <p className="text-sm text-gray-500">
              No textures are required for this animation (Setup pose is empty and no keys exist).
            </p>
          ) : !hasFilteredItems ? (
             <p className="text-sm text-gray-500 italic">
               No assets match "{searchTerm}" in this animation.
             </p>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Missing Images */}
              {filteredMissing.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold tracking-wider text-red-400 uppercase flex items-center justify-between border-b border-red-900/30 pb-2">
                    <span>Missing Assets</span>
                    {searchTerm && <span className="text-[10px] opacity-70">Filtered</span>}
                  </h4>
                  <ul className="space-y-2">
                    {filteredMissing.map((img, idx) => (
                      <li key={`${img.path}-${idx}`} className="flex items-start gap-3 px-3 py-3 text-sm text-red-300 rounded bg-red-900/20 border border-red-900/30">
                        <AlertTriangle size={18} className="shrink-0 text-red-400 mt-0.5" />
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                             <span className="truncate font-medium text-base text-red-200" title={img.path}>{img.path}</span>
                             <span className="shrink-0 text-[10px] font-bold bg-red-500/20 text-red-200 px-2 py-0.5 rounded border border-red-500/30 uppercase tracking-wide">
                                Missing Texture File
                             </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono text-red-200/50">
                             <span className="shrink-0 text-red-200/30">Bone Path:</span>
                             <span className="truncate">{img.bonePath}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Found Images */}
              {filteredFound.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold tracking-wider text-spine-success uppercase flex items-center justify-between border-b border-gray-700 pb-2">
                    <span>Found Assets</span>
                    {searchTerm && <span className="text-[10px] opacity-70">Filtered</span>}
                  </h4>
                  <ul className="space-y-2">
                    {filteredFound.map((img, idx) => {
                      const isScaledUp = img.maxRenderWidth > img.originalWidth || img.maxRenderHeight > img.originalHeight;
                      const isSelected = selectedKeys?.has(img.lookupKey);
                      
                      return (
                        <li 
                          key={`${img.path}-${idx}`} 
                          onClick={(e) => onMultiSelect?.(img.lookupKey, visibleKeys, e)}
                          className={clsx(
                            "flex items-start gap-3 px-3 py-3 text-sm rounded border transition-colors cursor-pointer select-none",
                            isSelected ? "bg-green-900/40 border-green-500/50" : "bg-green-900/20 border-green-900/30 text-green-300 hover:bg-green-900/30"
                          )}
                        >
                          {onMultiSelect && (
                            <div className="mt-1">
                              <input
                                type="checkbox"
                                checked={!!isSelected}
                                onClick={(e) => e.stopPropagation()} // Prevent row click
                                onChange={() => onMultiSelect(img.lookupKey, visibleKeys, { shiftKey: false, ctrlKey: true, metaKey: true })}
                                className="w-4 h-4 rounded cursor-pointer shrink-0 accent-spine-accent border-gray-600 bg-gray-700"
                              />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            {/* Top Row: Icon + Path */}
                            <div className="flex items-start gap-2">
                              <Check size={16} className="shrink-0 mt-0.5 text-spine-success" />
                              <div className="flex-1 min-w-0">
                                <span className="truncate font-medium block text-base" title={img.path}>{img.path}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs font-mono text-green-200/50 pl-6">
                               <span className="shrink-0 text-green-200/30">Bone Path:</span>
                               <span className="truncate">{img.bonePath}</span>
                            </div>

                            {/* Resolution Details Row */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs mt-1 pl-6">
                              <span className="text-green-500/60 whitespace-nowrap">
                                {img.originalWidth}x{img.originalHeight} original
                              </span>
                              <span className="text-green-500/40">→</span>
                              
                              <span className={clsx("text-gray-400 font-mono text-[10px] bg-black/20 px-1.5 py-0.5 rounded whitespace-nowrap", img.isOverridden && "text-orange-300")}>
                                {img.renderFormula}
                              </span>

                              <span className="text-green-500/40">→</span>
                              
                              {/* Clickable Max Render */}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent toggling selection if row click enabled
                                  onOverrideClick?.(img);
                                }}
                                className={clsx(
                                  "flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 rounded transition-colors group cursor-pointer hover:bg-white/5",
                                  img.isLocalScaleOverridden ? "text-gray-400 border border-gray-600 border-dashed" :
                                  img.isOverridden ? "text-orange-400 font-bold border border-orange-500/30 bg-orange-900/20" : 
                                  isScaledUp ? "text-yellow-400/90 border border-transparent" : "text-green-300 border border-transparent"
                                )}
                                title="Click to override max resolution"
                              >
                                {img.isLocalScaleOverridden && <Ban size={10} />}
                                {!img.isLocalScaleOverridden && isScaledUp && !img.isOverridden && <Scaling size={12} />}
                                {!img.isLocalScaleOverridden && img.isOverridden && <Edit2 size={10} />}
                                <span className="font-mono">
                                  {img.maxRenderWidth}x{img.maxRenderHeight} {img.isLocalScaleOverridden ? "(Local Override)" : img.isOverridden ? "USER" : "max"}
                                  {img.showSkinLabel && !img.isLocalScaleOverridden && (
                                    <span className="ml-1 text-orange-400 font-normal opacity-80">(SKIN: {img.skinName})</span>
                                  )}
                                </span>
                              </button>
                              
                              <div className="flex items-center gap-2 ml-auto md:ml-0">
                                <span className={clsx("font-mono px-1.5 py-0.5 rounded border flex items-center gap-1", 
                                  isScaledUp ? "text-yellow-300 bg-yellow-900/30 border-yellow-500/30" : "text-purple-300 bg-purple-900/30 border-purple-500/30")}>
                                  <Clock size={10} />
                                  Frame {img.maxFrameIndex}
                                </span>
                                
                                {!result.isSetupPose && img.hasScaleTimeline === false && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onLocalOverride?.(result.animationName, img.lookupKey);
                                    }}
                                    className={clsx(
                                      "text-[10px] px-2 py-0.5 rounded border whitespace-nowrap transition-colors flex items-center gap-1",
                                      img.isLocalScaleOverridden 
                                        ? "bg-red-900/30 text-red-300 border-red-700/50 hover:bg-red-900/50"
                                        : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:bg-gray-700/50 hover:text-gray-200"
                                    )}
                                  >
                                    {img.isLocalScaleOverridden ? (
                                      <>
                                        <Ban size={10} />
                                        Scale Ignored
                                      </>
                                    ) : (
                                      "Override Scale (No Keys)"
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

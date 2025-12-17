
import React, { useEffect, useRef, useState } from 'react';
import { AtlasPage, OptimizationTask } from '../types';
import { packAtlases } from '../utils/atlasPacker';
import { X, Map as MapIcon, ChevronLeft, ChevronRight, Layers, Box } from 'lucide-react';
import clsx from 'clsx';

interface AtlasPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: OptimizationTask[];
}

export const AtlasPreviewModal: React.FC<AtlasPreviewModalProps> = ({
  isOpen,
  onClose,
  tasks
}) => {
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [pages, setPages] = useState<AtlasPage[]>([]);
  const [isOptimized, setIsOptimized] = useState(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);

  // Packing Logic
  useEffect(() => {
    if (!isOpen) {
        setPages([]);
        return;
    }
    
    // Delay packing to allow UI/Modal to fully render and settle dimensions.
    const timer = setTimeout(() => {
        // Prepare tasks based on selected view mode
        const packerTasks = tasks.map(t => ({
            ...t,
            targetWidth: isOptimized ? t.targetWidth : t.originalWidth,
            targetHeight: isOptimized ? t.targetHeight : t.originalHeight
        }));

        const result = packAtlases(packerTasks, 2048, 2);
        setPages(result);
        setCurrentPageIdx(0); 
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, tasks, isOptimized]);


  // Render Canvas
  useEffect(() => {
    if (!isOpen || !pages[currentPageIdx] || !canvasRef.current) return;
    
    const page = pages[currentPageIdx];
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    setRendering(true);
    let isMounted = true; // Track effect validity to prevent ghost draws
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background Checkboard (optional visual aid)
    ctx.fillStyle = '#1e1e23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw boundary
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    const drawImages = async () => {
      for (const item of page.items) {
        if (!isMounted) return;

        const img = new Image();
        // Use the blob directly from the task
        const url = URL.createObjectURL(item.task.blob);
        
        await new Promise<void>((resolve) => {
          img.onload = () => {
             if (isMounted) {
                 // Draw image
                 ctx.drawImage(img, item.x, item.y, item.w, item.h);
                 
                 // Draw outline
                 ctx.strokeStyle = 'rgba(100, 255, 100, 0.5)';
                 ctx.lineWidth = 1;
                 ctx.strokeRect(item.x, item.y, item.w, item.h);
             }
             URL.revokeObjectURL(url);
             resolve();
          };
          img.onerror = () => {
            if (isMounted) {
                // Fallback placeholder
                ctx.fillStyle = '#333';
                ctx.fillRect(item.x, item.y, item.w, item.h);
                ctx.strokeStyle = 'red';
                ctx.strokeRect(item.x, item.y, item.w, item.h);
            }
            URL.revokeObjectURL(url);
            resolve();
          };
          img.src = url;
        });
      }
      if (isMounted) setRendering(false);
    };

    drawImages();

    return () => { isMounted = false; };
  }, [isOpen, currentPageIdx, pages]);

  if (!isOpen) return null;

  const activePage = pages[currentPageIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col w-full max-w-5xl h-[90vh] overflow-hidden border border-gray-700 rounded-xl bg-spine-dark shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <MapIcon className="text-spine-accent" size={24} />
            <div>
               <h3 className="text-xl font-semibold text-white">Atlas Preview</h3>
               <p className="text-xs text-gray-400">
                  Visual estimation of packed textures (2048x2048).
               </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Controls / Stats Sidebar */}
          <div className="w-full md:w-64 p-4 border-r border-gray-700 bg-gray-900/50 flex flex-col gap-6 overflow-y-auto">
             
             {/* View Toggle */}
             <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 flex flex-col gap-3">
                <span className="text-xs font-bold text-gray-400 uppercase">View Mode</span>
                <div className="flex bg-gray-900 rounded p-1 border border-gray-700">
                    <button 
                       className={clsx("flex-1 py-1.5 text-xs font-medium rounded transition-colors", !isOptimized ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-gray-300")}
                       onClick={() => setIsOptimized(false)}
                    >
                       Original
                    </button>
                    <button 
                       className={clsx("flex-1 py-1.5 text-xs font-medium rounded transition-colors", isOptimized ? "bg-spine-accent text-white shadow" : "text-gray-400 hover:text-gray-300")}
                       onClick={() => setIsOptimized(true)}
                    >
                       Optimized
                    </button>
                </div>
                <p className="text-[10px] text-gray-500">
                    {isOptimized ? "Showing calculated max render sizes." : "Showing original source dimensions."}
                </p>
             </div>

             {/* Pagination */}
             <div className="flex flex-col gap-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
                <span className="text-xs font-bold text-gray-400 uppercase">Atlas Page</span>
                <div className="flex items-center justify-between">
                   <button 
                     onClick={() => setCurrentPageIdx(p => Math.max(0, p - 1))}
                     disabled={currentPageIdx === 0}
                     className="p-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30"
                   >
                     <ChevronLeft size={20} />
                   </button>
                   <span className="font-mono font-bold text-lg">
                     {pages.length > 0 ? currentPageIdx + 1 : 0} <span className="text-gray-500 text-sm">/ {pages.length}</span>
                   </span>
                   <button 
                     onClick={() => setCurrentPageIdx(p => Math.min(pages.length - 1, p + 1))}
                     disabled={currentPageIdx === pages.length - 1}
                     className="p-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30"
                   >
                     <ChevronRight size={20} />
                   </button>
                </div>
             </div>

             {/* Stats */}
             <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-blue-900/20 rounded border border-blue-800/30">
                  <Layers size={18} className="text-blue-400 mt-1" />
                  <div>
                    <span className="block text-xs text-blue-300 font-bold uppercase">Total Atlases</span>
                    <span className="text-xl font-bold text-white">{pages.length}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-green-900/20 rounded border border-green-800/30">
                  <Box size={18} className="text-green-400 mt-1" />
                  <div>
                    <span className="block text-xs text-green-300 font-bold uppercase">Efficiency (Page {pages.length > 0 ? currentPageIdx + 1 : 0})</span>
                    <span className="text-xl font-bold text-white">{activePage?.efficiency.toFixed(1) || 0}%</span>
                    <span className="block text-xs text-green-400/60 mt-1">
                      {(100 - (activePage?.efficiency || 0)).toFixed(1)}% Empty Space
                    </span>
                  </div>
                </div>
             </div>

             <div className="mt-auto pt-4 text-[10px] text-gray-500">
               * Preview assumes 2px padding and no rotation. Actual export engine may vary slightly.
             </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 bg-black/50 relative flex items-center justify-center p-4 overflow-auto">
             {rendering && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20">
                   <span className="text-spine-accent font-bold animate-pulse">Rendering...</span>
                </div>
             )}
             <div className="relative shadow-2xl border border-gray-800 bg-[#1e1e23]">
                <canvas 
                  ref={canvasRef}
                  width={2048}
                  height={2048}
                  className="max-w-full max-h-full object-contain block w-auto h-auto"
                  style={{ maxHeight: 'calc(90vh - 150px)' }}
                />
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

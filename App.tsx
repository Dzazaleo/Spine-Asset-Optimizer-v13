
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DropZone } from './components/DropZone';
import { AnimationCard } from './components/AnimationCard';
import { SkeletonGroup } from './components/SkeletonGroup';
import { OptimizationModal } from './components/OptimizationModal';
import { PercentageOverrideModal } from './components/PercentageOverrideModal';
import { GlobalStatsSummary } from './components/GlobalStatsSummary';
import { UnusedAssetsCard } from './components/UnusedAssetsCard';
import { MissingAssetsCard } from './components/MissingAssetsCard';
import { AtlasPreviewModal } from './components/AtlasPreviewModal';
import { AnalysisProgressModal } from './components/AnalysisProgressModal';
import { TrackConfigModal } from './components/TrackConfigModal';
import { AnalysisReport, FileAsset, OptimizationTask, OptimizerConfig, TrackItem, SkinDoc, EventDoc, BoneDoc, SpineProject, AnalysisResult, LoadedImageAsset } from './types';
import { analyzeSpineData, extractCanonicalDimensions, mergeAnalysisReports } from './utils/spineParser';
import { calculateOptimizationTargets, generateOptimizedZip } from './utils/optimizer';
import { packAtlases } from './utils/atlasPacker';
import { Activity, Layers, Search, X, Zap, CheckSquare, RotateCcw, Download, Upload, Film, AlertTriangle } from 'lucide-react';

type SortKey = 'path' | 'originalSize' | 'maxRenderSize' | 'sourceAnimation' | 'sourceSkeleton';

export default function App() {
  // Spine Skeleton State (Multi-Project)
  const [loadedSkeletons, setLoadedSkeletons] = useState<Map<string, SpineProject>>(new Map());
  
  // inMemoryImages: Map of path -> Loaded Image Asset
  const [inMemoryImages, setInMemoryImages] = useState<Map<string, LoadedImageAsset>>(new Map());
  
  // Asset Resolution Overrides (Path -> Percentage)
  const [assetOverrides, setAssetOverrides] = useState<Map<string, number>>(new Map());

  // Local Scale Overrides for missing keyframes (AnimationName|LookupKey -> boolean)
  const [localScaleOverrides, setLocalScaleOverrides] = useState<Set<string>>(new Set());

  // Multi-Select State
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);

  // Analysis Report (Merged)
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  
  // Global Collapse/Expand State
  const [allExpanded, setAllExpanded] = useState(false);

  // Sorting State for Global Stats
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ 
    key: 'path', 
    direction: 'asc' 
  });

  // Deep Link State
  const [expandTrigger, setExpandTrigger] = useState<{name: string, ts: number} | null>(null);
  const animationRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Optimization Modal State
  const [isOptModalOpen, setIsOptModalOpen] = useState(false);
  const [optTasks, setOptTasks] = useState<OptimizationTask[]>([]);
  const [optimizationBuffer, setOptimizationBuffer] = useState(1);
  const [isProcessingOpt, setIsProcessingOpt] = useState(false);
  const [optProgress, setOptProgress] = useState({ current: 0, total: 0 });

  // Override Modal State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedAssetForOverride, setSelectedAssetForOverride] = useState<{lookupKey: string, path: string, overridePercentage?: number} | null>(null);

  // Atlas Preview State
  const [isAtlasModalOpen, setIsAtlasModalOpen] = useState(false);
  const [atlasTasks, setAtlasTasks] = useState<OptimizationTask[]>([]);

  // Documentation / Track Builder State
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [trackList, setTrackList] = useState<TrackItem[]>(() => 
    Array.from({ length: 5 }, (_, i) => ({
      id: Math.random().toString(36).substring(2, 9),
      trackIndex: i,
      animations: []
    }))
  );
  
  // New Documentation State
  const [skinDocs, setSkinDocs] = useState<SkinDoc[]>([]);
  const [eventDocs, setEventDocs] = useState<EventDoc[]>([]);
  const [boneDocs, setBoneDocs] = useState<BoneDoc[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");

  // Initial Analysis Loading State
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 100 });
  const [analysisStatus, setAnalysisStatus] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce Search Term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 200);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const handleFilesLoaded = async (assets: FileAsset[]) => {
    setIsAnalysisLoading(true);
    setAnalysisStatus("Initializing...");
    setAnalysisProgress({ current: 0, total: 100 });

    try {
      // 1. Identify dropped content
      const newJsonAssets = assets.filter(a => a.file.name.toLowerCase().endsWith('.json'));
      const newImageAssets = assets.filter(a => a.file.type.startsWith('image/'));

      // 2. Initialize working state
      let currentSkeletons = new Map<string, SpineProject>(loadedSkeletons);
      
      // IF new images are present, we REPLACE the image state to reflect the latest "folder drop".
      // Otherwise, we keep existing images.
      let currentInMemoryImages = newImageAssets.length > 0
          ? new Map<string, LoadedImageAsset>()
          : new Map<string, LoadedImageAsset>(inMemoryImages);
      
      // 3. Process Skeletons (Merge/Overwrite)
      if (newJsonAssets.length > 0) {
         for (const asset of newJsonAssets) {
             const text = await asset.file.text();
             try {
                const data = JSON.parse(text);
                // Identifier: filename without extension
                const id = asset.file.name.replace(/\.json$/i, '');
                currentSkeletons.set(id, {
                    id,
                    data,
                    file: asset.file
                });
             } catch (e) {
                console.error("JSON Parse Error", e);
                alert(`Failed to parse JSON: ${asset.file.name}`);
             }
         }
         // Reset selection if new skeletons are loaded to avoid stale keys
         if (newJsonAssets.length > 0 && loadedSkeletons.size === 0) {
            setAssetOverrides(new Map());
            setLocalScaleOverrides(new Set());
            setSelectedKeys(new Set());
         }
      }

      // Stage 2: Processing Images
      setAnalysisStatus("Stage 2: Processing Images...");
      setAnalysisProgress({ current: 20, total: 100 });
      
      // Extract Canonical Dimensions from ALL loaded skeletons
      const unifiedCanonicalDims = new Map<string, { width: number, height: number }>();
      currentSkeletons.forEach(proj => {
          const dims = extractCanonicalDimensions(proj.data);
          dims.forEach((v, k) => unifiedCanonicalDims.set(k, v));
      });

      // 2. Process Raw Images
      if (newImageAssets.length > 0) {
          for (const asset of newImageAssets) {
             const normalizedPath = asset.path.replace(/\\/g, '/');
             const lookupKey = normalizedPath.toLowerCase();
             
             // --- CANONICAL DIMENSION LOOKUP STRATEGY ---
             let noExt = lookupKey;
             const lastDotIndex = lookupKey.lastIndexOf('.');
             if (lastDotIndex !== -1) {
                 noExt = lookupKey.substring(0, lastDotIndex);
             }

             // Try to find canonical dimensions in skeleton data
             let canonical = unifiedCanonicalDims.get(noExt);
             if (!canonical && noExt.startsWith('images/')) {
                 canonical = unifiedCanonicalDims.get(noExt.substring(7)); 
             }
             if (!canonical) {
                 const firstSlash = noExt.indexOf('/');
                 if (firstSlash !== -1) {
                     const strippedPrefix = noExt.substring(firstSlash + 1);
                     canonical = unifiedCanonicalDims.get(strippedPrefix);
                 }
             }
             
             const physicalW = asset.width || 0;
             const physicalH = asset.height || 0;
             
             let finalW = physicalW;
             let finalH = physicalH;
             
             // Prefer canonical dimensions if available (Spine source of truth)
             if (canonical) {
                 finalW = canonical.width;
                 finalH = canonical.height;
             }

             currentInMemoryImages.set(normalizedPath, {
                 name: normalizedPath,
                 blob: asset.file,
                 width: finalW,   
                 height: finalH, 
                 sourceWidth: physicalW,   
                 sourceHeight: physicalH, 
                 url: URL.createObjectURL(asset.file)
             });
          }
      }

      // Stage 3: Calculation & Analysis
      setAnalysisStatus("Stage 3: Analyzing Skeletons...");
      setAnalysisProgress({ current: 85, total: 100 });

      // Prepare processed assets map
      const processedMap = new Map<string, { width: number, height: number, sourceWidth?: number, sourceHeight?: number, file: File, originalPath: string }>();
      currentInMemoryImages.forEach((asset: LoadedImageAsset) => {
          const file = new File([asset.blob], asset.name, { type: asset.blob.type || 'image/png' });
          const normalizedKey = asset.name.replace(/\\/g, '/').toLowerCase();
          processedMap.set(normalizedKey, {
              width: asset.width,
              height: asset.height,
              sourceWidth: asset.sourceWidth,
              sourceHeight: asset.sourceHeight,
              file: file,
              originalPath: asset.name
          });
      });

      let mergedReport: AnalysisReport | null = report;

      if (currentSkeletons.size > 0) {
         // Run analysis for EACH skeleton
         const individualReports: AnalysisReport[] = [];
         
         currentSkeletons.forEach((project) => {
             const r = analyzeSpineData(project.data, processedMap, assetOverrides, localScaleOverrides, project.id);
             individualReports.push(r);
         });

         // Merge reports
         mergedReport = mergeAnalysisReports(individualReports, processedMap);

         // Update Documentation States if loading fresh
         if (newJsonAssets.length > 0) {
             // Logic to append/merge docs
             // For simplicity, we just add new items found in the merged report
             setSkinDocs(prev => {
                const existing = new Set(prev.map(d => d.name));
                const newItems = mergedReport!.skins.filter(n => !existing.has(n)).map(name => ({ name, description: '' }));
                return [...prev, ...newItems];
             });
             setEventDocs(prev => {
                const existing = new Set(prev.map(d => d.name));
                const newItems = mergedReport!.events.filter(n => !existing.has(n)).map(name => ({ name, description: '' }));
                return [...prev, ...newItems];
             });
             setBoneDocs(prev => {
                const existing = new Set(prev.map(d => d.name));
                const newItems = mergedReport!.controlBones.filter(n => !existing.has(n)).map(name => ({ name, description: '' }));
                return [...prev, ...newItems];
             });
         }
      }

      setAnalysisStatus("Stage 4: Finalizing Report...");
      setAnalysisProgress({ current: 95, total: 100 });
      await new Promise(resolve => setTimeout(resolve, 600));

      setLoadedSkeletons(currentSkeletons);
      setInMemoryImages(currentInMemoryImages);
      setReport(mergedReport);
      
      setAnalysisProgress({ current: 100, total: 100 });
      
    } catch (error) {
       console.error("Processing failed", error);
       alert("An error occurred during file processing.");
    } finally {
       setIsAnalysisLoading(false);
    }
  };

  const handleClearAssets = () => {
    setLoadedSkeletons(new Map());
    setInMemoryImages(new Map());
    
    setAssetOverrides(new Map());
    setLocalScaleOverrides(new Set());
    setSelectedKeys(new Set());
    setLastSelectedKey(null);
    
    setReport(null);
    setSearchTerm("");
    setDebouncedSearchTerm("");
    
    setTrackList(Array.from({ length: 5 }, (_, i) => ({
      id: Math.random().toString(36).substring(2, 9),
      trackIndex: i,
      animations: []
    })));
    setSkinDocs([]);
    setEventDocs([]);
    setBoneDocs([]);
    setGeneralNotes("");

    setOptimizationBuffer(1);
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Re-run analysis when overrides change
  const processedAssets = useMemo(() => {
    const map = new Map<string, { width: number, height: number, sourceWidth?: number, sourceHeight?: number, file: File, originalPath: string }>();
    inMemoryImages.forEach((asset: LoadedImageAsset) => {
        const file = new File([asset.blob], asset.name, { type: asset.blob.type || 'image/png' });
        const normalizedKey = asset.name.replace(/\\/g, '/').toLowerCase();
        map.set(normalizedKey, {
            width: asset.width,
            height: asset.height,
            sourceWidth: asset.sourceWidth,
            sourceHeight: asset.sourceHeight,
            file: file,
            originalPath: asset.name
        });
    });
    return map;
  }, [inMemoryImages]);

  useEffect(() => {
    if (!isAnalysisLoading && loadedSkeletons.size > 0) {
      const individualReports: AnalysisReport[] = [];
      loadedSkeletons.forEach((project) => {
          const r = analyzeSpineData(project.data, processedAssets, assetOverrides, localScaleOverrides, project.id);
          individualReports.push(r);
      });
      // Merge
      const merged = mergeAnalysisReports(individualReports, processedAssets);
      setReport(merged);
    }
  }, [loadedSkeletons, processedAssets, assetOverrides, localScaleOverrides, isAnalysisLoading]);

  // Calculate optimization stats for documentation
  const optimizationStats = useMemo(() => {
    if (!report) return { resizedCount: 0, reduction: "0.0", atlasCount: 0 };
    
    // We can reuse calculateOptimizationTargets logic
    const tasks = calculateOptimizationTargets(report.globalStats, processedAssets, optimizationBuffer);
    
    let resizedCount = 0;
    let totalOriginalPixels = 0;
    let totalTargetPixels = 0;
    
    tasks.forEach(t => {
      if (t.isResize) resizedCount++;
      totalOriginalPixels += t.originalWidth * t.originalHeight;
      totalTargetPixels += t.targetWidth * t.targetHeight;
    });
    
    const reduction = totalOriginalPixels > 0 
      ? ((totalOriginalPixels - totalTargetPixels) / totalOriginalPixels * 100).toFixed(1)
      : "0.0";
      
    // Calculate Projected Atlas Count
    // Assuming standard 2048x2048 max size and 2px padding
    const atlasPages = packAtlases(tasks, 2048, 2);
      
    return { resizedCount, reduction, atlasCount: atlasPages.length };
  }, [report, processedAssets, optimizationBuffer]);

  const handleOpenOptimization = () => {
    if (!report) return;
    // Updated to pass globalStats instead of animations
    const tasks = calculateOptimizationTargets(report.globalStats, processedAssets, optimizationBuffer);
    setOptTasks(tasks);
    setIsOptModalOpen(true);
  };

  const handleAtlasPreviewFromModal = () => {
    setAtlasTasks(optTasks);
    setIsAtlasModalOpen(true);
  };

  const handleBufferChange = (newBuffer: number) => {
    if (!report) return;
    setOptimizationBuffer(newBuffer);
    // Updated to pass globalStats instead of animations
    const tasks = calculateOptimizationTargets(report.globalStats, processedAssets, newBuffer);
    setOptTasks(tasks);
  };

  const handleRunOptimization = async () => {
    setIsProcessingOpt(true);
    setOptProgress({ current: 0, total: optTasks.length });
    try {
      const blob = await generateOptimizedZip(optTasks, (current, total) => {
        setOptProgress({ current, total });
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "images_resized.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTimeout(() => {
        setIsProcessingOpt(false);
        setIsOptModalOpen(false);
      }, 1000);
    } catch (error) {
      console.error("Optimization failed", error);
      alert("Failed to generate optimized images.");
      setIsProcessingOpt(false);
    }
  };

  const handleSelectionAction = (key: string, visibleKeys: string[], modifiers: { shiftKey: boolean, ctrlKey: boolean, metaKey: boolean }) => {
    const newSelected = new Set(selectedKeys);
    
    if (modifiers.shiftKey && lastSelectedKey) {
        const startIdx = visibleKeys.indexOf(lastSelectedKey);
        const endIdx = visibleKeys.indexOf(key);
        
        if (startIdx !== -1 && endIdx !== -1) {
            const low = Math.min(startIdx, endIdx);
            const high = Math.max(startIdx, endIdx);

            if (!modifiers.ctrlKey && !modifiers.metaKey) {
                // Additive
            }
            
            for (let i = low; i <= high; i++) {
                newSelected.add(visibleKeys[i]);
            }
        } else {
             newSelected.add(key);
             setLastSelectedKey(key);
        }
    } else if (modifiers.ctrlKey || modifiers.metaKey) {
        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }
        setLastSelectedKey(key);
    } else {
        newSelected.clear();
        newSelected.add(key);
        setLastSelectedKey(key);
    }

    setSelectedKeys(newSelected);
  };

  const handleClearSelection = () => {
    setSelectedKeys(new Set());
    setLastSelectedKey(null);
  };

  const handleResetAll = () => {
    setAssetOverrides(new Map());
    setLocalScaleOverrides(new Set());
    setSelectedKeys(new Set());
    setLastSelectedKey(null);
  };

  const handleSaveConfig = () => {
    const config: OptimizerConfig = {
      version: 1,
      timestamp: new Date().toISOString(),
      overrides: Array.from(assetOverrides.entries()),
      localOverrides: Array.from(localScaleOverrides),
      selections: Array.from(selectedKeys),
      trackList,
      skinDocs,
      eventDocs,
      boneDocs,
      generalNotes,
      safetyBuffer: optimizationBuffer
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const dateStr = new Date().toISOString().slice(0, 10);
    // Use generic name for multi-skeleton
    let downloadName = `spine-optimizer-config-${dateStr}.json`;
    if (loadedSkeletons.size === 1) {
        const first = loadedSkeletons.values().next().value;
        if (first) {
            downloadName = `spine-optimizer-config-${first.id}-${dateStr}.json`;
        }
    }

    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as OptimizerConfig;
        
        if (json.overrides && Array.isArray(json.overrides)) {
          setAssetOverrides(new Map(json.overrides));
        }
        if (json.localOverrides && Array.isArray(json.localOverrides)) {
          setLocalScaleOverrides(new Set(json.localOverrides));
        }
        if (json.selections && Array.isArray(json.selections)) {
          setSelectedKeys(new Set(json.selections));
        }

        if (json.trackList && Array.isArray(json.trackList)) {
            setTrackList(json.trackList);
        }
        if (json.skinDocs && Array.isArray(json.skinDocs)) {
            setSkinDocs(json.skinDocs);
        }
        if (json.eventDocs && Array.isArray(json.eventDocs)) {
            setEventDocs(json.eventDocs);
        }
        if (json.boneDocs && Array.isArray(json.boneDocs)) {
            setBoneDocs(json.boneDocs);
        }
        if (typeof json.generalNotes === 'string') {
            setGeneralNotes(json.generalNotes);
        }
        if (typeof json.safetyBuffer === 'number') {
            setOptimizationBuffer(json.safetyBuffer);
        }
        
        e.target.value = ''; 
        alert("Configuration loaded successfully.");
      } catch (err) {
        console.error("Failed to parse config", err);
        alert("Invalid configuration file.");
      }
    };
    reader.readAsText(file);
  };

  const handleOverrideClick = (asset: {lookupKey: string, path: string, overridePercentage?: number}) => {
    setSelectedAssetForOverride(asset);
    setOverrideModalOpen(true);
  };

  const handleLocalOverride = (animationName: string, lookupKey: string) => {
    setLocalScaleOverrides(prev => {
      const next = new Set<string>(prev);
      const key = `${animationName}|${lookupKey}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggleExpandAll = () => {
    setAllExpanded(prev => !prev);
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(current => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      if (key === 'originalSize' || key === 'maxRenderSize') {
          return { key, direction: 'desc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleAnimationDeepLink = (animName: string, skeletonName?: string) => {
    setExpandTrigger({ name: animName, ts: Date.now() });
    setTimeout(() => {
        let el: HTMLDivElement | undefined;
        // Try specific key first
        if (skeletonName) {
           el = animationRefs.current.get(`${skeletonName}-${animName}`);
        }
        // Fallback to name only
        if (!el) {
           el = animationRefs.current.get(animName);
        }

        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 50);
  };

  const applyOverride = (percentage: number) => {
    if (!selectedAssetForOverride) return;
    const targets = new Set<string>();
    
    if (selectedKeys.has(selectedAssetForOverride.lookupKey) && selectedKeys.size > 0) {
      selectedKeys.forEach(k => targets.add(k));
    } else {
      targets.add(selectedAssetForOverride.lookupKey);
    }

    const newOverrides = new Map<string, number>(assetOverrides);
    targets.forEach(key => {
       if (percentage > 0) {
        newOverrides.set(key, percentage);
      } else {
        newOverrides.delete(key);
      }
    });

    setAssetOverrides(newOverrides);
  };

  const filteredResults = useMemo(() => {
    if (!report) return [];
    const results = report.animations;
    
    if (!debouncedSearchTerm.trim()) return results;
    const term = debouncedSearchTerm.toLowerCase();
    
    const isOverrideSearch = term.length >= 2 && 'override'.startsWith(term);
    const isSkinSearch = term.length >= 2 && 'skin'.startsWith(term);
    
    return results.filter(result => {
      if (result.animationName.toLowerCase().includes(term)) return true;
      // Also match skeleton name
      if (result.skeletonName && result.skeletonName.toLowerCase().includes(term)) return true;
      
      const assetMatch = (img: any) => {
        const textMatch = img.path.toLowerCase().includes(term) || img.bonePath.toLowerCase().includes(term);
        const overrideMatch = isOverrideSearch && (!!img.isLocalScaleOverridden || !!img.isOverridden);
        const skinMatch = isSkinSearch && !!img.showSkinLabel;
        return textMatch || overrideMatch || skinMatch;
      };

      const hasMatchingFound = result.foundImages.some(assetMatch);
      if (hasMatchingFound) return true;
      
      const hasMatchingMissing = result.missingImages.some(assetMatch);
      if (hasMatchingMissing) return true;
      
      return false;
    });
  }, [report, debouncedSearchTerm]);

  // GROUP RESULTS BY SKELETON
  const groupedResults = useMemo(() => {
    const groups = new Map<string, AnalysisResult[]>();
    filteredResults.forEach(res => {
      const key = res.skeletonName || "Unknown Skeleton";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(res);
    });
    // Sort skeletons alphabetically
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredResults]);

  const filteredGlobalStats = useMemo(() => {
    if (!report) return [];
    let stats = report.globalStats;
    
    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase();
      const isOverrideSearch = term.length >= 2 && 'override'.startsWith(term);
      const isSkinSearch = term.length >= 2 && 'skin'.startsWith(term);
      
      stats = stats.filter(stat => {
        const textMatch = stat.path.toLowerCase().includes(term) || stat.sourceAnimation.toLowerCase().includes(term);
        // Also match skeleton name in stats
        const skeletonMatch = stat.sourceSkeleton ? stat.sourceSkeleton.toLowerCase().includes(term) : false;
        
        const overrideMatch = isOverrideSearch && stat.isOverridden;
        const skinMatch = isSkinSearch && (!!stat.skinName && stat.skinName !== 'default');

        return textMatch || skeletonMatch || overrideMatch || skinMatch;
      });
    }

    return [...stats].sort((a, b) => {
      let res = 0;
      switch (sortConfig.key) {
          case 'path':
              res = a.path.localeCompare(b.path);
              break;
          case 'sourceAnimation':
              res = a.sourceAnimation.localeCompare(b.sourceAnimation);
              break;
          case 'sourceSkeleton':
              res = (a.sourceSkeleton || '').localeCompare(b.sourceSkeleton || '');
              break;
          case 'originalSize':
              res = (a.originalWidth * a.originalHeight) - (b.originalWidth * b.originalHeight);
              break;
          case 'maxRenderSize':
              res = (a.maxRenderWidth * a.maxRenderHeight) - (b.maxRenderWidth * b.maxRenderHeight);
              break;
          default:
              res = 0;
      }
      return sortConfig.direction === 'asc' ? res : -res;
    });
  }, [report, debouncedSearchTerm, sortConfig]);

  // Calculate Missing Assets for Global Alert
  const missingAssets = useMemo(() => {
    if (!report) return [];
    const missing = new Set<string>();
    report.animations.forEach(anim => {
      anim.missingImages.forEach(img => missing.add(img.path));
    });
    return Array.from(missing).sort();
  }, [report]);

  const batchCount = selectedAssetForOverride && selectedKeys.has(selectedAssetForOverride.lookupKey) 
    ? selectedKeys.size 
    : 0;

  const hasUserChanges = assetOverrides.size > 0 || localScaleOverrides.size > 0 || selectedKeys.size > 0;

  const activeImageCount = processedAssets.size;

  return (
    <div className="min-h-screen p-6 text-gray-100 bg-gray-900 md:p-12">
      <header className="max-w-5xl mx-auto mb-12 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
          Spine Asset <span className="text-spine-accent">Optimizer</span> <span className="text-2xl opacity-50 font-mono">v1.0</span>
        </h1>
        <p className="text-lg text-gray-400">
          Drop your Spine files to optimize assets, verify resolutions, and generate structured documentation for development teams.
        </p>
      </header>

      <main className="max-w-5xl mx-auto space-y-8">
        {/* Consolidated Drop Zone */}
        <DropZone 
          onFilesLoaded={handleFilesLoaded}
          onClear={handleClearAssets}
          stats={{
            json: loadedSkeletons.size > 0 ? (loadedSkeletons.size === 1 ? loadedSkeletons.values().next().value?.file.name : `${loadedSkeletons.size} Skeletons`) : undefined,
            // REMOVED: Atlas stats
            images: activeImageCount 
          }}
        />

        {report && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {report.isCanonicalDataMissing && (
              <div className="mb-6 p-4 border border-orange-500/50 bg-orange-900/20 rounded-lg flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={24} />
                <div>
                  <h3 className="text-orange-200 font-bold mb-1">WARNING: Optimization Data Incomplete</h3>
                  <p className="text-sm text-orange-300/80 leading-relaxed">
                    One or more loaded skeletons appear to be missing original size data (width/height) for some assets. 
                    This is usually caused by unchecking the <strong className="text-orange-200">Nonessential data</strong> box during the Spine export process. 
                    Calculations may be incorrect.
                  </p>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col gap-6 pb-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="text-spine-accent" />
                  <h2 className="text-xl font-semibold">Animation Breakdown</h2>
                  <div className="flex items-center gap-2 px-3 py-1 ml-2 text-xs font-medium text-gray-400 rounded-full bg-gray-800/50">
                    <Layers size={14} />
                    <span>
                      {filteredResults.length !== report.animations.length 
                        ? `${filteredResults.length} of ${report.animations.length} Animations`
                        : `${report.animations.length} Animations`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                 
                 {/* LEFT: Configuration Group */}
                 <div className="flex items-center gap-3 w-full lg:w-auto justify-center lg:justify-start">
                    <div className="flex items-center bg-gray-800 p-1 rounded-lg border border-gray-700 shadow-sm">
                       <button
                           type="button"
                           onClick={handleSaveConfig}
                           className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
                           title="Save Configuration"
                       >
                           <Download size={14} />
                           <span className="hidden sm:inline">Save</span>
                       </button>
                       <div className="w-px h-4 bg-gray-700 mx-1"></div>
                       <button
                           type="button"
                           onClick={() => fileInputRef.current?.click()}
                           className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
                           title="Load Configuration"
                       >
                           <Upload size={14} />
                           <span className="hidden sm:inline">Load</span>
                       </button>
                       <input 
                            ref={fileInputRef}
                            type="file" 
                            accept=".json" 
                            className="hidden" 
                            onChange={handleLoadConfig}
                       />
                    </div>

                    {(hasUserChanges || selectedKeys.size > 0) && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                           <div className="w-px h-8 bg-gray-800 hidden lg:block mx-1"></div>
                           {hasUserChanges && (
                               <button 
                                   type="button"
                                   onClick={handleResetAll}
                                   className="p-2 text-orange-400 bg-orange-950/30 border border-orange-900/50 rounded-lg hover:bg-orange-900/50 hover:text-orange-200 transition-colors"
                                   title="Reset Changes"
                               >
                                   <RotateCcw size={16} />
                               </button>
                           )}
                           {selectedKeys.size > 0 && (
                               <button 
                                   type="button"
                                   onClick={handleClearSelection}
                                   className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
                               >
                                   <CheckSquare size={14} className="text-spine-accent" />
                                   <span>Clear ({selectedKeys.size})</span>
                               </button>
                           )}
                        </div>
                    )}
                 </div>

                 {/* CENTER: Primary Actions */}
                 <div className="flex items-center gap-4 order-first lg:order-none w-full lg:w-auto justify-center">
                    <button
                        type="button"
                        onClick={() => setIsTrackModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-gray-200 bg-gray-800 border border-gray-600 rounded-xl hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-all shadow-sm group"
                    >
                        <Film size={18} className="text-purple-400 group-hover:text-purple-300" />
                        <span>Documentation</span>
                    </button>

                    {report.animations.length > 0 && activeImageCount > 0 && (
                        <button
                            type="button"
                            onClick={handleOpenOptimization}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white transition-all rounded-xl bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <Zap size={18} className="fill-current" />
                            <span>Optimize Assets</span>
                        </button>
                    )}
                 </div>

                 {/* RIGHT: Search */}
                 <div className="relative w-full lg:w-64 group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500 group-focus-within:text-spine-accent transition-colors">
                        <Search size={16} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search assets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full py-2 pl-10 pr-8 text-sm text-gray-200 transition-all border border-gray-700 rounded-lg bg-gray-800/50 focus:outline-none focus:ring-1 focus:ring-spine-accent/50 focus:border-spine-accent/50 placeholder:text-gray-600 focus:bg-gray-800"
                    />
                    {searchTerm && (
                        <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500 hover:text-gray-300"
                        >
                        <X size={14} />
                        </button>
                    )}
                 </div>

              </div>
            </div>

            {/* 1. Missing Images Section (Top) */}
            {missingAssets.length > 0 && (
              <MissingAssetsCard missingPaths={missingAssets} />
            )}

            {/* 2. Global Max Render Section */}
            <GlobalStatsSummary 
              stats={filteredGlobalStats} 
              selectedKeys={selectedKeys}
              onMultiSelect={handleSelectionAction}
              onOverrideClick={handleOverrideClick}
              sortConfig={sortConfig}
              onSort={handleSort}
              onAnimationClick={handleAnimationDeepLink}
              isMultiSkeleton={loadedSkeletons.size > 1}
            />

            {/* 3. Unused Assets Section (Kept here as secondary info) */}
            {report.unusedAssets.length > 0 && (
              <UnusedAssetsCard assets={report.unusedAssets} />
            )}

            {/* 4. Asset List / Animation Breakdown */}
            <div className="space-y-4" onDoubleClick={handleToggleExpandAll} title="Double-click to toggle expand/collapse all">
              {filteredResults.length === 0 ? (
                <div className="p-12 text-center border border-dashed rounded-lg border-gray-800 bg-spine-card/20">
                  <p className="text-gray-500">
                    {searchTerm 
                      ? `No animations or assets found matching "${searchTerm}"` 
                      : "No animations found in the provided files."}
                  </p>
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="mt-4 text-sm text-spine-accent hover:underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                groupedResults.map(([skeletonName, items]) => (
                  <SkeletonGroup 
                    key={skeletonName} 
                    name={skeletonName} 
                    count={items.length}
                    globalExpanded={allExpanded}
                    searchTerm={debouncedSearchTerm}
                  >
                    {items.map((result, idx) => (
                      <AnimationCard 
                        key={`${result.skeletonName}-${result.animationName}-${idx}`} 
                        result={result} 
                        searchTerm={debouncedSearchTerm}
                        onOverrideClick={handleOverrideClick}
                        selectedKeys={selectedKeys}
                        onMultiSelect={handleSelectionAction}
                        onLocalOverride={handleLocalOverride}
                        globalExpanded={allExpanded}
                        expandTrigger={expandTrigger}
                        setRef={(el) => {
                           // Use composite key if skeleton name exists to ensure uniqueness
                           const key = result.skeletonName ? `${result.skeletonName}-${result.animationName}` : result.animationName;
                           if (el) animationRefs.current.set(key, el);
                           else animationRefs.current.delete(key);
                        }}
                        showSkeletonLabel={false} // Hidden inside group
                      />
                    ))}
                  </SkeletonGroup>
                ))
              )}
            </div>
          </div>
        )}

        <footer className="mt-12 text-center text-sm text-gray-600">
           {/* Footer content */}
        </footer>
      </main>

      <AnalysisProgressModal 
        isOpen={isAnalysisLoading} 
        statusText={analysisStatus} 
        progress={analysisProgress} 
      />

      <OptimizationModal 
        isOpen={isOptModalOpen}
        onClose={() => !isProcessingOpt && setIsOptModalOpen(false)}
        onConfirm={handleRunOptimization}
        onPreview={handleAtlasPreviewFromModal}
        tasks={optTasks}
        isProcessing={isProcessingOpt}
        progress={optProgress}
        buffer={optimizationBuffer}
        onBufferChange={handleBufferChange}
      />

      <PercentageOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        onConfirm={applyOverride}
        initialValue={selectedAssetForOverride?.overridePercentage}
        assetPath={selectedAssetForOverride?.path || ""}
        batchCount={batchCount}
      />

      <AtlasPreviewModal 
        isOpen={isAtlasModalOpen}
        onClose={() => setIsAtlasModalOpen(false)}
        tasks={atlasTasks}
      />

      <TrackConfigModal 
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        availableAnimations={report?.animations.map(a => a.animationName).sort() || []}
        trackList={trackList}
        setTrackList={setTrackList}
        
        // Documentation Props
        skinDocs={skinDocs}
        setSkinDocs={setSkinDocs}
        eventDocs={eventDocs}
        setEventDocs={setEventDocs}
        boneDocs={boneDocs}
        setBoneDocs={setBoneDocs}
        generalNotes={generalNotes}
        setGeneralNotes={setGeneralNotes}
        
        // New Prop
        safetyBuffer={optimizationBuffer}
        resizedCount={optimizationStats.resizedCount}
        optimizationReduction={optimizationStats.reduction}
        projectedAtlasCount={optimizationStats.atlasCount}
        
        // Metadata
        skeletonName={loadedSkeletons.size === 1 ? (loadedSkeletons.values().next().value?.id || "Skeleton") : `${loadedSkeletons.size} Skeletons`}
        totalImages={report?.globalStats.length || 0}
        totalAnimations={report?.animations.length || 0}
      />
    </div>
  );
}

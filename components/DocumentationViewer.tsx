
import React from 'react';
import { ViewerData } from '../types';
import { FileText, AlertTriangle, Layers, Zap, Bone, Clock, Shield, MessageSquare, Image, Film, Scaling, Map as MapIcon } from 'lucide-react';

// Declare global window property for the embedded data
declare global {
  interface Window {
    SPINE_DATA?: ViewerData;
  }
}

interface DocumentationViewerProps {
  initialData?: ViewerData;
}

export const DocumentationViewer: React.FC<DocumentationViewerProps> = ({ initialData }) => {
  const data = initialData || window.SPINE_DATA;

  if (!data) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#1e1e23] text-gray-400">
            <div className="text-center">
                <AlertTriangle size={48} className="mx-auto mb-4 text-[#ff5c5c]" />
                <h2 className="text-xl font-bold text-white">No Documentation Loaded</h2>
                <p>window.SPINE_DATA is missing.</p>
            </div>
        </div>
    );
  }

  const validTracks = data.trackList.filter(t => t.animations.length > 0).sort((a, b) => a.trackIndex - b.trackIndex);
  const hasGeneralNotes = data.generalNotes && data.generalNotes.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#1e1e23] text-gray-200 font-sans p-6 md:p-12">
        <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-gray-700 pb-6 gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
                        <FileText className="text-[#ff5c5c]" size={32} />
                        <span>Spine Documentation <span className="text-gray-500 mx-2">/</span> <span className="text-[#ff5c5c]">{data.skeletonName}</span></span>
                    </h1>
                    <div className="flex flex-wrap gap-4 mt-4 text-sm font-mono text-gray-400">
                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                            <Clock size={14} />
                            <span>Generated: {new Date(data.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                            <Image size={14} className="text-blue-400" />
                            <span>{data.totalImages} Images Utilized</span>
                        </div>
                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                            <Film size={14} className="text-purple-400" />
                            <span>{data.totalAnimations} Animations Configured</span>
                        </div>
                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                            <Zap size={14} className="text-yellow-400" />
                            <span>{data.resizedCount} Optimized Assets</span>
                        </div>
                         <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                            <MapIcon size={14} className="text-green-400" />
                            <span>{data.projectedAtlasCount} Atlas Pages (2048px)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* General Configuration Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Optimization Config */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-[#4ade80] mb-1">
                            <Shield size={20} />
                            <h3 className="font-bold uppercase tracking-wider text-xs">Optimization Config</h3>
                        </div>
                        <div className="text-3xl font-bold text-white">{data.safetyBuffer}%</div>
                        <p className="text-sm text-gray-400">Safety Buffer</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-700/50">
                        <div className="flex items-center gap-2 text-blue-400 mb-1">
                            <Scaling size={20} />
                            <h3 className="font-bold uppercase tracking-wider text-xs">Space Savings</h3>
                        </div>
                        <div className="text-3xl font-bold text-white">{data.optimizationReduction}%</div>
                        <p className="text-sm text-gray-400">Estimated Reduction</p>
                    </div>
                </div>

                {/* General Notes */}
                <div className="col-span-1 md:col-span-2 bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                     <div className="flex items-center gap-2 text-blue-400 mb-3">
                        <MessageSquare size={20} />
                        <h3 className="font-bold uppercase tracking-wider text-xs">General Notes</h3>
                    </div>
                    {hasGeneralNotes ? (
                        <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                            {data.generalNotes}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic">No general implementation notes provided.</p>
                    )}
                </div>
            </div>

            {/* Tracklist Table */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl overflow-hidden">
                <div className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Clock size={20} className="text-gray-400" />
                        Animation Tracks
                    </h2>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-900/50 text-xs text-gray-400 uppercase tracking-wider">
                                <th className="px-6 py-3 border-b border-gray-700 w-1/3">Animation Name</th>
                                <th className="px-6 py-3 border-b border-gray-700 w-32 text-center">Mix Time</th>
                                <th className="px-6 py-3 border-b border-gray-700 w-24 text-center">Loop</th>
                                <th className="px-6 py-3 border-b border-gray-700">Notes</th>
                            </tr>
                        </thead>
                        {validTracks.length === 0 ? (
                             <tbody>
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">
                                        No tracks configured.
                                    </td>
                                </tr>
                             </tbody>
                        ) : (
                            validTracks.map((track) => (
                                <tbody key={track.id} className="border-b border-gray-700/50 last:border-0">
                                    {/* Track Header Row */}
                                    <tr className="bg-gray-800/40">
                                        <td colSpan={4} className="px-6 py-2 border-b border-gray-700/30">
                                            <span className="font-mono font-bold text-[#ff5c5c] text-xs uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#ff5c5c]"></div>
                                                TRACK {track.trackIndex}
                                            </span>
                                        </td>
                                    </tr>
                                    {/* Animation Rows */}
                                    {track.animations.map((anim, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-3 text-sm font-medium text-gray-200 border-b border-gray-700/30 group-last:border-0 pl-10">
                                                {anim.name}
                                            </td>
                                            <td className="px-6 py-3 text-center border-b border-gray-700/30 group-last:border-0">
                                                {anim.mixDuration === 0 ? (
                                                     <span className="text-gray-500 text-xs uppercase font-bold tracking-wider opacity-60">No Mix Time</span>
                                                ) : (
                                                    <span className="font-mono text-gray-300 text-sm">{anim.mixDuration}s</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-center border-b border-gray-700/30 group-last:border-0">
                                                {anim.loop ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-900/30 text-blue-300 border border-blue-700/30 uppercase">
                                                        Loop
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-600 text-xs opacity-50">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-sm text-gray-400 border-b border-gray-700/30 group-last:border-0">
                                                {anim.notes ? (
                                                    <span>{anim.notes}</span>
                                                ) : (
                                                    <span className="opacity-20 italic"></span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            ))
                        )}
                    </table>
                </div>
            </div>

            {/* Reference Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                 {/* Bones */}
                 {data.boneDocs.length > 0 && (
                    <div className="bg-gray-800/30 border border-gray-700 rounded-xl overflow-hidden h-fit">
                        <div className="px-5 py-3 bg-gray-800/80 border-b border-gray-700">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Bone size={18} className="text-gray-400" />
                                Control Bones
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-700/50">
                            {data.boneDocs.map(doc => (
                                <div key={doc.name} className="p-4">
                                    <div className="font-mono text-sm text-gray-300 mb-1">{doc.name}</div>
                                    <div className="text-sm text-gray-400">{doc.description || <span className="italic opacity-50">No description</span>}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Events */}
                {data.eventDocs.length > 0 && (
                    <div className="bg-gray-800/30 border border-gray-700 rounded-xl overflow-hidden h-fit">
                        <div className="px-5 py-3 bg-gray-800/80 border-b border-gray-700">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Zap size={18} className="text-yellow-400" />
                                Events
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-700/50">
                            {data.eventDocs.map(doc => (
                                <div key={doc.name} className="p-4">
                                    <div className="font-mono text-sm text-yellow-500 mb-1">{doc.name}</div>
                                    <div className="text-sm text-gray-400">{doc.description || <span className="italic opacity-50">No description</span>}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Skins */}
                {data.skinDocs.filter(d => d.name !== 'default').length > 0 && (
                    <div className="bg-gray-800/30 border border-gray-700 rounded-xl overflow-hidden h-fit">
                        <div className="px-5 py-3 bg-gray-800/80 border-b border-gray-700">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Layers size={18} className="text-blue-400" />
                                Skins
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-700/50">
                            {data.skinDocs.filter(d => d.name !== 'default').map(doc => (
                                <div key={doc.name} className="p-4">
                                    <div className="font-mono text-sm text-blue-400 mb-1">{doc.name}</div>
                                    <div className="text-sm text-gray-400">{doc.description || <span className="italic opacity-50">No description</span>}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="pt-12 text-center">
                 <p className="text-xs text-gray-600">Generated by Spine Asset Optimizer</p>
            </div>
        </div>
    </div>
  );
};

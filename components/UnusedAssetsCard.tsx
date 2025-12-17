
import React, { useState } from 'react';
import { UnusedAsset } from '../types';
import { Trash2, ChevronDown, ChevronUp, FileWarning } from 'lucide-react';

interface UnusedAssetsCardProps {
  assets: UnusedAsset[];
}

export const UnusedAssetsCard: React.FC<UnusedAssetsCardProps> = ({ assets }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!assets || assets.length === 0) return null;

  const totalSize = assets.reduce((acc, curr) => acc + curr.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="mb-6 overflow-hidden border border-red-900/50 rounded-lg bg-red-950/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 transition-colors bg-red-900/20 hover:bg-red-900/30"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-400">
            <Trash2 size={16} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-red-100">Unused Assets Found ({assets.length})</h3>
            <p className="text-xs text-red-300/70">
              These files are in your folder but not referenced by the skeleton.
              <span className="ml-2 font-mono bg-red-950/50 px-1.5 py-0.5 rounded text-red-200">
                {formatSize(totalSize)} potential savings
              </span>
            </p>
          </div>
        </div>
        <div>
          {isOpen ? <ChevronUp className="text-red-400" /> : <ChevronDown className="text-red-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="max-h-60 overflow-y-auto">
          <table className="w-full text-left border-t border-red-900/30">
            <thead className="bg-red-900/20 text-xs text-red-300 uppercase font-semibold sticky top-0 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-2">File Name</th>
                <th className="px-4 py-2 text-right">Dimensions</th>
                <th className="px-4 py-2 text-right">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-900/20">
              {assets.map((asset, idx) => (
                <tr key={idx} className="hover:bg-red-900/10 transition-colors">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <FileWarning size={14} className="text-red-400/50" />
                      <span className="text-sm text-red-100 truncate max-w-xs" title={asset.path}>
                        {asset.fileName}
                      </span>
                    </div>
                    <div className="text-[10px] text-red-400/60 pl-6 truncate max-w-xs">
                        {asset.path}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-red-300/70">
                    {asset.width}x{asset.height}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-red-300/70">
                    {formatSize(asset.size)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

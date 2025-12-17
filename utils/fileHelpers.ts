import { FileAsset } from '../types';

// Helper to get image dimensions
export async function getAssetDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
  if (!file.type.startsWith('image/')) return undefined;
  
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(undefined);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

// Helper to enrich a list of assets with their dimensions
export async function enrichAssetsWithDimensions(assets: FileAsset[]): Promise<FileAsset[]> {
  const promises = assets.map(async (asset) => {
    // Only attempt to load dimensions for images to save resources
    if (asset.file.type.startsWith('image/')) {
      const dims = await getAssetDimensions(asset.file);
      if (dims) {
        return { ...asset, width: dims.width, height: dims.height };
      }
    }
    return asset;
  });
  return Promise.all(promises);
}

// Helper to read FileEntry
export async function getFilesFromEntry(entry: FileSystemEntry): Promise<FileAsset[]> {
  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      (entry as FileSystemFileEntry).file((file) => {
        // fullPath usually starts with a slash, e.g. /folder/file.png
        const path = entry.fullPath.startsWith('/') ? entry.fullPath.slice(1) : entry.fullPath;
        resolve([{ file, path }]);
      }, reject);
    });
  } else if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const allEntries: FileSystemEntry[] = [];
    
    // readEntries must be called repeatedly to get all files
    await new Promise<void>((resolve, reject) => {
      function readNext() {
        dirReader.readEntries((results) => {
          if (results.length === 0) {
            resolve();
          } else {
            allEntries.push(...results);
            readNext();
          }
        }, (err) => reject(err));
      }
      readNext();
    });
    
    let files: FileAsset[] = [];
    for (const childEntry of allEntries) {
      const childFiles = await getFilesFromEntry(childEntry);
      files = files.concat(childFiles);
    }
    return files;
  }
  return [];
}

export async function processDropItems(items: DataTransferItemList): Promise<FileAsset[]> {
  const files: FileAsset[] = [];
  const queue: Promise<FileAsset[]>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry?.() || null;
      if (entry) {
        queue.push(getFilesFromEntry(entry));
      } else {
        const file = item.getAsFile();
        if (file) {
          // Fallback for non-entry support: path is just the name
          files.push({ file, path: file.name });
        }
      }
    }
  }

  const results = await Promise.all(queue);
  results.forEach(f => files.push(...f));
  
  // Enrich with dimensions before returning
  return enrichAssetsWithDimensions(files);
}
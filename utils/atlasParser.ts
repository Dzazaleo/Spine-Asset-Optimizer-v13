
import { AtlasAssetMap, AtlasRegion } from '../types';

/**
 * Cleanses the atlas page filename to ensure it matches the normalized keys used in memory.
 * Fixes issues where double extensions (e.g., .png.png) might inadvertently occur, 
 * or where extensions are missing.
 * 
 * Logic:
 * 1. Identify the intended extension (or default to .png).
 * 2. Strip ALL trailing image extensions from the name to isolate the base.
 * 3. Re-append the single intended extension.
 */
function cleanseAtlasPageName(fileName: string): string {
  let name = fileName.trim().replace(/\\/g, '/');
  
  // 1. Detect valid extension from the tail
  const extensionRegex = /(\.(png|jpg|jpeg|webp))$/i;
  const match = name.match(extensionRegex);
  
  let ext = '.png'; // Default to png if none found
  if (match) {
      ext = match[1].toLowerCase();
  }
  
  // 2. Strip ALL extension-like suffixes recursively to get a clean base
  // This handles .png.png, .png.jpg, etc.
  let base = name;
  while (true) {
      const m = base.match(extensionRegex);
      if (m) {
          base = base.substring(0, base.length - m[1].length);
      } else {
          break;
      }
  }
  
  // 3. Re-assemble
  return base + ext;
}

export function parseAtlas(content: string): AtlasAssetMap {
  const lines = content.split(/\r?\n/);
  const map: AtlasAssetMap = new Map();

  let currentPage: string | null = null;
  let currentRegion: Partial<AtlasRegion> | null = null;
  let currentRegionName: string | null = null;

  // Property keys commonly found in LibGDX/Spine atlas files
  const propertyKeys = new Set([
    'rotate', 'xy', 'size', 'orig', 'offset', 'index', 
    'format', 'filter', 'repeat', 'bounds', 'split', 'pad'
  ]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Empty line indicates end of a page block
    if (line.length === 0) {
      if (currentRegion && currentRegionName) {
        map.set(currentRegionName, currentRegion as AtlasRegion);
        currentRegion = null;
        currentRegionName = null;
      }
      currentPage = null; 
      continue;
    }

    // If no page context, this line is the Page Name
    if (currentPage === null) {
      // CRITICAL FIX: Cleanse the filename immediately upon detection
      currentPage = cleanseAtlasPageName(line);
      continue;
    }

    const colonIndex = line.indexOf(':');
    let isProperty = false;
    let key = '';
    let val = '';

    if (colonIndex !== -1) {
      key = line.substring(0, colonIndex).trim();
      val = line.substring(colonIndex + 1).trim();
      if (propertyKeys.has(key)) {
        isProperty = true;
      }
    }

    if (isProperty) {
      // It is a property line
      if (currentRegion) {
        // Apply to current region
        if (key === 'rotate') {
          currentRegion.rotated = val === 'true';
        } else if (key === 'xy') {
          const [x, y] = val.split(',').map(n => parseInt(n.trim()));
          currentRegion.x = x;
          currentRegion.y = y;
        } else if (key === 'size') {
          const [w, h] = val.split(',').map(n => parseInt(n.trim()));
          currentRegion.width = w;
          currentRegion.height = h;
        } else if (key === 'orig') {
          const [w, h] = val.split(',').map(n => parseInt(n.trim()));
          currentRegion.originalWidth = w;
          currentRegion.originalHeight = h;
        } else if (key === 'offset') {
          const [x, y] = val.split(',').map(n => parseInt(n.trim()));
          currentRegion.offsetX = x;
          currentRegion.offsetY = y;
        } else if (key === 'index') {
          currentRegion.index = parseInt(val);
        }
      } else {
        // Page properties (format, filter, etc.) - currently ignored
      }
    } else {
      // It is a Region Name
      // Save previous region if exists
      if (currentRegion && currentRegionName) {
        map.set(currentRegionName, currentRegion as AtlasRegion);
      }

      currentRegionName = line;
      currentRegion = {
        pageName: currentPage, // This now uses the cleansed name
        name: line,
        rotated: false,
        x: 0, y: 0, width: 0, height: 0,
        originalWidth: 0, originalHeight: 0,
        offsetX: 0, offsetY: 0,
        index: -1
      };
    }
  }

  // Final flush for the last region in the file
  if (currentRegion && currentRegionName) {
    map.set(currentRegionName, currentRegion as AtlasRegion);
  }

  return map;
}

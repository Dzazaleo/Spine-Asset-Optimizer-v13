
import { SpineJson, ProcessedSkinMap, AnalysisResult, FoundImageResult, MissingImageResult, AssetUsage, AnalysisReport, GlobalAssetStat, AttachmentInfo, SpineSkin, SpineAttachmentData, UnusedAsset, AtlasAssetMap } from '../types';

/**
 * Extracts canonical dimensions (width/height) defined in the JSON for every attachment.
 * Used to determine the 'Original Size' when no Atlas is provided.
 */
export function extractCanonicalDimensions(json: SpineJson): Map<string, { width: number, height: number }> {
  const dims = new Map<string, { width: number, height: number }>();
  const skins = Array.isArray(json.skins) ? json.skins : [];

  skins.forEach(skin => {
    if (!skin.attachments) return;
    // Iterate slots
    Object.values(skin.attachments).forEach(slotAttachments => {
      // Iterate attachments in slot
      // Cast slotAttachments to Record<string, any> to satisfy TS compiler (unknown type error)
      Object.entries(slotAttachments as Record<string, any>).forEach(([attName, data]) => {
         const attachment = data as SpineAttachmentData;
         // Region and Mesh attachments usually have width/height.
         // We use the 'path' property if available, otherwise 'name' (the key).
         if (attachment.width && attachment.height) {
             const imagePath = attachment.path || attachment.name || attName;
             const normalized = imagePath.toLowerCase().replace(/\\/g, '/');
             dims.set(normalized, { width: attachment.width, height: attachment.height });
         }
      });
    });
  });
  return dims;
}

/**
 * Extracts unique, normalized image filenames referenced by the Atlas Metadata.
 * Used to prevent these pages from being marked as "Unused Assets".
 */
export function getImplicitlyUsedAtlasPages(metadata: AtlasAssetMap): Set<string> {
  const pages = new Set<string>();
  metadata.forEach(region => {
    let name = region.pageName.trim();
    
    // 1. Normalize slashes
    name = name.replace(/\\/g, '/');

    // 2. Fix double extensions (e.g. image.png.png -> image.png)
    if (/\.png\.png$/i.test(name)) {
        name = name.substring(0, name.length - 4);
    } else if (/\.jpg\.jpg$/i.test(name)) {
        name = name.substring(0, name.length - 4);
    }

    // 3. Ensure valid extension (default to .png if missing)
    const hasExt = /\.(png|jpg|jpeg|webp)$/i.test(name);
    if (!hasExt) {
       name += '.png';
    }

    pages.add(name);
  });
  return pages;
}

/**
 * Parses the Spine JSON to build a lookup map of Slot+Attachment -> ImagePath[].
 * Collects ALL paths defined for an attachment across ALL skins, including their setup pose scales.
 */
function buildSkinMap(json: SpineJson): ProcessedSkinMap {
  const map: ProcessedSkinMap = {};
  const skins = Array.isArray(json.skins) ? json.skins : [];

  skins.forEach((rawSkin) => {
    const skin = rawSkin as SpineSkin;
    if (!skin.attachments) return;

    Object.entries(skin.attachments).forEach(([slotName, attachments]) => {
      if (!map[slotName]) map[slotName] = {};
      
      Object.entries(attachments as Record<string, SpineAttachmentData>).forEach(([attachmentName, rawData]) => {
        const data = rawData as SpineAttachmentData;
        const imagePath = data.path || data.name || attachmentName;
        const scaleX = data.scaleX !== undefined ? data.scaleX : 1;
        const scaleY = data.scaleY !== undefined ? data.scaleY : 1;
        const skinName = skin.name || 'default';
        const type = data.type; 

        if (!map[slotName][attachmentName]) {
          map[slotName][attachmentName] = [];
        }
        
        const existing = map[slotName][attachmentName].find(
          item => item.path === imagePath && item.scaleX === scaleX && item.scaleY === scaleY && item.skinName === skinName
        );
        
        if (!existing) {
          map[slotName][attachmentName].push({ path: imagePath, scaleX, scaleY, skinName, type });
        }
      });
    });
  });
  return map;
}

function getSetupPoseWithPaths(json: SpineJson, skinMap: ProcessedSkinMap): Map<string, AttachmentInfo[]> {
  const map = new Map<string, AttachmentInfo[]>();
  if (Array.isArray(json.slots)) {
    json.slots.forEach(slot => {
      const allAttachments: AttachmentInfo[] = [];
      
      if (skinMap[slot.name]) {
        Object.values(skinMap[slot.name]).forEach(attachmentList => {
          attachmentList.forEach(att => {
            // EXCLUSION: Ignore 'clipping' and 'path' attachments as they are not textures.
            if (att.type === 'clipping' || att.type === 'path') return;
            allAttachments.push(att);
          });
        });
      }

      if (allAttachments.length > 0) {
        map.set(slot.name, allAttachments);
      }
    });
  }
  return map;
}

function buildBoneHierarchy(json: SpineJson): Map<string, string> {
  const parentMap = new Map<string, string>();
  if (Array.isArray(json.bones)) {
    json.bones.forEach(bone => {
      if (bone.parent) {
        parentMap.set(bone.name, bone.parent);
      }
    });
  }
  return parentMap;
}

function buildSlotToBoneMap(json: SpineJson): Map<string, string> {
  const map = new Map<string, string>();
  if (Array.isArray(json.slots)) {
    json.slots.forEach(slot => {
      map.set(slot.name, slot.bone);
    });
  }
  return map;
}

function getBonePath(boneName: string, parentMap: Map<string, string>): string {
  const path: string[] = [boneName];
  let current = boneName;
  while (parentMap.has(current)) {
    const parent = parentMap.get(current)!;
    path.unshift(parent);
    current = parent;
  }
  return path.join('/');
}

function getAnimationScaleFactor(timeline: any[], time: number): {x: number, y: number} {
  const identity = { x: 1, y: 1 };
  if (!Array.isArray(timeline) || timeline.length === 0) return identity;

  const getTime = (k: any) => (k && typeof k.time === 'number') ? k.time : 0;
  const getX = (key: any) => (key && key.x !== undefined && key.x !== null) ? key.x : 1;
  const getY = (key: any) => (key && key.y !== undefined && key.y !== null) ? key.y : 1;

  if (time < getTime(timeline[0])) return identity;

  const lastIndex = timeline.length - 1;
  if (time >= getTime(timeline[lastIndex])) {
    const last = timeline[lastIndex];
    if (!last) return identity;
    return { x: getX(last), y: getY(last) };
  }

  let idx = 0;
  while(idx < timeline.length - 1 && getTime(timeline[idx+1]) <= time) {
    idx++;
  }
  
  const prev = timeline[idx];
  const next = timeline[idx+1];

  if (!prev) return identity;
  
  const prevX = getX(prev);
  const prevY = getY(prev);

  if (!next) return { x: prevX, y: prevY };
  if (prev.curve === 'stepped') return { x: prevX, y: prevY };

  const prevTime = getTime(prev);
  const nextTime = getTime(next);
  const nextX = getX(next);
  const nextY = getY(next);
  const duration = nextTime - prevTime;
  const percent = duration > 0 ? (time - prevTime) / duration : 0;

  return {
    x: prevX + (nextX - prevX) * percent,
    y: prevY + (nextY - prevY) * percent
  };
}

function calculateBoneScalesForAnimation(
  json: SpineJson, 
  parentMap: Map<string, string>, 
  targetAnimName: string | null
): Map<string, { x: number, y: number, frame: number }> {
  const bones = Array.isArray(json.bones) ? json.bones : [];
  const boneScales = new Map<string, { x: number, y: number, frame: number }>();

  // 1. Initialize with Setup Pose Scales
  const setupCache = new Map<string, {x: number, y: number}>();
  
  const getSetupScale = (bName: string): {x: number, y: number} => {
      if (setupCache.has(bName)) return setupCache.get(bName)!;
      
      const bone = bones.find(b => b.name === bName);
      const parent = parentMap.get(bName);
      const pScale = parent ? getSetupScale(parent) : {x: 1, y: 1};
      
      const px = pScale?.x ?? 1;
      const py = pScale?.y ?? 1;

      const res = {
          x: px * (bone?.scaleX ?? 1),
          y: py * (bone?.scaleY ?? 1)
      };
      setupCache.set(bName, res);
      return res;
  };

  if (!targetAnimName || !json.animations || !json.animations[targetAnimName]) {
      bones.forEach(b => {
          const s = getSetupScale(b.name);
          const sx = s?.x ?? 1;
          const sy = s?.y ?? 1;
          boneScales.set(b.name, { x: Math.abs(sx), y: Math.abs(sy), frame: 0 });
      });
      if (!boneScales.has('root')) boneScales.set('root', { x: 1, y: 1, frame: 0 });
      return boneScales;
  }

  const animData = json.animations[targetAnimName];
  
  const isAffectedByScaleKey = (bName: string): boolean => {
      let current: string | undefined = bName;
      while (current) {
          if (animData.bones?.[current]?.scale) return true;
          current = parentMap.get(current);
      }
      return false;
  };

  bones.forEach(b => {
      if (isAffectedByScaleKey(b.name)) {
          boneScales.set(b.name, { x: 0, y: 0, frame: 0 });
      } else {
          const s = getSetupScale(b.name);
          const sx = s?.x ?? 1;
          const sy = s?.y ?? 1;
          boneScales.set(b.name, { x: Math.abs(sx), y: Math.abs(sy), frame: 0 });
      }
  });
  if (!boneScales.has('root')) boneScales.set('root', { x: 1, y: 1, frame: 0 });


  let duration = 0;
  const criticalTimes = new Set<number>();
  criticalTimes.add(0);

  if (animData.bones) {
    Object.values(animData.bones).forEach((timeline: any) => {
        if (timeline.scale && Array.isArray(timeline.scale) && timeline.scale.length > 0) {
            const last = timeline.scale[timeline.scale.length - 1];
            const lastTime = (last && typeof last.time === 'number') ? last.time : 0;
            if (lastTime > duration) duration = lastTime;
            
            timeline.scale.forEach((k: any) => {
                const t = (k && typeof k.time === 'number') ? k.time : 0;
                criticalTimes.add(t);
            });
        }
    });
  }

  const fps = 30;
  const totalFrames = Math.ceil(duration * fps);
  for (let f = 0; f <= totalFrames; f++) {
      criticalTimes.add(f / fps);
  }

  const sortedTimes = Array.from(criticalTimes).sort((a, b) => a - b);

  for (const time of sortedTimes) {
      if (typeof time !== 'number') continue;

      const currentFrameIndex = Math.round(time * fps);
      const frameCache = new Map<string, {x: number, y: number}>();
      
      const getFrameScale = (bName: string): {x: number, y: number} => {
            if (frameCache.has(bName)) return frameCache.get(bName)!;
            
            const parent = parentMap.get(bName);
            const pScale = parent ? getFrameScale(parent) : {x: 1, y: 1};
            const px = pScale?.x ?? 1;
            const py = pScale?.y ?? 1;
            
            const bone = bones.find(b => b.name === bName);
            const setupX = bone?.scaleX ?? 1;
            const setupY = bone?.scaleY ?? 1;
            
            let animX = 1, animY = 1;
            const timeline = animData.bones?.[bName]?.scale;
            if (timeline && Array.isArray(timeline)) {
                const factor = getAnimationScaleFactor(timeline, time);
                if (factor) {
                    animX = factor.x ?? 1;
                    animY = factor.y ?? 1;
                }
            }
            
            const finalX = px * setupX * animX;
            const finalY = py * setupY * animY;
            
            const res = {x: finalX, y: finalY};
            frameCache.set(bName, res);
            return res;
      };

      bones.forEach(b => {
          const s = getFrameScale(b.name);
          const current = boneScales.get(b.name);
          if (!current || !s) return; 

          const absX = Math.abs(s.x ?? 0);
          const absY = Math.abs(s.y ?? 0);

          if (absX > current.x) {
            current.x = absX;
            current.frame = currentFrameIndex;
          }
          if (absY > current.y) {
            current.y = absY;
            if (absY > current.x) {
               current.frame = currentFrameIndex;
            }
          }
      });
  }

  return boneScales;
}

export function analyzeSpineData(
  json: SpineJson, 
  availableFiles: Map<string, { width: number, height: number, sourceWidth?: number, sourceHeight?: number } & Record<string, any>>,
  overrides: Map<string, number> = new Map(),
  localScaleOverrides: Set<string> = new Set(),
  skeletonName: string = "Default"
): AnalysisReport {
  // Check for missing canonical data (Nonessential data unchecked)
  let missingCanonicalDataCount = 0;
  const skinsArray = Array.isArray(json.skins) ? json.skins : [];
  skinsArray.forEach(skin => {
    if (!skin.attachments) return;
    Object.values(skin.attachments).forEach(slotAttachments => {
      Object.values(slotAttachments as Record<string, any>).forEach(data => {
         const att = data as SpineAttachmentData;
         // Region and Mesh attachments (type='region' or 'mesh')
         const type = att.type || 'region';
         if (type === 'region' || type === 'mesh') {
             if (att.width === undefined || att.height === undefined) {
                 missingCanonicalDataCount++;
             }
         }
      });
    });
  });
  const isCanonicalDataMissing = missingCanonicalDataCount > 0;

  const skinMap = buildSkinMap(json);
  const parentMap = buildBoneHierarchy(json);
  const slotBoneMap = buildSlotToBoneMap(json);
  const setupPoseMap = getSetupPoseWithPaths(json, skinMap);
  
  const results: AnalysisResult[] = [];

  const resolveBonePath = (slotName: string) => {
    const bone = slotBoneMap.get(slotName);
    return bone ? getBonePath(bone, parentMap) : "Unknown";
  };

  const usedFileKeys = new Set<string>();
  Object.values(skinMap).forEach(slotAttachments => {
     Object.values(slotAttachments as Record<string, AttachmentInfo[]>).forEach(attachmentList => {
        attachmentList.forEach(att => {
           // EXCLUSION: Ignore 'clipping' and 'path' attachments for unused asset check
           if (att.type === 'clipping' || att.type === 'path') return;

           const found = findImage(availableFiles, att.path);
           if (found) {
             usedFileKeys.add(found.key);
           }
        });
     });
  });

  const unusedAssets: UnusedAsset[] = [];
  availableFiles.forEach((metadata, key) => {
     if (!usedFileKeys.has(key)) {
        const fileObj = metadata.file as File | undefined;
        unusedAssets.push({
           path: metadata.originalPath || key,
           fileName: fileObj?.name || key,
           width: metadata.width,
           height: metadata.height,
           size: fileObj?.size || 0
        });
     }
  });

  // Sort unused assets by size (descending) for better visibility
  unusedAssets.sort((a, b) => b.size - a.size);

  const processUsageList = (usages: AssetUsage[], currentAnimName: string): { found: FoundImageResult[], missing: MissingImageResult[], uniqueCount: number } => {
    const found: FoundImageResult[] = [];
    const missing: MissingImageResult[] = [];
    const uniquePaths = new Set<string>();

    usages.forEach(usage => {
      uniquePaths.add(usage.path);
      const foundData = findImage(availableFiles, usage.path);
      
      if (foundData) {
        const fileKey = foundData.key;
        const overridePercent = overrides.get(fileKey);
        
        const overrideKey = `${currentAnimName}|${fileKey}`;
        const isLocalOverride = localScaleOverrides.has(overrideKey);

        const scaleX = usage.maxScaleX ?? 1;
        const scaleY = usage.maxScaleY ?? 1;
        
        let maxW, maxH, formula;
        let isOverridden = false;

        const rawMaxW = Math.ceil(foundData.width * scaleX);
        const rawMaxH = Math.ceil(foundData.height * scaleY);

        if (overridePercent !== undefined) {
          maxW = Math.ceil(rawMaxW * (overridePercent / 100));
          maxH = Math.ceil(rawMaxH * (overridePercent / 100));
          formula = `USER OVERRIDE: ${overridePercent}% of Max (${rawMaxW}x${rawMaxH})`;
          isOverridden = true;
        } else {
          maxW = rawMaxW;
          maxH = rawMaxH;
          formula = `${foundData.width} x ${scaleX.toFixed(2)} and ${foundData.height} x ${scaleY.toFixed(2)}`;
        }

        found.push({ 
          ...usage, 
          resolution: `${foundData.width}x${foundData.height}`,
          originalWidth: foundData.width,
          originalHeight: foundData.height,
          physicalWidth: foundData.sourceWidth,
          physicalHeight: foundData.sourceHeight,
          maxRenderWidth: maxW,
          maxRenderHeight: maxH,
          maxScaleX: scaleX, 
          maxScaleY: scaleY,
          renderFormula: formula,
          maxFrameIndex: usage.maxFrame || 0,
          overridePercentage: overridePercent,
          isOverridden: isOverridden,
          lookupKey: fileKey,
          skinName: usage.skinName,
          hasScaleTimeline: usage.hasScaleTimeline,
          isLocalScaleOverridden: isLocalOverride,
          showSkinLabel: usage.showSkinLabel
        });
      } else {
        missing.push({ ...usage });
      }
    });

    found.sort((a, b) => a.bonePath.localeCompare(b.bonePath));
    missing.sort((a, b) => a.bonePath.localeCompare(b.bonePath));

    return { found, missing, uniqueCount: uniquePaths.size };
  };

  const setupScales = calculateBoneScalesForAnimation(json, parentMap, null);
  const setupUsages: AssetUsage[] = [];
  
  for (const [slotName, attachments] of setupPoseMap.entries()) {
    const boneName = slotBoneMap.get(slotName);
    const stats = (boneName && setupScales.get(boneName)) || { x: 1, y: 1, frame: 0 };
    
    attachments.forEach(att => {
      setupUsages.push({
        path: att.path,
        slotName: slotName,
        bonePath: resolveBonePath(slotName),
        maxScaleX: (stats.x ?? 1) * (att.scaleX ?? 1),
        maxScaleY: (stats.y ?? 1) * (att.scaleY ?? 1),
        maxFrame: stats.frame,
        skinName: att.skinName,
        hasScaleTimeline: false,
        showSkinLabel: att.skinName !== 'default'
      });
    });
  }
  
  const setupProcessed = processUsageList(setupUsages, "Setup Pose (Default)");
  results.push({
    animationName: "Setup Pose (Default)",
    skeletonName: skeletonName,
    totalUniqueAssets: setupProcessed.uniqueCount,
    foundImages: setupProcessed.found,
    missingImages: setupProcessed.missing,
    isSetupPose: true
  });

  if (json.animations) {
    Object.entries(json.animations).forEach(([animName, animData]) => {
      const animUsagesMap = new Map<string, AssetUsage & { _seenSkins: Set<string>, _maxSkins: Set<string>, _maxScaleMag: number }>();
      const touchedSlots = new Set<string>();
      
      const activeBones = new Set<string>();
      if (animData.bones) Object.keys(animData.bones).forEach(k => activeBones.add(k));

      const activeSlots = new Set<string>();
      if (animData.slots) Object.keys(animData.slots).forEach(k => activeSlots.add(k));

      const scaleKeyedBones = new Set<string>();
      if (animData.bones) {
        Object.entries(animData.bones).forEach(([bName, data]) => {
           if (data.scale && data.scale.length > 0) scaleKeyedBones.add(bName);
        });
      }

      const animScales = calculateBoneScalesForAnimation(json, parentMap, animName);

      if (animData.slots) {
        Object.entries(animData.slots).forEach(([slotName, timeline]) => {
          if (timeline.attachment) {
            touchedSlots.add(slotName);
            const bonePath = resolveBonePath(slotName);
            
            const boneName = slotBoneMap.get(slotName);
            const stats = (boneName && animScales.get(boneName)) || { x: 1, y: 1, frame: 0 };
            const hasScale = boneName ? scaleKeyedBones.has(boneName) : false;

            timeline.attachment.forEach(key => {
              if (key.name) {
                const mappedAttachments = skinMap[slotName]?.[key.name] || [{ path: key.name, scaleX: 1, scaleY: 1, skinName: 'default' }];
                mappedAttachments.forEach(att => {
                  // EXCLUSION: Ignore 'clipping' and 'path' attachments in animations
                  if (att.type === 'clipping' || att.type === 'path') return;

                  const compositeKey = `${slotName}|${att.path}`;
                  const currentScaleX = (stats.x ?? 1) * (att.scaleX ?? 1);
                  const currentScaleY = (stats.y ?? 1) * (att.scaleY ?? 1);
                  const scaleMag = Math.max(currentScaleX, currentScaleY);

                  if (!animUsagesMap.has(compositeKey)) {
                    animUsagesMap.set(compositeKey, {
                      path: att.path,
                      slotName: slotName,
                      bonePath: bonePath,
                      maxScaleX: currentScaleX,
                      maxScaleY: currentScaleY,
                      maxFrame: stats.frame,
                      skinName: att.skinName,
                      hasScaleTimeline: hasScale,
                      _seenSkins: new Set([att.skinName]),
                      _maxSkins: new Set([att.skinName]),
                      _maxScaleMag: scaleMag
                    });
                  } else {
                     const existing = animUsagesMap.get(compositeKey)!;
                     existing._seenSkins.add(att.skinName);

                     if (scaleMag > existing._maxScaleMag) {
                        existing.maxScaleX = currentScaleX;
                        existing.maxScaleY = currentScaleY;
                        existing.skinName = att.skinName;
                        existing.maxFrame = stats.frame;
                        existing.hasScaleTimeline = hasScale;
                        
                        existing._maxScaleMag = scaleMag;
                        existing._maxSkins = new Set([att.skinName]);
                     } else if (Math.abs(scaleMag - existing._maxScaleMag) < 0.0001) {
                        existing._maxSkins.add(att.skinName);
                        if (att.skinName === 'default') {
                            existing.skinName = 'default';
                        }
                     }
                  }
                });
              }
            });
          }
        });
      }

      if (Array.isArray(json.slots)) {
        json.slots.forEach(slot => {
           const slotName = slot.name;
           if (touchedSlots.has(slotName)) return;

           const isSlotActive = activeSlots.has(slotName);
           const isBoneActive = activeBones.has(slot.bone);

           if (!isSlotActive && !isBoneActive) return;

           let attachments = setupPoseMap.get(slotName);
           
           if (!attachments && isBoneActive) {
             const implicitAttachmentName = slot.name;
             attachments = skinMap[slotName]?.[implicitAttachmentName];
           }

           if (attachments) {
             const boneName = slotBoneMap.get(slotName);
             const stats = (boneName && animScales.get(boneName)) || { x: 1, y: 1, frame: 0 };
             const hasScale = boneName ? scaleKeyedBones.has(boneName) : false;
             
             attachments.forEach(att => {
                // EXCLUSION: Ignore 'clipping' and 'path' attachments in fallback slots check
                if (att.type === 'clipping' || att.type === 'path') return;

                const compositeKey = `${slotName}|${att.path}`;
                const currentScaleX = (stats.x ?? 1) * (att.scaleX ?? 1);
                const currentScaleY = (stats.y ?? 1) * (att.scaleY ?? 1);
                const scaleMag = Math.max(currentScaleX, currentScaleY);

                if (!animUsagesMap.has(compositeKey)) {
                   animUsagesMap.set(compositeKey, {
                      path: att.path,
                      slotName: slotName,
                      bonePath: resolveBonePath(slotName),
                      maxScaleX: currentScaleX,
                      maxScaleY: currentScaleY,
                      maxFrame: stats.frame,
                      skinName: att.skinName,
                      hasScaleTimeline: hasScale,
                      _seenSkins: new Set([att.skinName]),
                      _maxSkins: new Set([att.skinName]),
                      _maxScaleMag: scaleMag
                   });
                } else {
                     const existing = animUsagesMap.get(compositeKey)!;
                     existing._seenSkins.add(att.skinName);

                     if (scaleMag > existing._maxScaleMag) {
                        existing.maxScaleX = currentScaleX;
                        existing.maxScaleY = currentScaleY;
                        existing.skinName = att.skinName;
                        existing.maxFrame = stats.frame; 
                        existing.hasScaleTimeline = hasScale;

                        existing._maxScaleMag = scaleMag;
                        existing._maxSkins = new Set([att.skinName]);
                     } else if (Math.abs(scaleMag - existing._maxScaleMag) < 0.0001) {
                        existing._maxSkins.add(att.skinName);
                        if (att.skinName === 'default') {
                            existing.skinName = 'default';
                        }
                     }
                }
             });
           }
        });
      }

      for (const usage of animUsagesMap.values()) {
         const isDivergent = usage._seenSkins.size > usage._maxSkins.size;
         usage.showSkinLabel = isDivergent && usage.skinName !== 'default';
      }

      const animProcessed = processUsageList(Array.from(animUsagesMap.values()), animName);
      results.push({
        animationName: animName,
        skeletonName: skeletonName,
        totalUniqueAssets: animProcessed.uniqueCount,
        foundImages: animProcessed.found,
        missingImages: animProcessed.missing,
        isSetupPose: false
      });
    });
  }

  // --- AGGREGATION LOGIC UPDATE ---
  // We separate stats collection into two passes to enforce prioritization:
  // 1. Collect from Animations (isSetupPose=false). This establishes the "Active" max scale.
  // 2. Collect from Setup Pose (isSetupPose=true). Only add if the asset is missing (Fallback).
  
  const globalStatsMap = new Map<string, GlobalAssetStat>();

  const updateGlobalStats = (img: FoundImageResult, animName: string) => {
      if (img.isLocalScaleOverridden) return;

      const area = img.maxRenderWidth * img.maxRenderHeight;
      const current = globalStatsMap.get(img.lookupKey);
      
      // If current exists, it must be from an animation (since we process anims first)
      // So we just use standard max logic within the animation domain.
      const currentArea = current ? current.maxRenderWidth * current.maxRenderHeight : -1;
      
      if (area > currentArea) {
        globalStatsMap.set(img.lookupKey, {
          path: img.path,
          lookupKey: img.lookupKey,
          originalWidth: img.originalWidth,
          originalHeight: img.originalHeight,
          physicalWidth: img.physicalWidth,
          physicalHeight: img.physicalHeight,
          maxRenderWidth: img.maxRenderWidth,
          maxRenderHeight: img.maxRenderHeight,
          maxScaleX: img.maxScaleX!,
          maxScaleY: img.maxScaleY!,
          sourceAnimation: animName,
          sourceSkeleton: skeletonName,
          frameIndex: img.maxFrameIndex,
          isOverridden: !!img.isOverridden,
          skinName: img.skinName,
          overridePercentage: img.overridePercentage
        });
      } else if (area === currentArea) {
         if (img.skinName === 'default' && current && current.skinName !== 'default') {
            current.skinName = 'default';
         }
      }
  };

  // PASS 1: Process Animations
  results.filter(r => !r.isSetupPose).forEach(anim => {
    anim.foundImages.forEach(img => {
        updateGlobalStats(img, anim.animationName);
    });
  });

  // PASS 2: Process Setup Pose (Fallback Only)
  results.filter(r => r.isSetupPose).forEach(anim => {
      anim.foundImages.forEach(img => {
          // KEY FIX: Only add setup stats if no animation stat exists for this asset.
          if (!globalStatsMap.has(img.lookupKey)) {
              updateGlobalStats(img, anim.animationName);
          }
      });
  });

  results.sort((a, b) => {
    if (a.isSetupPose && !b.isSetupPose) return -1;
    if (!a.isSetupPose && b.isSetupPose) return 1;
    return a.animationName.localeCompare(b.animationName, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Extract Documentation Data
  const skins: string[] = [];
  if (Array.isArray(json.skins)) {
    json.skins.forEach(s => {
      if (s.name && s.name !== 'default') skins.push(s.name);
    });
  } else if (json.skins) {
     Object.keys(json.skins).forEach(k => {
        if (k !== 'default') skins.push(k);
     });
  }

  const events: string[] = [];
  if (json.events) {
    Object.keys(json.events).forEach(k => events.push(k));
  }

  const controlBones: string[] = [];
  if (Array.isArray(json.bones)) {
    json.bones.forEach(b => {
      if (b.name && b.name.toLowerCase().startsWith('ctrl_')) {
        controlBones.push(b.name);
      }
    });
  }

  return {
    animations: results,
    globalStats: Array.from(globalStatsMap.values()),
    unusedAssets,
    skins: skins.sort(),
    events: events.sort(),
    controlBones: controlBones.sort(),
    isCanonicalDataMissing
  };
}

/**
 * Merges multiple analysis reports into a single unified report.
 * Calculates global maximums across all skeletons for shared assets,
 * strictly prioritizing animation-derived stats over setup-pose stats.
 */
export function mergeAnalysisReports(
    reports: AnalysisReport[], 
    availableFiles: Map<string, { width: number, height: number, sourceWidth?: number, sourceHeight?: number } & Record<string, any>>,
    implicitFiles?: Set<string>
): AnalysisReport {
    if (reports.length === 0) return {
        animations: [],
        globalStats: [],
        unusedAssets: [],
        skins: [],
        events: [],
        controlBones: [],
        isCanonicalDataMissing: false
    };

    // 1. Merge Animations
    const mergedAnimations: AnalysisResult[] = [];
    reports.forEach(r => mergedAnimations.push(...r.animations));

    // 2. Merge Global Stats (Max Logic with Animation Priority)
    // We group all stats by lookupKey to compare sources across reports.
    const groupedStats = new Map<string, GlobalAssetStat[]>();
    reports.forEach(r => {
        r.globalStats.forEach(stat => {
            if (!groupedStats.has(stat.lookupKey)) {
                groupedStats.set(stat.lookupKey, []);
            }
            groupedStats.get(stat.lookupKey)!.push(stat);
        });
    });

    const finalGlobalStats: GlobalAssetStat[] = [];
    
    groupedStats.forEach((statsList, key) => {
        // Filter out Setup Pose stats if there are Animation stats available
        // The individual skeleton analysis ensures that for a single skeleton, we only get ONE stat (Anim or Setup).
        // But across multiple skeletons, one might be Anim and another Setup. We prefer Anim.
        const animStats = statsList.filter(s => s.sourceAnimation !== "Setup Pose (Default)");
        
        // If we have stats from animations, they take precedence (even if smaller).
        // Fallback to setup stats only if no animation stats exist.
        const candidates = animStats.length > 0 ? animStats : statsList;
        
        // Find the max among the candidates
        let maxStat = candidates[0];
        let maxArea = maxStat.maxRenderWidth * maxStat.maxRenderHeight;
        
        for (let i = 1; i < candidates.length; i++) {
            const current = candidates[i];
            const area = current.maxRenderWidth * current.maxRenderHeight;
            
            if (area > maxArea) {
                maxStat = current;
                maxArea = area;
            } else if (area === maxArea) {
                // Tie-breaker: Prefer max scale
                const maxScale = Math.max(maxStat.maxScaleX, maxStat.maxScaleY);
                const currScale = Math.max(current.maxScaleX, current.maxScaleY);
                if (currScale > maxScale) {
                     maxStat = current;
                }
            }
        }
        finalGlobalStats.push(maxStat);
    });

    // 3. Recalculate Unused Assets (Global Scope)
    // An asset is used if it appears in ANY report's global stats (or found images)
    const usedKeys = new Set<string>();
    reports.forEach(r => {
        r.animations.forEach(anim => {
            anim.foundImages.forEach(img => usedKeys.add(img.lookupKey));
        });
    });

    // Handle Implicit Files (e.g. Atlas Pages)
    if (implicitFiles) {
        implicitFiles.forEach(fileName => {
             const match = findImage(availableFiles, fileName);
             if (match) {
                 usedKeys.add(match.key);
             }
        });
    }

    const unusedAssets: UnusedAsset[] = [];
    availableFiles.forEach((metadata, key) => {
        if (!usedKeys.has(key)) {
            const fileObj = metadata.file as File | undefined;
            unusedAssets.push({
                path: metadata.originalPath || key,
                fileName: fileObj?.name || key,
                width: metadata.width,
                height: metadata.height,
                size: fileObj?.size || 0
            });
        }
    });
    unusedAssets.sort((a, b) => b.size - a.size);

    // 4. Merge Sets
    const skins = new Set<string>();
    const events = new Set<string>();
    const controlBones = new Set<string>();
    let isCanonicalDataMissing = false;

    reports.forEach(r => {
        r.skins.forEach(s => skins.add(s));
        r.events.forEach(e => events.add(e));
        r.controlBones.forEach(b => controlBones.add(b));
        if (r.isCanonicalDataMissing) isCanonicalDataMissing = true;
    });

    return {
        animations: mergedAnimations,
        globalStats: finalGlobalStats,
        unusedAssets,
        skins: Array.from(skins).sort(),
        events: Array.from(events).sort(),
        controlBones: Array.from(controlBones).sort(),
        isCanonicalDataMissing
    };
}

function findImage(filesMap: Map<string, { width: number, height: number, sourceWidth?: number, sourceHeight?: number }>, requiredRef: string): { width: number, height: number, sourceWidth?: number, sourceHeight?: number, key: string } | null {
  const normalizedRef = requiredRef.toLowerCase().replace(/\\/g, '/');
  
  // Optimization: Direct lookup first
  if (filesMap.has(normalizedRef)) {
      const metadata = filesMap.get(normalizedRef)!;
      return { ...metadata, key: normalizedRef };
  }

  // Fallback: Check extensions if strict lookup failed
  // This is relevant if the JSON omits extensions but the file map has them, 
  // though for Atlas workflows we normalized keys in App.tsx to usually omit them or match exactly.
  const extensions = ['.png', '.jpg', '.jpeg', '.webp'];

  for (const ext of extensions) {
      const target = normalizedRef + ext;
      if (filesMap.has(target)) {
          const metadata = filesMap.get(target)!;
          return { ...metadata, key: target };
      }
  }

  // Legacy/Full Scan Fallback: Check for path suffix matches (e.g. folder structure mismatch)
  // This is expensive but necessary for some loose file structures.
  for (const [filePath, metadata] of filesMap.entries()) {
    for (const ext of ['', ...extensions]) {
      const target = normalizedRef + ext;
      if (filePath.endsWith('/' + target)) return { ...metadata, key: filePath };
    }
  }
  return null;
}

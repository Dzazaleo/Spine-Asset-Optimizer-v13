
export interface SpineAttachmentData {
  name?: string;
  path?: string;
  scaleX?: number;
  scaleY?: number;
  type?: string; // Added to identify 'clipping', 'boundingbox', etc.
  width?: number; // Canonical width from Spine
  height?: number; // Canonical height from Spine
  [key: string]: any;
}

export interface SpineSkin {
  name: string;
  attachments: Record<string, Record<string, SpineAttachmentData>>;
}

export interface SpineSlot {
  name: string;
  bone: string; // Slot always references a bone
  attachment?: string;
}

export interface SpineBone {
  name: string;
  parent?: string;
  scaleX?: number;
  scaleY?: number;
}

export interface SpineAnimationSlotTimeline {
  attachment?: { time: number; name?: string }[];
}

export interface SpineAnimation {
  slots?: Record<string, SpineAnimationSlotTimeline>;
  bones?: Record<string, any>; // Animation timelines for bones
}

export interface SpineJson {
  skeleton?: { images?: string };
  bones?: SpineBone[];
  slots?: SpineSlot[];
  skins?: SpineSkin[] | Record<string, any>; 
  events?: Record<string, any>;
  animations?: Record<string, SpineAnimation>;
}

export interface SpineProject {
  id: string; // filename identifier
  data: SpineJson;
  file: File;
}

export interface AssetUsage {
  path: string;
  bonePath: string;
  slotName: string;
  maxScaleX?: number;
  maxScaleY?: number;
  maxFrame?: number;
  skinName?: string;
  hasScaleTimeline?: boolean;
  isLocalScaleOverridden?: boolean;
  showSkinLabel?: boolean;
}

export interface FoundImageResult extends AssetUsage {
  resolution: string; // e.g. "1024x512"
  originalWidth: number;
  originalHeight: number;
  physicalWidth?: number; // Actual file width
  physicalHeight?: number; // Actual file height
  maxRenderWidth: number;
  maxRenderHeight: number;
  renderFormula: string; // e.g. "1024 x 3.0 (cumulative) and 512 x 3.0"
  maxFrameIndex: number;
  // User override fields
  overridePercentage?: number;
  isOverridden?: boolean;
  // Stable identifier for selection and sync
  lookupKey: string;
}

export interface MissingImageResult extends AssetUsage {}

export interface AnalysisResult {
  animationName: string;
  skeletonName?: string; // Track which skeleton this animation belongs to
  totalUniqueAssets: number;
  foundImages: FoundImageResult[];
  missingImages: MissingImageResult[];
  isSetupPose?: boolean;
}

export interface GlobalAssetStat {
  path: string;
  lookupKey: string;
  originalWidth: number;
  originalHeight: number;
  physicalWidth?: number;
  physicalHeight?: number;
  maxRenderWidth: number;
  maxRenderHeight: number;
  maxScaleX: number;
  maxScaleY: number;
  sourceAnimation: string;
  sourceSkeleton: string; // Track which skeleton drives the max size (REQUIRED)
  frameIndex: number;
  isOverridden: boolean;
  skinName?: string;
  overridePercentage?: number;
}

export interface UnusedAsset {
  path: string;
  fileName: string;
  width: number;
  height: number;
  size: number;
}

export interface AnalysisReport {
  animations: AnalysisResult[];
  globalStats: GlobalAssetStat[];
  unusedAssets: UnusedAsset[];
  // Documentation Fields
  skins: string[];
  events: string[];
  controlBones: string[];
  // New Flag
  isCanonicalDataMissing?: boolean;
}

export interface AttachmentInfo {
  path: string;
  scaleX: number;
  scaleY: number;
  skinName: string;
  type?: string;
}

export interface ProcessedSkinMap {
  [slotName: string]: {
    [attachmentName: string]: AttachmentInfo[]; 
  };
}

export interface FileAsset {
  file: File;
  path: string;
  width?: number;
  height?: number;
}

export interface OptimizationTask {
  fileName: string; // The clean output filename (e.g. "folder/image.png")
  relativePath: string; // The lookup path for reference
  originalWidth: number;
  originalHeight: number;
  targetWidth: number;
  targetHeight: number;
  blob: Blob; // The in-memory source data
  maxScaleUsed: number;
  isResize: boolean;
  overridePercentage?: number;
}

// Documentation Builder Interfaces
export interface SkinDoc {
  name: string;
  description: string;
}

export interface EventDoc {
  name: string;
  description: string;
}

export interface BoneDoc {
  name: string;
  description: string;
}

export interface TrackAnimationConfig {
  id: string;
  name: string;
  mixDuration: number;
  loop: boolean;
  notes: string;
}

export interface TrackItem {
  id: string; // Unique ID for keying
  trackIndex: number;
  animations: TrackAnimationConfig[]; // List of animations on this track
}

export interface OptimizerConfig {
  version: number;
  timestamp: string;
  overrides: [string, number][];
  localOverrides: string[];
  selections: string[];
  // Persistence for Documentation Builder & Settings
  trackList?: TrackItem[];
  skinDocs?: SkinDoc[];
  eventDocs?: EventDoc[];
  boneDocs?: BoneDoc[];
  generalNotes?: string;
  safetyBuffer?: number;
}

export interface PackedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  task: OptimizationTask;
}

export interface AtlasPage {
  id: number;
  width: number;
  height: number;
  items: PackedRect[];
  efficiency: number; // 0-100
}

export interface AtlasRegion {
  pageName: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  rotated: boolean;
  offsetX: number;
  offsetY: number;
  index: number;
}

export type AtlasAssetMap = Map<string, AtlasRegion>;

export interface ViewerData {
  trackList: TrackItem[];
  skinDocs: SkinDoc[];
  eventDocs: EventDoc[];
  boneDocs: BoneDoc[];
  generalNotes: string;
  safetyBuffer: number;
  timestamp: string;
  skeletonName: string;
  totalImages: number;
  totalAnimations: number;
  resizedCount: number;
  optimizationReduction: string;
  projectedAtlasCount: number;
}

// Replaces UnpackedAsset for individual file loading
export interface LoadedImageAsset {
  name: string;
  blob: Blob | File;
  width: number;
  height: number;
  url: string;
  sourceWidth?: number;
  sourceHeight?: number;
}

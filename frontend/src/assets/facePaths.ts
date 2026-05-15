// Vector face outline assets — all paths centered at (0, 0).
// Coordinate space: face oval spans roughly ±52 horizontally, −68 to +76 vertically.
// Hair extends above y = −68, up to ≈ −120. Name renders below at NAME_Y.
// All paths are single closed SVG path strings → fed to new Path2D(str).

export const FACE_ASSET_HW   = 68;   // max half-width across all styles
export const FACE_ASSET_HH   = 116;  // max half-height (hair crown to chin)
export const FACE_ASSET_NAME_Y = 94; // y of name text baseline

export interface FacePathAsset {
  id: string;
  label: string;
  outlinePath: string;
  featurePaths?: string[];
  signatureRegion: { x: number; y: number; width: number; height: number };
}

// ─── 16 adult face outline styles ────────────────────────────────────────────

export const FACE_PATHS: FacePathAsset[] = [

  // ── 01  Classic Short Hair ─────────────────────────────────────────────────
  {
    id: 'f01', label: 'Classic Short Hair',
    outlinePath:
      'M 44,-58' +
      ' C 48,-86 26,-112 0,-114' +
      ' C -26,-112 -48,-86 -44,-58' +
      ' C -56,-36 -58,6 -52,38' +
      ' C -46,62 -26,72 0,72' +
      ' C 26,72 46,62 52,38' +
      ' C 58,6 56,-36 44,-58 Z',
    signatureRegion: { x: -38, y: -6, width: 76, height: 58 },
  },

  // ── 02  Slicked-Back Hair ──────────────────────────────────────────────────
  {
    id: 'f02', label: 'Slicked Back',
    outlinePath:
      'M 38,-52' +
      ' C 44,-74 40,-104 0,-110' +
      ' C -40,-104 -44,-74 -38,-52' +
      ' C -54,-28 -58,8 -52,38' +
      ' C -46,62 -26,72 0,72' +
      ' C 26,72 46,62 52,38' +
      ' C 58,8 54,-28 38,-52 Z',
    signatureRegion: { x: -38, y: -6, width: 76, height: 58 },
  },

  // ── 03  Wavy / Textured Hair ───────────────────────────────────────────────
  {
    id: 'f03', label: 'Wavy Textured',
    outlinePath:
      'M 46,-54' +
      ' C 52,-78 48,-102 32,-112' +
      ' C 20,-118 6,-110 0,-104' +
      ' C -6,-98 -4,-90 -14,-102' +
      ' C -24,-114 -38,-116 -48,-54' +
      ' C -60,-30 -60,8 -54,38' +
      ' C -48,62 -28,72 0,72' +
      ' C 28,72 48,62 54,38' +
      ' C 60,8 60,-30 46,-54 Z',
    signatureRegion: { x: -38, y: -6, width: 76, height: 58 },
  },

  // ── 04  Square Jaw / Strong Masculine ─────────────────────────────────────
  {
    id: 'f04', label: 'Square Jaw',
    outlinePath:
      'M 46,-56' +
      ' C 50,-84 30,-110 0,-112' +
      ' C -30,-110 -50,-84 -46,-56' +
      ' C -60,-28 -62,6 -58,32' +
      ' C -54,52 -40,66 -20,72' +
      ' C -8,76 8,76 20,72' +
      ' C 40,66 54,52 58,32' +
      ' C 62,6 60,-28 46,-56 Z',
    signatureRegion: { x: -40, y: -10, width: 80, height: 56 },
  },

  // ── 05  Oblong / Elegant Narrow ────────────────────────────────────────────
  {
    id: 'f05', label: 'Oblong Elegant',
    outlinePath:
      'M 36,-64' +
      ' C 40,-94 22,-118 0,-120' +
      ' C -22,-118 -40,-94 -36,-64' +
      ' C -48,-40 -50,8 -44,44' +
      ' C -38,68 -20,80 0,80' +
      ' C 20,80 38,68 44,44' +
      ' C 50,8 48,-40 36,-64 Z',
    signatureRegion: { x: -34, y: -4, width: 68, height: 60 },
  },

  // ── 06  Heart / Wide Forehead ──────────────────────────────────────────────
  {
    id: 'f06', label: 'Heart Wide',
    outlinePath:
      'M 52,-50' +
      ' C 60,-80 40,-112 0,-114' +
      ' C -40,-112 -60,-80 -52,-50' +
      ' C -62,-20 -58,16 -48,42' +
      ' C -38,62 -20,76 0,78' +
      ' C 20,76 38,62 48,42' +
      ' C 58,16 62,-20 52,-50 Z',
    signatureRegion: { x: -38, y: -4, width: 76, height: 58 },
  },

  // ── 07  Curly / Voluminous Hair ────────────────────────────────────────────
  {
    id: 'f07', label: 'Curly Voluminous',
    outlinePath:
      'M 50,-50' +
      ' C 58,-72 62,-96 46,-110' +
      ' C 32,-122 12,-120 2,-112' +
      ' C -6,-104 -2,-96 -12,-108' +
      ' C -22,-118 -38,-120 -52,-110' +
      ' C -64,-98 -62,-72 -54,-50' +
      ' C -64,-24 -64,10 -58,40' +
      ' C -52,64 -30,76 0,76' +
      ' C 30,76 52,64 58,40' +
      ' C 64,10 64,-24 50,-50 Z',
    signatureRegion: { x: -40, y: -6, width: 80, height: 56 },
  },

  // ── 08  Mature / Professional ──────────────────────────────────────────────
  {
    id: 'f08', label: 'Mature Professional',
    outlinePath:
      'M 36,-46' +
      ' C 46,-70 44,-100 0,-106' +
      ' C -44,-100 -46,-70 -36,-46' +
      ' C -54,-22 -58,10 -52,40' +
      ' C -46,64 -26,74 0,74' +
      ' C 26,74 46,64 52,40' +
      ' C 58,10 54,-22 36,-46 Z',
    signatureRegion: { x: -38, y: -6, width: 76, height: 58 },
  },

  // ── 09  Short Beard Male ────────────────────────────────────────────────────
  {
    id: 'f09', label: 'Short Beard',
    outlinePath:
      'M 44,-58' +
      ' C 48,-86 26,-112 0,-114' +
      ' C -26,-112 -48,-86 -44,-58' +
      ' C -56,-36 -58,6 -52,38' +
      ' C -46,60 -36,70 -22,76' +
      ' C -10,80 10,80 22,76' +
      ' C 36,70 46,60 52,38' +
      ' C 58,6 56,-36 44,-58 Z',
    featurePaths: [
      'M -46,32' +
      ' C -50,52 -42,70 -26,76' +
      ' C -12,82 12,82 26,76' +
      ' C 42,70 50,52 46,32' +
      ' C 30,40 16,44 0,44' +
      ' C -16,44 -30,40 -46,32 Z',
    ],
    signatureRegion: { x: -32, y: -22, width: 64, height: 44 },
  },

  // ── 10  Round Glasses Male ─────────────────────────────────────────────────
  {
    id: 'f10', label: 'Round Glasses',
    outlinePath:
      'M 44,-58' +
      ' C 48,-86 26,-112 0,-114' +
      ' C -26,-112 -48,-86 -44,-58' +
      ' C -56,-36 -58,6 -52,38' +
      ' C -46,62 -26,72 0,72' +
      ' C 26,72 46,62 52,38' +
      ' C 58,6 56,-36 44,-58 Z',
    featurePaths: [
      // left lens ellipse (cx=-20, cy=2, rx=14, ry=11)
      'M -34,2 a 14,11 0 1,0 28,0 a 14,11 0 1,0 -28,0 Z' +
      // right lens ellipse (cx=20, cy=2, rx=14, ry=11)
      ' M 6,2 a 14,11 0 1,0 28,0 a 14,11 0 1,0 -28,0 Z' +
      // bridge + temples
      ' M -6,2 L 6,2 M -34,2 L -50,-3 M 34,2 L 50,-3',
    ],
    signatureRegion: { x: -36, y: 16, width: 72, height: 46 },
  },

  // ── 11  Rectangular Glasses Male ──────────────────────────────────────────
  {
    id: 'f11', label: 'Rectangular Glasses',
    outlinePath:
      'M 44,-56' +
      ' C 50,-84 28,-110 0,-112' +
      ' C -28,-110 -50,-84 -44,-56' +
      ' C -58,-30 -60,6 -54,36' +
      ' C -48,60 -28,72 0,72' +
      ' C 28,72 48,60 54,36' +
      ' C 60,6 58,-30 44,-56 Z',
    featurePaths: [
      // left rect lens
      'M -38,-10 L -6,-10 L -6,12 L -38,12 Z' +
      // bridge
      ' M -6,1 L 6,1' +
      // right rect lens
      ' M 6,-10 L 38,-10 L 38,12 L 6,12 Z' +
      // temples
      ' M -38,1 L -54,-5 M 38,1 L 54,-5',
    ],
    signatureRegion: { x: -36, y: 16, width: 72, height: 46 },
  },

  // ── 12  Full Beard Bold ─────────────────────────────────────────────────────
  {
    id: 'f12', label: 'Full Beard',
    outlinePath:
      'M 46,-56' +
      ' C 52,-86 30,-112 0,-114' +
      ' C -30,-112 -52,-86 -46,-56' +
      ' C -60,-26 -62,8 -58,36' +
      ' C -54,56 -40,66 -24,72' +
      ' C -12,78 12,78 24,72' +
      ' C 40,66 54,56 58,36' +
      ' C 62,8 60,-26 46,-56 Z',
    featurePaths: [
      'M -54,24' +
      ' C -60,46 -54,66 -38,74' +
      ' C -24,82 -12,84 0,84' +
      ' C 12,84 24,82 38,74' +
      ' C 54,66 60,46 54,24' +
      ' C 36,34 18,38 0,38' +
      ' C -18,38 -36,34 -54,24 Z',
    ],
    signatureRegion: { x: -32, y: -26, width: 64, height: 42 },
  },

  // ── 13  Side-Swept Modern ──────────────────────────────────────────────────
  {
    id: 'f13', label: 'Side Swept',
    outlinePath:
      'M 42,-58' +
      ' C 50,-82 34,-110 6,-116' +
      ' C -12,-120 -42,-110 -48,-58' +
      ' C -60,-32 -60,8 -54,38' +
      ' C -48,62 -28,72 0,72' +
      ' C 28,72 48,62 54,38' +
      ' C 60,8 60,-32 42,-58 Z',
    signatureRegion: { x: -38, y: -6, width: 76, height: 58 },
  },

  // ── 14  Bald / Close-Cropped ───────────────────────────────────────────────
  {
    id: 'f14', label: 'Close Cropped',
    outlinePath:
      'M 42,-46' +
      ' C 52,-70 44,-100 0,-106' +
      ' C -44,-100 -52,-70 -42,-46' +
      ' C -56,-22 -58,10 -52,40' +
      ' C -46,64 -26,74 0,74' +
      ' C 26,74 46,64 52,40' +
      ' C 58,10 56,-22 42,-46 Z',
    signatureRegion: { x: -38, y: -6, width: 76, height: 58 },
  },

  // ── 15  Wide Bold Modern ───────────────────────────────────────────────────
  {
    id: 'f15', label: 'Wide Bold',
    outlinePath:
      'M 52,-52' +
      ' C 60,-80 40,-110 0,-114' +
      ' C -40,-110 -60,-80 -52,-52' +
      ' C -66,-22 -68,12 -62,40' +
      ' C -56,64 -34,76 0,76' +
      ' C 34,76 56,64 62,40' +
      ' C 68,12 66,-22 52,-52 Z',
    signatureRegion: { x: -42, y: -6, width: 84, height: 58 },
  },

  // ── 16  Swept Wave / Textured Side Part ────────────────────────────────────
  {
    id: 'f16', label: 'Swept Wave',
    outlinePath:
      'M 44,-56' +
      ' C 50,-80 46,-100 28,-112' +
      ' C 12,-122 -6,-116 -10,-108' +
      ' C -14,-100 -8,-94 -20,-104' +
      ' C -32,-114 -46,-112 -46,-56' +
      ' C -58,-30 -60,8 -54,38' +
      ' C -48,62 -28,72 0,72' +
      ' C 28,72 48,62 54,38' +
      ' C 60,8 58,-30 44,-56 Z',
    signatureRegion: { x: -38, y: -6, width: 76, height: 58 },
  },
];

export const FACE_COUNT = FACE_PATHS.length; // 16

// ─── Path2D cache (resolved once, never re-created) ───────────────────────────

interface ResolvedFace {
  outline:  Path2D;
  features: Path2D[];
  clip:     Path2D;
}

let _resolved: ResolvedFace[] | null = null;

function resolve(): ResolvedFace[] {
  return FACE_PATHS.map((a) => {
    const outline = new Path2D(a.outlinePath);
    const features = (a.featurePaths ?? []).map((s) => new Path2D(s));
    const clip = new Path2D();
    const r = a.signatureRegion;
    clip.rect(r.x, r.y, r.width, r.height);
    return { outline, features, clip };
  });
}

export function getResolvedFace(idx: number): ResolvedFace & { asset: FacePathAsset } {
  if (!_resolved) _resolved = resolve();
  const i = ((idx | 0) % FACE_COUNT + FACE_COUNT) % FACE_COUNT;
  return { ..._resolved[i], asset: FACE_PATHS[i] };
}

/** Deterministic face index from a signature id string. */
export function faceIdxForId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % FACE_COUNT;
}

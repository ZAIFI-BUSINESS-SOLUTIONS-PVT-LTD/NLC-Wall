// Normalized adult face outline paths centered at (0,0).
// Position via ctx.translate/scale or DOMMatrix — never modify these cached paths.

export const FACE_HW = 52;      // half-width of bounding box
export const FACE_HH = 70;      // half-height (crown to chin)
export const NAME_OFFSET = 87;  // y from card center to name baseline (below chin)
export const FACE_COUNT = 5;

const _cache = new Map<number, Path2D>();

/** Return a cached normalized Path2D for the given style index. */
export function getFacePath(style: number): Path2D {
  const s = ((style | 0) % FACE_COUNT + FACE_COUNT) % FACE_COUNT;
  const hit = _cache.get(s);
  if (hit) return hit;
  const p = _build(s);
  _cache.set(s, p);
  return p;
}

/** Deterministic face style from a signature id string. */
export function faceStyleForId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % FACE_COUNT;
}

/**
 * Build a canvas-space Path2D from the normalized face, scaled and translated
 * to (cx, cy) with half-dimensions (hw, hh). Uses DOMMatrix so no ctx transform needed.
 */
export function scaleFacePath(style: number, cx: number, cy: number, hw: number, hh: number): Path2D {
  const sx = hw / FACE_HW;
  const sy = hh / FACE_HH;
  const base = getFacePath(style);
  const out = new Path2D();
  out.addPath(base, new DOMMatrix([sx, 0, 0, sy, cx, cy]));
  return out;
}

function _build(style: number): Path2D {
  const p = new Path2D();
  switch (style) {
    case 0:
      // Classic oval — proportional, slightly tapered chin
      p.moveTo(0, -70);
      p.bezierCurveTo( 36, -70,  52, -40,  52,   5);
      p.bezierCurveTo( 52,  45,  30,  63,   0,  70);
      p.bezierCurveTo(-30,  63, -52,  45, -52,   5);
      p.bezierCurveTo(-52, -40, -36, -70,   0, -70);
      break;
    case 1:
      // Angular — wide high cheekbones, defined jaw taper
      p.moveTo(0, -68);
      p.bezierCurveTo( 28, -68,  56, -26,  56,   8);
      p.bezierCurveTo( 56,  42,  24,  62,   0,  70);
      p.bezierCurveTo(-24,  62, -56,  42, -56,   8);
      p.bezierCurveTo(-56, -26, -28, -68,   0, -68);
      break;
    case 2:
      // Oblong / refined narrow — taller proportion, softer sides
      p.moveTo(0, -74);
      p.bezierCurveTo( 30, -74,  48, -42,  48,   6);
      p.bezierCurveTo( 48,  50,  24,  68,   0,  74);
      p.bezierCurveTo(-24,  68, -48,  50, -48,   6);
      p.bezierCurveTo(-48, -42, -30, -74,   0, -74);
      break;
    case 3:
      // Heart — wide forehead, gracefully narrowed chin
      p.moveTo(0, -70);
      p.bezierCurveTo( 40, -70,  58, -22,  50,  16);
      p.bezierCurveTo( 44,  50,  20,  66,   0,  76);
      p.bezierCurveTo(-20,  66, -44,  50, -50,  16);
      p.bezierCurveTo(-58, -22, -40, -70,   0, -70);
      break;
    case 4:
      // Soft square — defined jaw line, strong but elegant
      p.moveTo(0, -68);
      p.bezierCurveTo( 32, -68,  52, -34,  52,  12);
      p.bezierCurveTo( 52,  48,  36,  64,   0,  64);
      p.bezierCurveTo(-36,  64, -52,  48, -52,  12);
      p.bezierCurveTo(-52, -34, -32, -68,   0, -68);
      break;
    default:
      p.arc(0, 0, 60, 0, Math.PI * 2);
  }
  p.closePath();
  return p;
}

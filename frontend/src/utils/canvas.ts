import { FloatingItem, CARD_PALETTES } from "./animation";
import { DisplayTheme } from "../types";
import { getResolvedFace, FACE_ASSET_NAME_Y, FacePathAsset } from "../assets/facePaths";

const FONT_STACK = "'Noto Sans Tamil', Latha, sans-serif";

let _cardTheme: DisplayTheme = "sky";
export function setCardTheme(theme: DisplayTheme): void {
  _cardTheme = theme;
}

export function drawItem(ctx: CanvasRenderingContext2D, item: FloatingItem): void {
  const { x, y, rotation, scale, opacity, glowAlpha, sig, paletteIdx, faceIdx } = item;
  const palette  = CARD_PALETTES[paletteIdx];
  const isNew    = glowAlpha > 0.05;
  const isSpace  = _cardTheme === "space";
  const { outline, features, clip, asset } = getResolvedFace(faceIdx);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale, scale);

  // ── Glow halo (new entries only) ──────────────────────────────────────────
  if (isNew) {
    ctx.save();
    ctx.globalAlpha = opacity * glowAlpha * 0.55;
    ctx.shadowColor  = palette.glow;
    ctx.shadowBlur   = 42;
    ctx.strokeStyle  = palette.glow;
    ctx.lineWidth    = 3.5;
    ctx.stroke(outline);
    ctx.shadowBlur  = 18;
    ctx.lineWidth   = 1.8;
    ctx.stroke(outline);
    ctx.restore();
  }

  // ── Drawn handwritten signature clipped to signature region ───────────────
  if (sig.signature) {
    ctx.save();
    ctx.clip(clip);
    drawSignatureImage(ctx, sig.signature, asset, isSpace);
    ctx.restore();
  }

  // ── Face outline (vector stroke) ──────────────────────────────────────────
  ctx.save();
  if (isNew) {
    ctx.shadowColor = palette.shadow;
    ctx.shadowBlur  = 16;
    ctx.strokeStyle = isSpace ? palette.glow : palette.border;
    ctx.lineWidth   = 1.8;
  } else {
    ctx.shadowColor = isSpace ? "rgba(160,200,255,0.25)" : palette.shadow;
    ctx.shadowBlur  = 5;
    ctx.strokeStyle = isSpace
      ? "rgba(200,220,255,0.48)"
      : `${palette.border}cc`;
    ctx.lineWidth = 1.1;
  }
  ctx.stroke(outline);
  ctx.restore();

  // ── Optional feature paths (glasses, beard) ───────────────────────────────
  for (const feat of features) {
    ctx.save();
    ctx.strokeStyle = isSpace
      ? "rgba(200,220,255,0.38)"
      : `${palette.border}99`;
    ctx.lineWidth   = 0.9;
    ctx.shadowBlur  = 0;
    ctx.stroke(feat);
    ctx.restore();
  }

  // ── Name below face ───────────────────────────────────────────────────────
  ctx.font         = `700 14px ${FONT_STACK}`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur   = 0;

  if (isSpace) {
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = palette.lightText;
  } else {
    ctx.fillStyle = palette.border;
  }
  ctx.fillText(sig.name, 0, FACE_ASSET_NAME_Y);

  ctx.restore();
}

// ─── Signature image renderer ─────────────────────────────────────────────────

function drawSignatureImage(
  ctx: CanvasRenderingContext2D,
  b64: string,
  asset: FacePathAsset,
  invert: boolean,
): void {
  const img = _imgCache.get(b64);
  if (img && img.complete && img.naturalWidth > 0) {
    const r   = asset.signatureRegion;
    const maxW = r.width;
    const maxH = r.height;
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = img.naturalWidth  * ratio;
    const h = img.naturalHeight * ratio;
    const cx = r.x + r.width  / 2;
    const cy = r.y + r.height / 2;
    ctx.save();
    ctx.globalAlpha *= 0.88;
    if (invert) ctx.filter = "invert(1) brightness(1.3)";
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  } else if (!img) {
    const el = new Image();
    el.src = b64;
    _imgCache.set(b64, el);
    if (_imgCache.size > 300) _imgCache.delete(_imgCache.keys().next().value!);
  }
}

const _imgCache = new Map<string, HTMLImageElement>();

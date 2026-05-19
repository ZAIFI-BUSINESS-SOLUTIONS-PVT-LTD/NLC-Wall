import { FloatingItem, CARD_PALETTES } from "./animation";
import { DisplayTheme } from "../types";
import { THEME_CONFIGS } from "./themes";

const FONT_STACK = "'Noto Sans Tamil', Latha, sans-serif";

let _cardTheme: DisplayTheme = "sky";
export function setCardTheme(theme: DisplayTheme): void {
  _cardTheme = theme;
}

interface PaletteEntry {
  border: string;
  darkText: string;
  lightText: string;
  glow: string;
  shadow: string;
}

function getEffectivePalette(paletteIdx: number, themePalette: string[] | null): PaletteEntry {
  if (themePalette) {
    const color = themePalette[paletteIdx % themePalette.length];
    return {
      border: color,
      darkText: "#000",
      lightText: "#ffffff",
      glow: color,
      shadow: `${color}88`,
    };
  }
  return CARD_PALETTES[paletteIdx];
}

export function drawItem(ctx: CanvasRenderingContext2D, item: FloatingItem): void {
  const { x, y, rotation, scale, opacity, glowAlpha, sig, paletteIdx } = item;
  const cfg = THEME_CONFIGS[_cardTheme];
  const palette = getEffectivePalette(paletteIdx, cfg.palette);
  const isNew = glowAlpha > 0.05;
  const { cardStyle } = cfg;

  // Resolve card background gradient
  const bg0 = cardStyle.bgGradient[0];
  const bg1 = cardStyle.bgGradient[1] === "" ? `${palette.border}42` : cardStyle.bgGradient[1];

  // Resolve text color
  let textColor: string;
  if (cardStyle.textUsePalette) {
    textColor = palette.lightText;
  } else if (cardStyle.textColor === "") {
    textColor = palette.border; // sky special case
  } else {
    textColor = cardStyle.textColor!;
  }

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale, scale);

  const fontSize = sig.signature ? 20 : 24;
  ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
  const textW = ctx.measureText(sig.name).width;
  const padX = 24;
  const padY = 14;
  const sigH = sig.signature ? 62 : 0;
  const boxW = Math.max(textW + padX * 2, sig.signature ? 190 : 130);
  const boxH = fontSize + padY * 2 + sigH;

  const shapeIdx = paletteIdx % 3;

  // Glow halo for new entries
  if (isNew) {
    ctx.save();
    ctx.globalAlpha = opacity * glowAlpha * 0.5;
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 36;
    ctx.fillStyle = `${palette.border}30`;
    cardPath(ctx, -boxW / 2 - 6, -boxH / 2 - 6, boxW + 12, boxH + 12, shapeIdx);
    ctx.fill();
    ctx.restore();
  }

  // Card background
  const grad = ctx.createLinearGradient(-boxW / 2, -boxH / 2, boxW / 2, boxH / 2);
  grad.addColorStop(0, bg0);
  grad.addColorStop(1, bg1);
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = isNew ? cardStyle.glowBlur : 12;
  ctx.fillStyle = grad;
  cardPath(ctx, -boxW / 2, -boxH / 2, boxW, boxH, shapeIdx);
  ctx.fill();

  // Border
  ctx.shadowBlur = 0;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = isNew ? 2.5 : 2;
  cardPath(ctx, -boxW / 2, -boxH / 2, boxW, boxH, shapeIdx);
  ctx.stroke();

  // Top accent bar (only for roundRect and chamfer shapes)
  if (shapeIdx !== 2) {
    ctx.save();
    ctx.globalAlpha = opacity * (isNew ? 1.0 : 0.6);
    const accentGrad = ctx.createLinearGradient(-boxW / 2, 0, boxW / 2, 0);
    accentGrad.addColorStop(0, "transparent");
    accentGrad.addColorStop(0.5, palette.border);
    accentGrad.addColorStop(1, "transparent");
    ctx.strokeStyle = accentGrad;
    ctx.lineWidth = isNew ? 2.5 : 2;
    ctx.beginPath();
    ctx.moveTo(-boxW / 2 + 12, -boxH / 2 + 1);
    ctx.lineTo(boxW / 2 - 12, -boxH / 2 + 1);
    ctx.stroke();
    ctx.restore();
  }

  // Name text
  ctx.shadowBlur = 0;
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(sig.name, 0, sig.signature ? -sigH / 2 : 0);

  if (sig.signature) {
    drawSignatureImage(ctx, sig.signature, 0, fontSize / 2 + padY / 2, boxW - 16, sigH - 6, cardStyle.useInvertedSignature);
  }

  ctx.restore();
}

function drawSignatureImage(
  ctx: CanvasRenderingContext2D,
  b64: string,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  invert: boolean,
): void {
  const img = _imgCache.get(b64);
  if (img && img.complete && img.naturalWidth > 0) {
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = img.naturalWidth * ratio;
    const h = img.naturalHeight * ratio;
    ctx.save();
    ctx.globalAlpha *= 0.9;
    if (invert) {
      ctx.filter = "invert(1) brightness(1.3)";
    }
    // Draw with 1-pixel offsets before center pass to thicken strokes (dilation)
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]) {
      ctx.drawImage(img, cx - w / 2 + ox, cy + oy, w, h);
    }
    ctx.drawImage(img, cx - w / 2, cy, w, h);
    ctx.restore();
  } else if (!img) {
    const el = new Image();
    el.src = b64;
    _imgCache.set(b64, el);
    // Evict oldest entry when cache exceeds 300 items
    if (_imgCache.size > 300) {
      _imgCache.delete(_imgCache.keys().next().value!);
    }
  }
}

const _imgCache = new Map<string, HTMLImageElement>();

// ─── Card shape dispatcher ────────────────────────────────────────────────────

function cardPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, shapeIdx: number): void {
  if (shapeIdx === 1) {
    chamferRect(ctx, x, y, w, h, 14);
  } else if (shapeIdx === 2) {
    ribbonRect(ctx, x, y, w, h, 10);
  } else {
    roundRect(ctx, x, y, w, h, 12);
  }
}

// Standard rounded rectangle
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Octagonal chamfered rectangle (cut corners)
function chamferRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number): void {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

// Label/ribbon shape — rounded rect with a left-side triangular point
function ribbonRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const notch = h * 0.22;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + h / 2 + notch);
  ctx.lineTo(x - notch, y + h / 2); // left point
  ctx.lineTo(x, y + h / 2 - notch);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

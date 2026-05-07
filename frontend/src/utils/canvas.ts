import { FloatingItem, CARD_PALETTES } from "./animation";
import { DisplayTheme } from "../types";

const FONT_STACK = "'Noto Sans Tamil', Latha, sans-serif";

let _cardTheme: DisplayTheme = "sky";
export function setCardTheme(theme: DisplayTheme): void {
  _cardTheme = theme;
}

export function drawItem(ctx: CanvasRenderingContext2D, item: FloatingItem): void {
  const { x, y, rotation, scale, opacity, glowAlpha, sig, paletteIdx } = item;
  const palette = CARD_PALETTES[paletteIdx];
  const isNew = glowAlpha > 0.05;
  const isSpace = _cardTheme === "space";

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
  const boxW = Math.max(textW + padX * 2, 130);
  const sigH = sig.signature ? 38 : 0;
  const boxH = fontSize + padY * 2 + sigH;

  // Glow halo for new entries
  if (isNew) {
    ctx.save();
    ctx.globalAlpha = opacity * glowAlpha * 0.5;
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 36;
    ctx.fillStyle = `${palette.border}30`;
    roundRect(ctx, -boxW / 2 - 6, -boxH / 2 - 6, boxW + 12, boxH + 12, 16);
    ctx.fill();
    ctx.restore();
  }

  // Card background
  const grad = ctx.createLinearGradient(-boxW / 2, -boxH / 2, boxW / 2, boxH / 2);
  if (isSpace) {
    grad.addColorStop(0, "rgba(10,16,40,0.92)");
    grad.addColorStop(1, "rgba(4,8,25,0.96)");
  } else {
    grad.addColorStop(0, "rgba(255,254,252,0.97)");
    grad.addColorStop(1, `${palette.border}18`);
  }
  ctx.shadowColor = isNew ? palette.shadow : (isSpace ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.18)");
  ctx.shadowBlur = isNew ? 24 : 10;
  ctx.fillStyle = grad;
  roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 12);
  ctx.fill();

  // Border
  ctx.shadowBlur = 0;
  ctx.strokeStyle = isNew ? palette.border : `${palette.border}88`;
  ctx.lineWidth = isNew ? 2 : 1.5;
  roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 12);
  ctx.stroke();

  // Top accent bar
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

  // Name text — dark on sky cards, light on space cards
  ctx.shadowBlur = 0;
  ctx.fillStyle = isSpace ? palette.lightText : palette.darkText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(sig.name, 0, sig.signature ? -sigH / 2 : 0);

  if (sig.signature) {
    drawSignatureImage(ctx, sig.signature, 0, fontSize / 2 + padY / 2, boxW - 20, sigH - 4, isSpace);
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
      // Space theme: draw sig in light color using composite trick
      ctx.filter = "invert(1) brightness(1.3)";
    }
    ctx.drawImage(img, cx - w / 2, cy, w, h);
    ctx.restore();
  } else if (!img) {
    const el = new Image();
    el.src = b64;
    _imgCache.set(b64, el);
  }
}

const _imgCache = new Map<string, HTMLImageElement>();

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

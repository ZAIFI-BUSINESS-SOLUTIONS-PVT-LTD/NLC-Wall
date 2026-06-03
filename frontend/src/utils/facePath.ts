import { DisplayTheme } from "../types";

export interface FaceGeometry {
  path: Path2D;
  cx: number;
  cy: number;
  rx: number; // half face width
  ry: number; // half face height
}

export function buildFaceGeometry(canvasW: number, canvasH: number): FaceGeometry {
  const fw = Math.min(canvasW * 0.44, 480);
  const fh = Math.min(canvasH * 0.78, 720);
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const hw = fw / 2;
  const hh = fh / 2;

  const p = new Path2D();
  p.moveTo(cx, cy - hh);

  // Right side: crown → cheekbone
  p.bezierCurveTo(
    cx + hw * 0.70, cy - hh,
    cx + hw,         cy - hh * 0.28,
    cx + hw,         cy + hh * 0.10,
  );
  // Right side: cheekbone → chin
  p.bezierCurveTo(
    cx + hw,         cy + hh * 0.55,
    cx + hw * 0.55,  cy + hh * 0.80,
    cx,              cy + hh * 0.95,
  );
  // Left side: chin → cheekbone
  p.bezierCurveTo(
    cx - hw * 0.55,  cy + hh * 0.80,
    cx - hw,         cy + hh * 0.55,
    cx - hw,         cy + hh * 0.10,
  );
  // Left side: cheekbone → crown
  p.bezierCurveTo(
    cx - hw,         cy - hh * 0.28,
    cx - hw * 0.70,  cy - hh,
    cx,              cy - hh,
  );
  p.closePath();

  return { path: p, cx, cy, rx: hw, ry: hh };
}

// Physics boundary — ellipse approximation, tighter below center (jaw taper)
export function constrainToFace(
  item: { x: number; y: number; vx: number; vy: number },
  geo: FaceGeometry,
): void {
  const margin = 52;
  const rx = geo.rx - margin;
  const ydist = item.y - geo.cy;
  const ry = (ydist > 0 ? geo.ry * 0.84 : geo.ry) - margin;

  const dx = (item.x - geo.cx) / rx;
  const dy = ydist / ry;
  const dist2 = dx * dx + dy * dy;

  if (dist2 > 1.0) {
    const dist = Math.sqrt(dist2);
    item.x = geo.cx + (dx / dist) * rx * 0.97;
    item.y = geo.cy + (dy / dist) * ry * 0.97;

    // Reflect velocity off ellipse normal
    const nx = dx / (dist * rx);
    const ny = dy / (dist * ry);
    const nlen = Math.sqrt(nx * nx + ny * ny);
    const nnx = nx / nlen;
    const nny = ny / nlen;
    const dot = item.vx * nnx + item.vy * nny;
    if (dot > 0) {
      item.vx -= 2 * dot * nnx;
      item.vy -= 2 * dot * nny;
    }
  }
}

export function drawFaceOutline(
  ctx: CanvasRenderingContext2D,
  geo: FaceGeometry,
  theme: DisplayTheme,
): void {
  const isSpace = theme === "space";
  ctx.save();
  // Outer glow pass
  ctx.shadowColor = isSpace ? "rgba(130,175,255,0.55)" : "rgba(50,90,200,0.30)";
  ctx.shadowBlur = 28;
  ctx.strokeStyle = isSpace ? "rgba(195,220,255,0.82)" : "rgba(65,115,195,0.60)";
  ctx.lineWidth = 1.8;
  ctx.stroke(geo.path);
  // Inner tight line
  ctx.shadowBlur = 5;
  ctx.strokeStyle = isSpace ? "rgba(230,240,255,0.50)" : "rgba(45,85,175,0.40)";
  ctx.lineWidth = 0.8;
  ctx.stroke(geo.path);
  ctx.restore();
}

export function drawFaceFeatures(
  ctx: CanvasRenderingContext2D,
  geo: FaceGeometry,
  theme: DisplayTheme,
): void {
  const { cx, cy, rx, ry } = geo;
  const isSpace = theme === "space";
  const strokeColor = isSpace ? "rgba(175,210,255,0.42)" : "rgba(55,105,185,0.35)";
  const glowColor   = isSpace ? "rgba(130,175,255,0.30)" : "rgba(75,125,205,0.24)";

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur  = 12;
  ctx.lineWidth   = 1.1;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";

  const eyeY  = cy - ry * 0.10;
  const eyeOX = rx * 0.30;
  const eyeW  = rx * 0.21;
  const eyeH  = ry * 0.046;

  // Almond eyes
  for (const sx of [-1, 1]) {
    const ex = cx + sx * eyeOX;
    ctx.beginPath();
    ctx.moveTo(ex - eyeW, eyeY);
    ctx.quadraticCurveTo(ex, eyeY - eyeH * 2.0, ex + eyeW, eyeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex - eyeW, eyeY);
    ctx.quadraticCurveTo(ex, eyeY + eyeH * 1.3, ex + eyeW, eyeY);
    ctx.stroke();
  }

  // Eyebrows
  const browY = eyeY - ry * 0.090;
  const browW = eyeW * 1.05;
  for (const sx of [-1, 1]) {
    const ex = cx + sx * eyeOX;
    ctx.beginPath();
    ctx.moveTo(ex - browW, browY + ry * 0.008);
    ctx.quadraticCurveTo(ex, browY - ry * 0.014, ex + browW, browY + ry * 0.006);
    ctx.stroke();
  }

  // Nose bridge + nostrils
  const noseTopY = cy + ry * 0.06;
  const noseBotY = cy + ry * 0.22;
  const noseW    = rx * 0.125;
  ctx.beginPath();
  ctx.moveTo(cx, noseTopY);
  ctx.lineTo(cx, noseBotY);
  ctx.stroke();
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, noseBotY);
    ctx.bezierCurveTo(
      cx + sx * noseW * 0.4, noseBotY + ry * 0.012,
      cx + sx * noseW,       noseBotY - ry * 0.010,
      cx + sx * noseW,       noseBotY + ry * 0.005,
    );
    ctx.stroke();
  }

  // Lips
  const lipY = cy + ry * 0.38;
  const lipW = rx * 0.28;
  const lipH = ry * 0.036;
  // Upper lip (cupid's bow)
  ctx.beginPath();
  ctx.moveTo(cx - lipW, lipY);
  ctx.bezierCurveTo(cx - lipW * 0.52, lipY - lipH, cx - lipW * 0.16, lipY - lipH * 0.4, cx, lipY - lipH * 0.25);
  ctx.bezierCurveTo(cx + lipW * 0.16, lipY - lipH * 0.4, cx + lipW * 0.52, lipY - lipH, cx + lipW, lipY);
  ctx.stroke();
  // Lower lip
  ctx.beginPath();
  ctx.moveTo(cx - lipW, lipY);
  ctx.bezierCurveTo(cx - lipW * 0.48, lipY + lipH * 1.9, cx + lipW * 0.48, lipY + lipH * 1.9, cx + lipW, lipY);
  ctx.stroke();

  ctx.restore();
}

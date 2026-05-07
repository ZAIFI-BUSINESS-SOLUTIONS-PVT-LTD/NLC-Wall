import React, { useRef, useEffect, useCallback } from "react";
import { Signature, DisplayTheme } from "../types";
import { FloatingItem, createItem, tickItems } from "../utils/animation";
import { drawItem, setCardTheme } from "../utils/canvas";

interface Props {
  signatures: Signature[];
  newSig: Signature | null;
  displayTheme: DisplayTheme;
}

interface CloudDef {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  targetAlpha: number;
}

export function FloatingWall({ signatures, newSig, displayTheme }: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef<FloatingItem[]>([]);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const bgHueRef = useRef<number>(220);
  const themeRef = useRef<DisplayTheme>(displayTheme);
  const cloudsRef = useRef<CloudDef[]>([]);

  useEffect(() => {
    themeRef.current = displayTheme;
    setCardTheme(displayTheme);
  }, [displayTheme]);

  const initClouds = useCallback((w: number, h: number) => {
    cloudsRef.current = Array.from({ length: 11 }, (_, i) => {
      const targetAlpha = 0.50 + Math.random() * 0.35;
      return {
        x: Math.random() * (w + 400) - 200,
        y: h * (0.02 + (i / 11) * 0.40),
        size: 70 + Math.random() * 180,
        speed: 3 + Math.random() * 13,
        alpha: targetAlpha,
        targetAlpha,
      };
    });
  }, []);

  // Sync items with signatures prop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const existingIds = new Set(itemsRef.current.map((i) => i.sig.id));
    for (const sig of signatures) {
      if (!existingIds.has(sig.id)) {
        const item = createItem(sig, canvas.width, canvas.height);
        item.entryProgress = 1;
        itemsRef.current.push(item);
      }
    }
  }, [signatures]);

  // New real-time signature
  useEffect(() => {
    if (!newSig) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!itemsRef.current.some((i) => i.sig.id === newSig.id)) {
      itemsRef.current.push(createItem(newSig, canvas.width, canvas.height));
    }
  }, [newSig]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initClouds(canvas.width, canvas.height);
  }, [initClouds]);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const loop = (ts: number) => {
      const dt = lastTsRef.current ? Math.min((ts - lastTsRef.current) / 1000, 0.05) : 0.016;
      lastTsRef.current = ts;
      bgHueRef.current = (bgHueRef.current + dt * 1.5) % 360;

      const W = canvas.width;
      const H = canvas.height;
      const theme = themeRef.current;

      if (theme === "sky") {
        drawSkyBg(ctx, W, H);
        for (const cloud of cloudsRef.current) {
          cloud.x += cloud.speed * dt;
          // Reset off-screen left and fade in instead of teleporting at full alpha
          if (cloud.x > W + cloud.size * 2) {
            cloud.x = -cloud.size * 2;
            cloud.alpha = 0;
          }
          if (cloud.alpha < cloud.targetAlpha) {
            cloud.alpha = Math.min(cloud.alpha + dt * 0.5, cloud.targetAlpha);
          }
          drawCloud(ctx, cloud.x, cloud.y, cloud.size, cloud.alpha);
        }
      } else {
        drawSpaceBg(ctx, W, H, bgHueRef.current);
      }

      const items = itemsRef.current;
      tickItems(items, dt, W, H, items.length);
      for (const item of items) drawItem(ctx, item);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} className="display-canvas" />;
}

// ─── Sky ────────────────────────────────────────────────────────────────────

function drawSkyBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#1565c0");
  grad.addColorStop(0.3, "#42a5f5");
  grad.addColorStop(0.65, "#90caf9");
  grad.addColorStop(1, "#e3f2fd");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  const r = size * 0.42;

  // Shadow pass — draw filled shape slightly larger with blur
  ctx.shadowColor = "rgba(100,170,230,0.38)";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "rgba(255,255,255,0.93)";

  // Build one compound path of overlapping circles = natural cloud silhouette
  ctx.beginPath();
  ctx.arc(cx,            cy + r * 0.18, r * 0.88, 0, Math.PI * 2);   // main body
  ctx.arc(cx - r * 0.80, cy + r * 0.28, r * 0.60, 0, Math.PI * 2);   // left lobe
  ctx.arc(cx + r * 0.80, cy + r * 0.28, r * 0.62, 0, Math.PI * 2);   // right lobe
  ctx.arc(cx - r * 0.40, cy - r * 0.28, r * 0.58, 0, Math.PI * 2);   // upper-left bump
  ctx.arc(cx + r * 0.38, cy - r * 0.30, r * 0.55, 0, Math.PI * 2);   // upper-right bump
  ctx.arc(cx,            cy - r * 0.65, r * 0.48, 0, Math.PI * 2);    // top peak
  ctx.fill();

  // Bright highlight on upper-left to give 3-D fluffiness
  ctx.shadowBlur = 0;
  ctx.globalAlpha = alpha * 0.45;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.22, cy - r * 0.52, r * 0.30, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Space ──────────────────────────────────────────────────────────────────

const STARS = Array.from({ length: 200 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.4 + 0.2,
  a: Math.random() * 0.5 + 0.05,
  twinkle: Math.random() * Math.PI * 2,
}));
let _starTick = 0;

function drawSpaceBg(ctx: CanvasRenderingContext2D, w: number, h: number, hue: number): void {
  ctx.fillStyle = "#04060e";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.07;
  const g1 = ctx.createRadialGradient(w * 0.2, h * 0.3, 0, w * 0.2, h * 0.3, w * 0.55);
  g1.addColorStop(0, `hsl(${hue}, 80%, 45%)`);
  g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  const g2 = ctx.createRadialGradient(w * 0.8, h * 0.7, 0, w * 0.8, h * 0.7, w * 0.5);
  g2.addColorStop(0, `hsl(${(hue + 60) % 360}, 80%, 45%)`);
  g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  _starTick += 0.02;
  ctx.save();
  for (const s of STARS) {
    const a = s.a * (0.7 + 0.3 * Math.sin(s.twinkle + _starTick));
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fill();
  }
  ctx.restore();
}

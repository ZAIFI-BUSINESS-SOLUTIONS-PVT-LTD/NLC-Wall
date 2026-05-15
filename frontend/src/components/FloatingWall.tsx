import React, { useRef, useEffect, useCallback } from "react";
import { Signature, DisplayTheme } from "../types";
import { FloatingItem, createItem, tickItems } from "../utils/animation";
import { drawItem, setCardTheme } from "../utils/canvas";

interface Props {
  signatures: Signature[];
  newSig: Signature | null;
  displayTheme: DisplayTheme;
}

export function FloatingWall({ signatures, newSig, displayTheme }: Props): React.ReactElement {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const itemsRef   = useRef<FloatingItem[]>([]);
  const rafRef     = useRef<number>(0);
  const lastTsRef  = useRef<number>(0);
  const bgHueRef   = useRef<number>(220);
  const themeRef   = useRef<DisplayTheme>(displayTheme);
  useEffect(() => {
    themeRef.current = displayTheme;
    setCardTheme(displayTheme);
  }, [displayTheme]);

  // Sync items with signatures prop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const existingIds = new Set(itemsRef.current.map((i) => i.sig.id));
    for (const sig of signatures) {
      if (!existingIds.has(sig.id)) {
        const item = createItem(sig, canvas.width, canvas.height);
        item.entryProgress = 1;
        // Snap to float target immediately — skips the entry fly-in for sigs
        // already on the server when the display client loads. Without this,
        // existing sigs would briefly appear at the bottom-center entry zone.
        item.x = item.targetX;
        item.y = item.targetY;
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
      itemsRef.current.push(
        createItem(newSig, canvas.width, canvas.height),
      );
    }
  }, [newSig]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }, []);

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

      const W     = canvas.width;
      const H     = canvas.height;
      const theme = themeRef.current;

      // ── Background ─────────────────────────────────────────────────────────
      if (theme === "sky") {
        drawSkyBg(ctx, W, H);
      } else {
        drawSpaceBg(ctx, W, H, bgHueRef.current);
      }

      // ── Physics ────────────────────────────────────────────────────────────
      const items = itemsRef.current;
      tickItems(items, dt, W, H, items.length);

      // ── Signatures free-floating across full canvas ─────────────────────────
      for (const item of items) drawItem(ctx, item);


      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} className="display-canvas" />;
}

// ─── Sky background ──────────────────────────────────────────────────────────

// Cache the gradient at module level — re-created only on canvas resize.
// Without caching this runs ctx.createLinearGradient 60× per second = ~18k
// gradient object allocations per minute, all immediately GC'd.
let _skyGrad: CanvasGradient | null = null;
let _skyGradH = 0;

function drawSkyBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!_skyGrad || _skyGradH !== h) {
    _skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    _skyGrad.addColorStop(0,    "#0a1628");
    _skyGrad.addColorStop(0.45, "#0d2040");
    _skyGrad.addColorStop(1,    "#071018");
    _skyGradH = h;
  }
  ctx.fillStyle = _skyGrad;
  ctx.fillRect(0, 0, w, h);
}

// ─── Space background ────────────────────────────────────────────────────────

const STARS = Array.from({ length: 200 }, () => ({
  x:       Math.random(),
  y:       Math.random(),
  r:       Math.random() * 1.4 + 0.2,
  a:       Math.random() * 0.5 + 0.05,
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

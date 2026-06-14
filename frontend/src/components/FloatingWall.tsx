import React, { useRef, useEffect, useCallback } from "react";
import { Signature, DisplayTheme } from "../types";
import { FloatingItem, createItem, tickItems } from "../utils/animation";
import { drawItem, setCardTheme } from "../utils/canvas";
import { THEME_CONFIGS, Particle } from "../utils/themes";

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
  const particlesRef = useRef<Particle[]>([]);
  const tickRef = useRef<number>(0);

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

  // Sync theme ref and reinit particles when theme changes
  useEffect(() => {
    themeRef.current = displayTheme;
    setCardTheme(displayTheme);
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (displayTheme === "sky") {
      initClouds(canvas.width, canvas.height);
    } else {
      cloudsRef.current = [];
    }
    particlesRef.current = THEME_CONFIGS[displayTheme].initParticles(canvas.width, canvas.height);
  }, [displayTheme, initClouds]);

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
    if (themeRef.current === "sky") {
      initClouds(canvas.width, canvas.height);
    }
    particlesRef.current = THEME_CONFIGS[themeRef.current].initParticles(canvas.width, canvas.height);
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
      tickRef.current += dt;

      const W = canvas.width;
      const H = canvas.height;
      const theme = themeRef.current;
      const tick = tickRef.current;

      // Draw background
      drawThemeBg(ctx, W, H, theme, bgHueRef.current, tick);

      // Draw sky clouds inline (special case)
      if (theme === "sky") {
        for (const cloud of cloudsRef.current) {
          cloud.x += cloud.speed * dt;
          if (cloud.x > W + cloud.size * 2) {
            cloud.x = -cloud.size * 2;
            cloud.alpha = 0;
          }
          if (cloud.alpha < cloud.targetAlpha) {
            cloud.alpha = Math.min(cloud.alpha + dt * 0.5, cloud.targetAlpha);
          }
          drawCloud(ctx, cloud.x, cloud.y, cloud.size, cloud.alpha);
        }
      }

      // Update and draw particles
      updateAndDrawParticles(ctx, particlesRef.current, dt, W, H, theme, tick);

      // Evict oldest items beyond cap so canvas stays performant at high throughput
      const CANVAS_CAP = 32;
      if (itemsRef.current.length > CANVAS_CAP) {
        itemsRef.current.splice(0, itemsRef.current.length - CANVAS_CAP);
      }

      // Draw floating cards
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

// ─── Background dispatch ─────────────────────────────────────────────────────

function drawThemeBg(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  theme: DisplayTheme,
  hue: number,
  tick: number,
): void {
  switch (theme) {
    case "sky":
      drawSkyBg(ctx, W, H);
      break;
    case "space":
      drawSpaceBg(ctx, W, H, hue);
      break;
    case "aurora":
      drawAuroraBg(ctx, W, H, tick);
      break;
    case "ocean":
      drawOceanBg(ctx, W, H, tick);
      break;
    case "neon":
      drawNeonBg(ctx, W, H);
      break;
    case "forest":
      drawForestBg(ctx, W, H);
      break;
    case "sunset":
      drawSunsetBg(ctx, W, H, tick);
      break;
  }
}

// ─── Sky ─────────────────────────────────────────────────────────────────────

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

  ctx.shadowColor = "rgba(100,170,230,0.38)";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "rgba(255,255,255,0.93)";

  ctx.beginPath();
  ctx.arc(cx,            cy + r * 0.18, r * 0.88, 0, Math.PI * 2); // main body
  ctx.arc(cx - r * 0.80, cy + r * 0.28, r * 0.60, 0, Math.PI * 2); // left lobe
  ctx.arc(cx + r * 0.80, cy + r * 0.28, r * 0.62, 0, Math.PI * 2); // right lobe
  ctx.arc(cx - r * 0.40, cy - r * 0.28, r * 0.58, 0, Math.PI * 2); // upper-left bump
  ctx.arc(cx + r * 0.38, cy - r * 0.30, r * 0.55, 0, Math.PI * 2); // upper-right bump
  ctx.arc(cx,            cy - r * 0.65, r * 0.48, 0, Math.PI * 2); // top peak
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = alpha * 0.45;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.22, cy - r * 0.52, r * 0.30, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Space ────────────────────────────────────────────────────────────────────

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

// ─── Aurora ───────────────────────────────────────────────────────────────────

function drawAuroraBg(ctx: CanvasRenderingContext2D, w: number, h: number, tick: number): void {
  ctx.fillStyle = "#010d12";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 4; i++) {
    const centerY = h * (0.25 + i * 0.15);
    const phase = tick * 0.8 + i * 1.2;
    const amplitude = h * 0.06;
    const bandH = 80;
    const hue = (160 + i * 40 + tick * 20) % 360;

    const grad = ctx.createLinearGradient(0, centerY - bandH, 0, centerY + bandH);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, `hsla(${hue}, 80%, 55%, 0.15)`);
    grad.addColorStop(1, "transparent");

    // Draw wavy band using horizontal strips
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, centerY - bandH);
    for (let x = 0; x <= w; x += 8) {
      const yOff = Math.sin(x * 0.01 + phase) * amplitude;
      ctx.lineTo(x, centerY - bandH + yOff);
    }
    for (let x = w; x >= 0; x -= 8) {
      const yOff = Math.sin(x * 0.01 + phase) * amplitude;
      ctx.lineTo(x, centerY + bandH + yOff);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// ─── Ocean ────────────────────────────────────────────────────────────────────

function drawOceanBg(ctx: CanvasRenderingContext2D, w: number, h: number, tick: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#000d1a");
  grad.addColorStop(0.5, "#00204a");
  grad.addColorStop(1, "#003366");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#00aaff";
  for (let i = 0; i < 10; i++) {
    // Seeded pseudo-random positions via index
    const cx = ((i * 137 + 50) % w);
    const cy = ((i * 211 + 80) % h);
    const scaleP = 0.8 + 0.2 * Math.sin(tick * 0.5 + i);
    const rx = (40 + (i * 53) % 60) * scaleP;
    const ry = (20 + (i * 37) % 30) * scaleP;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, (i * 0.5) % Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Neon ─────────────────────────────────────────────────────────────────────

function drawNeonBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = "rgba(0,255,180,0.06)";
  ctx.lineWidth = 1;

  // Perspective grid — 12 lines from bottom-left/right converging to vanishing point
  const vx = w / 2;
  const vy = h * 0.1;
  const segments = 12;
  for (let i = 0; i <= segments; i++) {
    const bx = (w / segments) * i;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(bx, h);
    ctx.stroke();
  }

  // 3 vertical lines
  for (let i = 1; i <= 3; i++) {
    const x = (w / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Forest ───────────────────────────────────────────────────────────────────

function drawForestBg(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#020d04");
  grad.addColorStop(0.5, "#0a1f0a");
  grad.addColorStop(1, "#041208");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Ground fog
  const fogGrad = ctx.createLinearGradient(0, h * 0.8, 0, h);
  fogGrad.addColorStop(0, "rgba(150,200,150,0.07)");
  fogGrad.addColorStop(1, "transparent");
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, h * 0.8, w, h * 0.2);
}

// ─── Sunset ───────────────────────────────────────────────────────────────────

function drawSunsetBg(ctx: CanvasRenderingContext2D, w: number, h: number, tick: number): void {
  const s = Math.sin(tick * 0.3);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0a0015");
  grad.addColorStop(0.35, `hsl(${330 + s * 5}, 60%, 35%)`);
  grad.addColorStop(0.65, `hsl(${18 + s * 3}, 70%, 45%)`);
  grad.addColorStop(1, "#f5a623");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ─── Particle update + draw ───────────────────────────────────────────────────

function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  dt: number,
  W: number,
  H: number,
  theme: DisplayTheme,
  tick: number,
): void {
  if (particles.length === 0) return;

  switch (theme) {
    case "aurora":
      updateAuroraParticles(ctx, particles, dt, W, H);
      break;
    case "ocean":
      updateOceanParticles(ctx, particles, dt, W, H);
      break;
    case "neon":
      updateNeonParticles(ctx, particles, dt, W, H, tick);
      break;
    case "forest":
      updateForestParticles(ctx, particles, dt, W, H);
      break;
    case "sunset":
      updateSunsetParticles(ctx, particles, dt, W, H);
      break;
    default:
      break;
  }
}

function updateAuroraParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  dt: number,
  W: number,
  H: number,
): void {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // Wrap around edges
    if (p.x < 0) p.x = W;
    if (p.x > W) p.x = 0;
    if (p.y < 0) p.y = H;
    if (p.y > H) p.y = 0;
    p.phase += dt * 1.5;

    const a = p.alpha * (0.5 + 0.5 * Math.sin(p.phase));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function updateOceanParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  dt: number,
  W: number,
  H: number,
): void {
  for (const p of particles) {
    p.y += p.vy * dt;
    p.x += p.vx * dt + Math.sin(p.phase) * 15 * dt;
    p.phase += dt * 2;
    // Reset when bubble exits top
    if (p.y < -p.r * 2) {
      p.y = H + p.r;
      p.x = Math.random() * W;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function updateNeonParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  dt: number,
  W: number,
  _H: number,
  tick: number,
): void {
  for (const p of particles) {
    p.phase += dt * (3 + Math.random() * 2);
    if (p.phase > Math.PI * 2) {
      p.phase = 0;
      p.y = Math.random() * _H;
      p.x = Math.random() * W;
    }

    const a = Math.max(0, Math.sin(p.phase * 7 + tick)) * 0.4;
    if (a <= 0) continue;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 40 + p.phase * 80, 1);
    ctx.restore();
  }
}

function updateForestParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  dt: number,
  W: number,
  H: number,
): void {
  // First 35 = leaves, last 18 = fireflies
  for (let idx = 0; idx < particles.length; idx++) {
    const p = particles[idx];
    if (idx < 35) {
      // Leaf
      p.y += p.vy * dt;
      p.x += p.vx * dt + Math.sin(p.phase) * 20 * dt;
      p.phase += dt;
      if (p.rotation !== undefined && p.rotSpeed !== undefined) {
        p.rotation += p.rotSpeed * dt * 60;
      }
      if (p.y > H + 10) {
        p.y = -10;
        p.x = Math.random() * W;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation ?? 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Firefly
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Bounce off edges
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      p.phase += dt * (0.5 + Math.random() * 0.3);
      const a = Math.max(0, Math.sin(p.phase)) * 0.8;
      if (a <= 0) continue;

      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function updateSunsetParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  dt: number,
  W: number,
  H: number,
): void {
  for (const p of particles) {
    p.y += p.vy * dt; // rising (vy is negative)
    p.x += p.vx * dt + Math.sin(p.phase) * 10 * dt;
    p.phase += dt * 2;
    const a = 0.3 + 0.7 * Math.abs(Math.sin(p.phase * 3));
    if (p.y < -5) {
      p.y = H + 5;
      p.x = Math.random() * W;
    }

    ctx.save();
    ctx.globalAlpha = a * p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

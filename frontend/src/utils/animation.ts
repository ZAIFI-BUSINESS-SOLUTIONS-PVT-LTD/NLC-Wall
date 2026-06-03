import { Signature } from "../types";

export const CARD_PALETTES = [
  { border: "#e63946", darkText: "#1a0005", lightText: "#ffe4e6", glow: "#ff4d5a", shadow: "rgba(230,57,70,0.55)" },
  { border: "#e07b00", darkText: "#1a0c00", lightText: "#fff0d8", glow: "#ff9a2d", shadow: "rgba(224,123,0,0.55)" },
  { border: "#2cb85c", darkText: "#001a0d", lightText: "#d0ffe0", glow: "#3ddf70", shadow: "rgba(44,184,92,0.5)" },
  { border: "#c8960a", darkText: "#1a1200", lightText: "#fff4c0", glow: "#f0b412", shadow: "rgba(200,150,10,0.55)" },
  { border: "#8b32cc", darkText: "#12001a", lightText: "#f0d8ff", glow: "#bb55ff", shadow: "rgba(139,50,204,0.5)" },
  { border: "#e03a8a", darkText: "#1a0010", lightText: "#ffe0f2", glow: "#ff5cb0", shadow: "rgba(224,58,138,0.5)" },
  { border: "#009688", darkText: "#001614", lightText: "#ccfff8", glow: "#00bda8", shadow: "rgba(0,150,136,0.5)" },
  { border: "#f05a28", darkText: "#1a0800", lightText: "#fff0e8", glow: "#ff7a50", shadow: "rgba(240,90,40,0.55)" },
];

function paletteForId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % CARD_PALETTES.length;
}

export interface FloatingItem {
  sig: Signature;
  paletteIdx: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  opacity: number;
  glowAlpha: number;
  entryProgress: number;
  age: number;
  sineOffset: number;
}

const FLOAT_SPEED_MIN = 0.12;
const FLOAT_SPEED_MAX = 0.38;
const ENTRY_DURATION = 0.7;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createItem(sig: Signature, canvasW: number, canvasH: number): FloatingItem {
  const angle = rand(0, Math.PI * 2);
  const speed = rand(FLOAT_SPEED_MIN, FLOAT_SPEED_MAX);
  return {
    sig,
    paletteIdx: paletteForId(sig.id),
    x: rand(100, canvasW - 100),
    y: rand(100, canvasH - 100),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rotation: rand(-6, 6),
    rotationSpeed: rand(-0.035, 0.035),
    scale: 1.8,
    opacity: 1,
    glowAlpha: 1,
    entryProgress: 0,
    age: 0,
    sineOffset: rand(0, Math.PI * 2),
  };
}

export function tickItems(
  items: FloatingItem[],
  dt: number,
  canvasW: number,
  canvasH: number,
  totalCount: number,
): void {
  items.forEach((item, idx) => {
    item.age += dt;

    if (item.entryProgress < 1) {
      item.entryProgress = Math.min(1, item.entryProgress + dt / ENTRY_DURATION);
    }

    // reverseRank: 0 = newest item, grows as item gets older
    const reverseRank = totalCount - 1 - idx;

    // Glow only for the newest item
    item.glowAlpha = reverseRank === 0 ? 1.0 : 0;

    const sineX = Math.sin(item.age * 0.35 + item.sineOffset) * 0.28;
    item.x += (item.vx + sineX) * dt * 60;
    item.y += item.vy * dt * 60;

    const pad = 70;
    if (item.x < pad && item.vx < 0) item.vx *= -1;
    if (item.x > canvasW - pad && item.vx > 0) item.vx *= -1;
    if (item.y < pad && item.vy < 0) item.vy *= -1;
    if (item.y > canvasH - pad && item.vy > 0) item.vy *= -1;

    item.rotation += item.rotationSpeed;
    // Bounce rotation back within ±20° so names never appear upside-down
    if (item.rotation > 20) { item.rotation = 20; item.rotationSpeed = -Math.abs(item.rotationSpeed); }
    if (item.rotation < -20) { item.rotation = -20; item.rotationSpeed = Math.abs(item.rotationSpeed); }

    // Newest 10 float at the same full size.
    // Once count exceeds 10, oldest starts shrinking (receding into distance).
    // Fade zone spans 22 more slots (rank 10 → 32) to stay smooth at high throughput.
    const FRONT_COUNT = 10;
    let opacity: number;
    let targetScale: number;

    if (reverseRank < FRONT_COUNT) {
      opacity = 1.0;
      targetScale = 1.35;
    } else {
      const t = Math.min(1, (reverseRank - FRONT_COUNT) / 22);
      opacity = lerp(0.92, 0.12, t);
      targetScale = lerp(1.18, 0.50, t);
    }

    item.opacity = opacity;

    if (item.entryProgress < 1) {
      item.scale = lerp(1.8, targetScale, easeOut(item.entryProgress));
    } else {
      // Smooth scale transition when displaced by a new arrival
      item.scale += (targetScale - item.scale) * Math.min(1, dt * 2.5);
    }
  });

  separateItems(items);
}

function separateItems(items: FloatingItem[]): void {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const overlapX = estimateHalfW(a) + estimateHalfW(b) - Math.abs(dx);
      const overlapY = estimateHalfH(a) + estimateHalfH(b) - Math.abs(dy);
      if (overlapX > 0 && overlapY > 0) {
        const push = 0.25;
        if (overlapX < overlapY) {
          const d = overlapX * push * (dx >= 0 ? 1 : -1);
          a.x -= d;
          b.x += d;
        } else {
          const d = overlapY * push * (dy >= 0 ? 1 : -1);
          a.y -= d;
          b.y += d;
        }
      }
    }
  }
}

function estimateHalfW(item: FloatingItem): number {
  return (Math.max(item.sig.name.length * 16, 120) / 2 + 36) * item.scale;
}

function estimateHalfH(item: FloatingItem): number {
  return ((item.sig.signature ? 84 : 52) / 2 + 14) * item.scale;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

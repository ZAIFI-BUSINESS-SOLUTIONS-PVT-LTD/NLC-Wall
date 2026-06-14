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

// Bottom strip reserved for Chief Guest cards (horizontal row, up to 5 cards).
// 5 cards × 130px + 4 gaps × 8px + 24px left margin ≈ 710px wide, 100px tall.
// Keep this as a bottom-left zone cards bounce off.
const CG_ZONE_W = 730;   // px from left edge (covers 5 cards)
const CG_ZONE_H = 120;   // px from bottom edge

// Left-center strip reserved for the pledge panel (left: 16px, width ~300px, vertically centered).
// Approximated as a fixed px-wide band; cards bounce off its right edge.
const PLEDGE_ZONE_W = 460; // px from left edge (420px panel + 16px margin + 24px buffer)

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createItem(sig: Signature, canvasW: number, canvasH: number): FloatingItem {
  const angle = rand(0, Math.PI * 2);
  const speed = rand(FLOAT_SPEED_MIN, FLOAT_SPEED_MAX);
  // Avoid spawning inside the bottom-left CG zone or the left-center pledge zone
  let x = rand(180, canvasW - 180);
  let y = rand(120, canvasH - 120);
  for (let i = 0; i < 16; i++) {
    const inCgZone = x < CG_ZONE_W && y > canvasH - CG_ZONE_H;
    const inPledgeZone = x < PLEDGE_ZONE_W && y > canvasH * 0.14 && y < canvasH * 0.86;
    if (!inCgZone && !inPledgeZone) break;
    x = rand(180, canvasW - 180);
    y = rand(120, canvasH - 120);
  }
  return {
    sig,
    paletteIdx: paletteForId(sig.id),
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rotation: rand(-8, 8),
    rotationSpeed: rand(-2.2, 2.2),
    scale: 1.3,
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

    const halfW = estimateHalfW(item);
    const halfH = estimateHalfH(item);
    if (item.x < halfW && item.vx < 0) item.vx *= -1;
    if (item.x > canvasW - halfW && item.vx > 0) item.vx *= -1;
    if (item.y < halfH && item.vy < 0) item.vy *= -1;
    if (item.y > canvasH - halfH && item.vy > 0) item.vy *= -1;
    item.x = Math.max(halfW, Math.min(canvasW - halfW, item.x));
    item.y = Math.max(halfH, Math.min(canvasH - halfH, item.y));

    // Bounce off the bottom-left Chief Guest panel zone
    if (item.x - halfW < CG_ZONE_W && item.y + halfH > canvasH - CG_ZONE_H) {
      const penetrateRight = CG_ZONE_W - (item.x - halfW);
      const penetrateTop = (item.y + halfH) - (canvasH - CG_ZONE_H);
      if (penetrateRight < penetrateTop) {
        if (item.vx < 0) item.vx *= -1;
        item.x = Math.max(item.x, CG_ZONE_W + halfW);
      } else {
        if (item.vy > 0) item.vy *= -1;
        item.y = Math.min(item.y, canvasH - CG_ZONE_H - halfH);
      }
    }

    // Bounce off the left-center pledge panel zone (vertically centered, ~15%–85% of height)
    const pledgeTop = canvasH * 0.14;
    const pledgeBottom = canvasH * 0.86;
    if (
      item.x - halfW < PLEDGE_ZONE_W &&
      item.y + halfH > pledgeTop &&
      item.y - halfH < pledgeBottom
    ) {
      if (item.vx < 0) item.vx *= -1;
      item.x = Math.max(item.x, PLEDGE_ZONE_W + halfW);
    }

    item.rotation += item.rotationSpeed * dt;
    // Hard-clamp to ±60° — cards must never appear upside-down
    if (item.rotation > 60) { item.rotation = 60; item.rotationSpeed = -Math.abs(item.rotationSpeed); }
    if (item.rotation < -60) { item.rotation = -60; item.rotationSpeed = Math.abs(item.rotationSpeed); }

    // Newest 10 float at the same full size.
    // Once count exceeds 10, oldest starts shrinking (receding into distance).
    // Fade zone spans 22 more slots (rank 10 → 32) to stay smooth at high throughput.
    const FRONT_COUNT = 10;
    let opacity: number;
    let targetScale: number;

    if (reverseRank < FRONT_COUNT) {
      opacity = 1.0;
      targetScale = 1.0;
    } else {
      const t = Math.min(1, (reverseRank - FRONT_COUNT) / 22);
      opacity = lerp(0.92, 0.12, t);
      targetScale = lerp(0.90, 0.38, t);
    }

    item.opacity = opacity;

    if (item.entryProgress < 1) {
      item.scale = lerp(1.3, targetScale, easeOut(item.entryProgress));
    } else {
      // Smooth scale transition when displaced by a new arrival
      item.scale += (targetScale - item.scale) * Math.min(1, dt * 2.5);
    }
  });

  separateItems(items);

  // Re-clamp after separation in case push forces crossed a border
  items.forEach(item => {
    const halfW = estimateHalfW(item);
    const halfH = estimateHalfH(item);
    item.x = Math.max(halfW, Math.min(canvasW - halfW, item.x));
    item.y = Math.max(halfH, Math.min(canvasH - halfH, item.y));
  });
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
  // Tamil glyphs render wider; 28px/char + box padding, capped at canvas MAX_TEXT_W (560px) + 48px padding
  const minBoxW = item.sig.signature ? 220 : 160;
  const estBoxW = Math.min(Math.max(item.sig.name.length * 28 + 48, minBoxW), 608);
  return (estBoxW / 2 + 24) * item.scale; // +24 extra for glow/shadow
}

function estimateHalfH(item: FloatingItem): number {
  const boxH = item.sig.signature ? 78 : 42; // fontSize+padY*2+sigH: (16+20+48) or (18+20)
  return (boxH / 2 + 18) * item.scale;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

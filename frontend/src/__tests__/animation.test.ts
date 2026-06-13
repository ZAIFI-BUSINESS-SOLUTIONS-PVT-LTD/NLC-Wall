import { describe, it, expect } from "vitest";
import { createItem, tickItems, CARD_PALETTES, FloatingItem } from "../utils/animation";
import { Signature } from "../types";

const W = 1920;
const H = 1080;

function makeSig(id: string, overrides: Partial<Signature> = {}): Signature {
  return {
    id,
    name: overrides.name ?? "Tester",
    signature: overrides.signature ?? null,
    timestamp: overrides.timestamp ?? 1,
    is_chief_guest: overrides.is_chief_guest ?? false,
  };
}

function makeItems(n: number): FloatingItem[] {
  return Array.from({ length: n }, (_, i) => createItem(makeSig(`id-${i}`), W, H));
}

describe("CARD_PALETTES", () => {
  it("has 8 palette entries", () => {
    expect(CARD_PALETTES).toHaveLength(8);
  });

  it("each entry exposes the colours the renderer needs", () => {
    for (const p of CARD_PALETTES) {
      expect(p).toEqual(
        expect.objectContaining({
          border: expect.any(String),
          darkText: expect.any(String),
          lightText: expect.any(String),
          glow: expect.any(String),
          shadow: expect.any(String),
        }),
      );
    }
  });
});

describe("createItem", () => {
  it("assigns a palette index within range", () => {
    const item = createItem(makeSig("abc"), W, H);
    expect(item.paletteIdx).toBeGreaterThanOrEqual(0);
    expect(item.paletteIdx).toBeLessThan(CARD_PALETTES.length);
  });

  it("derives the palette deterministically from the signature id", () => {
    const a = createItem(makeSig("same-id"), W, H);
    const b = createItem(makeSig("same-id"), W, H);
    expect(a.paletteIdx).toBe(b.paletteIdx);
  });

  it("spawns inside the canvas with the documented margins", () => {
    for (let i = 0; i < 50; i++) {
      const item = createItem(makeSig(`id${i}`), W, H);
      expect(item.x).toBeGreaterThanOrEqual(180);
      expect(item.x).toBeLessThanOrEqual(W - 180);
      expect(item.y).toBeGreaterThanOrEqual(120);
      expect(item.y).toBeLessThanOrEqual(H - 120);
    }
  });

  it("starts large, fully opaque and glowing for the entry animation", () => {
    const item = createItem(makeSig("abc"), W, H);
    expect(item.scale).toBeCloseTo(1.3);
    expect(item.opacity).toBe(1);
    expect(item.glowAlpha).toBe(1);
    expect(item.entryProgress).toBe(0);
  });

  it("gives a bounded initial velocity and rotation", () => {
    const item = createItem(makeSig("abc"), W, H);
    const speed = Math.hypot(item.vx, item.vy);
    expect(speed).toBeGreaterThanOrEqual(0.12 - 1e-9);
    expect(speed).toBeLessThanOrEqual(0.38 + 1e-9);
    expect(Math.abs(item.rotation)).toBeLessThanOrEqual(8);
  });
});

describe("tickItems – glow", () => {
  it("only the newest (last) item glows", () => {
    const items = makeItems(12);
    tickItems(items, 0.016, W, H, items.length);
    expect(items[items.length - 1].glowAlpha).toBe(1.0);
    for (let i = 0; i < items.length - 1; i++) {
      expect(items[i].glowAlpha).toBe(0);
    }
  });
});

describe("tickItems – depth recession", () => {
  it("keeps the newest 10 fully opaque and fades older ones", () => {
    const items = makeItems(12);
    tickItems(items, 0.016, W, H, items.length);
    // idx 11..2 are within the front-10 window -> opacity 1.0
    expect(items[items.length - 1].opacity).toBe(1.0);
    // idx 0 and 1 are older than the front window -> faded
    expect(items[0].opacity).toBeLessThan(1.0);
    expect(items[0].opacity).toBeGreaterThan(0);
  });
});

describe("tickItems – wall containment", () => {
  it("clamps an item that has drifted past the right/bottom edges back inside", () => {
    const items = makeItems(1);
    const it = items[0];
    it.x = W + 500;
    it.y = H + 500;
    it.vx = 5;
    it.vy = 5;
    tickItems(items, 0.016, W, H, 1);
    expect(it.x).toBeLessThanOrEqual(W);
    expect(it.y).toBeLessThanOrEqual(H);
  });

  it("clamps an item that has drifted past the left/top edges back inside", () => {
    const items = makeItems(1);
    const it = items[0];
    it.x = -500;
    it.y = -500;
    it.vx = -5;
    it.vy = -5;
    tickItems(items, 0.016, W, H, 1);
    expect(it.x).toBeGreaterThanOrEqual(0);
    expect(it.y).toBeGreaterThanOrEqual(0);
  });
});

describe("tickItems – rotation clamp", () => {
  it("never lets a card exceed +60° and reverses its spin", () => {
    const items = makeItems(1);
    const it = items[0];
    it.rotation = 100;
    it.rotationSpeed = 5;
    tickItems(items, 0.016, W, H, 1);
    expect(it.rotation).toBeLessThanOrEqual(60);
    expect(it.rotationSpeed).toBeLessThan(0);
  });

  it("never lets a card go below -60° and reverses its spin", () => {
    const items = makeItems(1);
    const it = items[0];
    it.rotation = -100;
    it.rotationSpeed = -5;
    tickItems(items, 0.016, W, H, 1);
    expect(it.rotation).toBeGreaterThanOrEqual(-60);
    expect(it.rotationSpeed).toBeGreaterThan(0);
  });
});

describe("tickItems – separation", () => {
  it("pushes two overlapping cards apart", () => {
    const items = makeItems(2);
    const [a, b] = items;
    // Park both at the exact same centre with no drift of their own.
    a.x = b.x = W / 2;
    a.y = b.y = H / 2;
    a.vx = a.vy = b.vx = b.vy = 0;
    a.rotationSpeed = b.rotationSpeed = 0;
    tickItems(items, 0.016, W, H, 2);
    const separated = a.x !== b.x || a.y !== b.y;
    expect(separated).toBe(true);
  });
});

describe("tickItems – ageing", () => {
  it("advances age and entry progress over time", () => {
    const items = makeItems(1);
    const it = items[0];
    expect(it.age).toBe(0);
    tickItems(items, 0.1, W, H, 1);
    expect(it.age).toBeGreaterThan(0);
    expect(it.entryProgress).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import { THEME_CONFIGS } from "../utils/themes";
import { DisplayTheme } from "../types";

const ALL_THEMES: DisplayTheme[] = [
  "sky",
  "space",
  "aurora",
  "ocean",
  "neon",
  "forest",
  "sunset",
];

const VALID_ENTRY = new Set(["float", "bubble", "flutter", "flicker"]);

describe("THEME_CONFIGS", () => {
  it("defines all seven themes", () => {
    expect(Object.keys(THEME_CONFIGS).sort()).toEqual([...ALL_THEMES].sort());
  });

  it.each(ALL_THEMES)("'%s' has a well-formed config", (theme) => {
    const cfg = THEME_CONFIGS[theme];
    expect(cfg.cardStyle).toBeDefined();
    expect(VALID_ENTRY.has(cfg.entryAnimation)).toBe(true);
    expect(cfg.entryDuration).toBeGreaterThan(0);
    expect(typeof cfg.initParticles).toBe("function");
    expect(cfg.cardStyle.bgGradient).toHaveLength(2);
  });

  it("sky and space delegate their particles (clouds/stars handled elsewhere)", () => {
    expect(THEME_CONFIGS.sky.initParticles(1920, 1080)).toEqual([]);
    expect(THEME_CONFIGS.space.initParticles(1920, 1080)).toEqual([]);
  });

  it.each([
    ["aurora", 70],
    ["ocean", 50],
    ["neon", 30],
    ["forest", 53], // 35 leaves + 18 fireflies
    ["sunset", 35],
  ] as [DisplayTheme, number][])(
    "'%s' seeds %d particles",
    (theme, count) => {
      expect(THEME_CONFIGS[theme].initParticles(1920, 1080)).toHaveLength(count);
    },
  );

  it("themes with explicit palettes expose 8 colours", () => {
    for (const theme of ["aurora", "ocean", "neon", "forest", "sunset"] as DisplayTheme[]) {
      expect(THEME_CONFIGS[theme].palette).toHaveLength(8);
    }
  });

  it("sky and space fall back to the default palette (null)", () => {
    expect(THEME_CONFIGS.sky.palette).toBeNull();
    expect(THEME_CONFIGS.space.palette).toBeNull();
  });

  it("generated particles carry the fields the renderer reads", () => {
    const particles = THEME_CONFIGS.aurora.initParticles(800, 600);
    for (const p of particles.slice(0, 5)) {
      expect(p).toEqual(
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          vx: expect.any(Number),
          vy: expect.any(Number),
          r: expect.any(Number),
          alpha: expect.any(Number),
          color: expect.any(String),
        }),
      );
    }
  });
});

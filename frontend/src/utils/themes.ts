import { DisplayTheme } from "../types";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  phase: number;
  color: string;
  rotation?: number;
  rotSpeed?: number;
}

export interface CardStyle {
  bgGradient: [string, string];
  borderUsePalette: boolean; // true = use palette.border, false = use cardBorderColor
  cardBorderColor?: string;
  textUsePalette: boolean; // true = use palette.lightText, false = use textColor
  textColor?: string;
  glowBlur: number;
  useInvertedSignature: boolean;
}

export interface ThemeConfig {
  palette: string[] | null; // 8 colors override, null = use default CARD_PALETTES
  cardStyle: CardStyle;
  entryAnimation: "float" | "bubble" | "flutter" | "flicker";
  entryDuration: number; // seconds
  initParticles: (width: number, height: number) => Particle[];
}

export const THEME_CONFIGS: Record<DisplayTheme, ThemeConfig> = {
  sky: {
    palette: null,
    cardStyle: {
      bgGradient: ["rgba(255,255,255,0.97)", ""], // special: uses palette.border for stop 1
      borderUsePalette: true,
      textUsePalette: false,
      textColor: "", // special: uses palette.border
      glowBlur: 24,
      useInvertedSignature: false,
    },
    entryAnimation: "float",
    entryDuration: 0.7,
    initParticles: () => [], // clouds handled separately in FloatingWall
  },
  space: {
    palette: null,
    cardStyle: {
      bgGradient: ["rgba(10,16,40,0.92)", "rgba(4,8,25,0.96)"],
      borderUsePalette: true,
      textUsePalette: true,
      glowBlur: 24,
      useInvertedSignature: true,
    },
    entryAnimation: "float",
    entryDuration: 0.7,
    initParticles: () => [], // stars handled separately
  },
  aurora: {
    palette: ["#00e5cc", "#aa55ff", "#00bfff", "#dd44aa", "#55ffaa", "#ff77cc", "#33ddff", "#ff55ee"],
    cardStyle: {
      bgGradient: ["rgba(10,30,40,0.82)", "rgba(5,10,30,0.92)"],
      borderUsePalette: true,
      textUsePalette: false,
      textColor: "#ffffff",
      glowBlur: 28,
      useInvertedSignature: true,
    },
    entryAnimation: "float",
    entryDuration: 0.7,
    initParticles: (w, h) => {
      return Array.from({ length: 70 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.5) * 18,
        r: 1 + Math.random() * 2,
        alpha: 0.2 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.5 ? "#ffffff" : "#00ffee",
      }));
    },
  },
  ocean: {
    palette: ["#00d4aa", "#0088ff", "#00ffcc", "#0055cc", "#44ddbb", "#0099dd", "#22eebb", "#0077bb"],
    cardStyle: {
      bgGradient: ["rgba(0,30,60,0.88)", "rgba(0,15,40,0.94)"],
      borderUsePalette: true,
      textUsePalette: false,
      textColor: "#e0f8ff",
      glowBlur: 22,
      useInvertedSignature: true,
    },
    entryAnimation: "bubble",
    entryDuration: 0.9,
    initParticles: (w, h) => {
      return Array.from({ length: 50 }, () => ({
        x: Math.random() * w,
        y: h + Math.random() * 100,
        vx: (Math.random() - 0.5) * 20,
        vy: -(15 + Math.random() * 30),
        r: 2 + Math.random() * 6,
        alpha: 0.25 + Math.random() * 0.2,
        phase: Math.random() * Math.PI * 2,
        color: "rgba(150,220,255,0.35)",
      }));
    },
  },
  neon: {
    palette: ["#ff00cc", "#00ffff", "#ffff00", "#ff4400", "#00ff88", "#ff0088", "#88ff00", "#ff8800"],
    cardStyle: {
      bgGradient: ["rgba(5,5,10,0.95)", "rgba(2,2,8,0.98)"],
      borderUsePalette: true,
      textUsePalette: true,
      glowBlur: 28,
      useInvertedSignature: true,
    },
    entryAnimation: "flicker",
    entryDuration: 0.7,
    initParticles: (w, h) => {
      const colors = ["#ff00cc", "#00ffcc", "#ffff00"];
      return Array.from({ length: 30 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0,
        vy: 0,
        r: 1,
        alpha: 0,
        phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
    },
  },
  forest: {
    palette: ["#66bb44", "#ff9922", "#44cc88", "#ddaa00", "#88cc44", "#ff6633", "#33bb66", "#cc8800"],
    cardStyle: {
      bgGradient: ["rgba(15,25,12,0.90)", "rgba(8,15,6,0.95)"],
      borderUsePalette: true,
      textUsePalette: false,
      textColor: "#f0ffe8",
      glowBlur: 20,
      useInvertedSignature: true,
    },
    entryAnimation: "flutter",
    entryDuration: 0.7,
    initParticles: (w, h) => {
      const leafColors = ["#4a7c3f", "#8bc34a", "#cddc39", "#ff9800"];
      const leaves: Particle[] = Array.from({ length: 35 }, () => ({
        x: Math.random() * w,
        y: -20 - Math.random() * h,
        vx: (Math.random() - 0.5) * 25,
        vy: 20 + Math.random() * 30,
        r: 3 + Math.random() * 3,
        alpha: 0.6 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        color: leafColors[Math.floor(Math.random() * leafColors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 2,
      }));
      const fireflies: Particle[] = Array.from({ length: 18 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        r: 2 + Math.random(),
        alpha: 0,
        phase: Math.random() * Math.PI * 2,
        color: "#ffffaa",
      }));
      return [...leaves, ...fireflies];
    },
  },
  sunset: {
    palette: ["#ff6b35", "#f7c59f", "#ffaa00", "#e63946", "#ff8c42", "#ffd166", "#ef476f", "#ffa500"],
    cardStyle: {
      bgGradient: ["rgba(25,8,5,0.90)", "rgba(15,4,2,0.95)"],
      borderUsePalette: true,
      textUsePalette: false,
      textColor: "#fff5e0",
      glowBlur: 22,
      useInvertedSignature: true,
    },
    entryAnimation: "float",
    entryDuration: 0.7,
    initParticles: (w, h) => {
      const colors = ["#ff6600", "#ff9900", "#ffcc00", "#ff3300"];
      return Array.from({ length: 35 }, () => ({
        x: Math.random() * w,
        y: h + Math.random() * 50,
        vx: (Math.random() - 0.5) * 20,
        vy: -(20 + Math.random() * 30),
        r: 1 + Math.random() * 2,
        alpha: 0.4 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
    },
  },
};

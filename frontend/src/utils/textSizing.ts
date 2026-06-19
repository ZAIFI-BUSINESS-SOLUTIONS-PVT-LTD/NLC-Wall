const FONT_STACK = "'Noto Sans Tamil', Latha, sans-serif";

// Text sizing constants (used for both DOM and canvas sizing)
export const CG_NAME_FONT = {
  base: 11,
  max: 14,
  min: 9,
};

export const FLOATING_FONT = {
  withSig: 16,
  noSig: 18,
  min: 10,
  max: 28,
};

// Multipliers: Tamil stays near base; Latin/Devanagari get boosted for readability
export function scriptMultiplier(text: string): number {
  if (!text) return 1;
  // Tamil block: \u0B80 - \u0BFF
  if (/[\u0B80-\u0BFF]/.test(text)) return 1.0;
  // Devanagari block: \u0900 - \u097F
  if (/[\u0900-\u097F]/.test(text)) return 1.25;
  // Default (Latin/mixed) boost for readability
  return 1.25;
}

export { FONT_STACK };

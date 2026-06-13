import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount React trees between tests to avoid cross-test DOM leakage.
afterEach(() => {
  cleanup();
});

// ── Canvas mock ─────────────────────────────────────────────────────────────
// jsdom has no 2D canvas implementation. Components like SignatureCanvas call
// getContext("2d") on mount and would crash. Return a permissive stub whose
// every method is a no-op and whose every property is settable.
function makeContext2D(): CanvasRenderingContext2D {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop) {
      if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
      // Methods like getImageData should return something usable.
      if (prop === "getImageData") {
        return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      }
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => ({ addColorStop: () => {} });
      }
      if (prop === "measureText") {
        return () => ({ width: 0 });
      }
      // Default: a chainable no-op function.
      return () => undefined;
    },
    set(target, prop, value) {
      (target as Record<string | symbol, unknown>)[prop] = value;
      return true;
    },
  };
  return new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
}

// @ts-expect-error – overriding the jsdom stub.
HTMLCanvasElement.prototype.getContext = vi.fn(() => makeContext2D());
HTMLCanvasElement.prototype.toDataURL = vi.fn(
  () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
);
// jsdom's toBlob is missing; provide a minimal version.
// @ts-expect-error – jsdom stub.
HTMLCanvasElement.prototype.toBlob = function (cb: (b: Blob | null) => void) {
  cb(new Blob([], { type: "image/png" }));
};

// ── requestAnimationFrame polyfill ───────────────────────────────────────────
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame;
}

// ── matchMedia (some libs probe it) ──────────────────────────────────────────
if (!globalThis.matchMedia) {
  // @ts-expect-error – partial stub.
  globalThis.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Signature, WSEvent, DisplayTheme } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { FloatingWall } from "../components/FloatingWall";

// Animates a number rolling from its previous value to a new target.
// Gives every count increment a visible, satisfying feel.
function useRollingCount(target: number): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = target;
    if (target === prev) return;
    const diff = target - prev;
    const duration = 500; // ms — fast enough to feel instant, slow enough to see
    const t0 = performance.now();
    let rafId: number;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3); // cubic ease-out
      setDisplay(Math.round(prev + diff * ease));
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target]);

  return display;
}

export function DisplayPage(): React.ReactElement {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [newSig, setNewSig] = useState<Signature | null>(null);
  const [count, setCount] = useState(0);
  const [displayTheme, setDisplayTheme] = useState<DisplayTheme>("sky");
  const newSigTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollingCount = useRollingCount(count);

  // Fetch the persisted theme from the server on mount
  useEffect(() => {
    fetch("/admin/display-theme")
      .then((r) => r.json())
      .then((d) => { if (d.theme) setDisplayTheme(d.theme); })
      .catch(() => {});
  }, []);

  const handleWS = useCallback((event: WSEvent) => {
    if (event.event === "init") {
      setSignatures(event.data);
      setCount(event.data.length);
    } else if (event.event === "new_signature") {
      setSignatures((prev) => [...prev, event.data]);
      setCount((c) => c + 1);
      setNewSig(event.data);
      if (newSigTimer.current) clearTimeout(newSigTimer.current);
      // 5000ms matches CSS animation: 0.4s in + 4.2s visible + 0.4s out
      newSigTimer.current = setTimeout(() => setNewSig(null), 5000);
    } else if (event.event === "clear") {
      setSignatures([]);
      setCount(0);
      setNewSig(null);
    } else if (event.event === "display_theme") {
      setDisplayTheme(event.theme);
    }
  }, []);

  useWebSocket(handleWS);

  const isDark = displayTheme !== "sky";

  return (
    <div className={`display-page${isDark ? " display-page--space" : ""}`}>
      <FloatingWall signatures={signatures} newSig={newSig} displayTheme={displayTheme} />

      {/* Top-left HUD */}
      <div className="display-hud">
        <img src="/nlclogo70th.png" alt="NLC" className="hud-logo" />
        <div className="hud-text">
          <div className="hud-event">NLC Neyveli Book Fair</div>
          <div className="hud-title">Live Sign Wall</div>
          <div className="hud-count">
            <span className="hud-count-num">{rollingCount}</span>
            <span className="hud-count-label"> signed the wall</span>
          </div>
        </div>
      </div>

      {/* Bottom center */}
      <div className="display-footer-hud">
        <span className="hud-url">Scan QR or visit this server's IP on your phone</span>
      </div>

      {/* Admin gear — only visible when ?admin is in the URL, keeps display wall clean */}
      {window.location.search.includes("admin") && (
        <a href="/admin" className="admin-gear" title="Admin">⚙</a>
      )}

      {/* New signature toast */}
      {newSig && (
        <div className="new-sig-toast" key={newSig.id}>
          ✦ {newSig.name} joined the wall!
        </div>
      )}
    </div>
  );
}

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Signature, WSEvent, DisplayTheme } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { FloatingWall } from "../components/FloatingWall";

// Animates a number rolling from its previous value to a new target.
function useRollingCount(target: number): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = target;
    if (target === prev) return;
    const diff = target - prev;
    const duration = 500;
    const t0 = performance.now();
    let rafId: number;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(prev + diff * ease));
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target]);

  return display;
}


export function DisplayPage(): React.ReactElement {
  const [sigs, setSigs] = useState<Signature[]>([]);
  const [newSig, setNewSig] = useState<Signature | null>(null);
  const [displayTheme, setDisplayTheme] = useState<DisplayTheme>("sky");
  const [pledge, setPledge] = useState("");
  const newSigTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audience sigs drive the floating wall and the count
  const audienceSigs = useMemo(() => sigs.filter((s) => !s.is_chief_guest), [sigs]);
  const activeCgSigs = useMemo(
    () => sigs.filter((s) => s.is_chief_guest),
    [sigs],
  );

  const rollingCount = useRollingCount(audienceSigs.length);

  // Fetch persisted theme on mount
  useEffect(() => {
    fetch("/admin/display-theme")
      .then((r) => r.json())
      .then((d) => { if (d.theme) setDisplayTheme(d.theme); })
      .catch(() => {});
  }, []);

  const handleWS = useCallback((event: WSEvent) => {
    if (event.event === "init") {
      setSigs(event.data);
    } else if (event.event === "new_signature") {
      setSigs((prev) => [...prev, event.data]);
      if (!event.data.is_chief_guest) {
        setNewSig(event.data);
        if (newSigTimer.current) clearTimeout(newSigTimer.current);
        newSigTimer.current = setTimeout(() => setNewSig(null), 5000);
      }
    } else if (event.event === "remove_signature") {
      setSigs((prev) => prev.filter((s) => s.id !== event.id));
    } else if (event.event === "update_signature") {
      setSigs((prev) => prev.map((s) => s.id === event.data.id ? event.data : s));
    } else if (event.event === "clear") {
      // Clears audience sigs only; CG sigs remain
      setSigs((prev) => prev.filter((s) => s.is_chief_guest));
      setNewSig(null);
    } else if (event.event === "clear_chief_guests") {
      setSigs((prev) => prev.filter((s) => !s.is_chief_guest));
    } else if (event.event === "display_theme") {
      setDisplayTheme(event.theme);
    } else if (event.event === "pledge_update") {
      setPledge(event.text);
    }
  }, []);

  useWebSocket(handleWS);

  const isDark = displayTheme !== "sky";

  return (
    <div className={`display-page${isDark ? " display-page--space" : ""}`}>
      <FloatingWall signatures={audienceSigs} newSig={newSig} displayTheme={displayTheme} />

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
          {pledge && (
            <div className="hud-pledge">{pledge}</div>
          )}
        </div>
      </div>

      {/* Chief Guest pinned panel — top-left, always visible while CG sigs exist */}
      {activeCgSigs.length > 0 && (
        <div className="cg-banner">
          <div className="cg-banner-title">★ Chief Guest</div>
          <div className="cg-cards">
            {activeCgSigs.map((s) => (
              <div key={s.id} className="cg-card">
                {s.signature && (
                  <img src={s.signature} className="cg-card-sig" alt="signature" />
                )}
                <div className="cg-card-name">{s.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom center */}
      <div className="display-footer-hud">
        <span className="hud-url">Scan QR or visit this server's IP on your phone</span>
      </div>

      {/* Admin gear — only visible when ?admin is in the URL */}
      {window.location.search.includes("admin") && (
        <a href="/admin" className="admin-gear" title="Admin">⚙</a>
      )}

    </div>
  );
}

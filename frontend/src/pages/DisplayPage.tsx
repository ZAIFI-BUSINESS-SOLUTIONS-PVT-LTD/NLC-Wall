import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Signature, WSEvent, DisplayTheme, PledgeConfig } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { FloatingWall } from "../components/FloatingWall";
import { MascotCorner } from "../components/MascotCorner";
import { CgCard } from "../components/CgCard";

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
  const [arrivalCount, setArrivalCount] = useState(0);
  const [displayTheme, setDisplayTheme] = useState<DisplayTheme>("sky");
  const [pledgeConfig, setPledgeConfig] = useState<PledgeConfig | null>(null);
  const [pledgeIdx, setPledgeIdx] = useState(0);
  const newSigTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-refresh every 2 minutes to keep the display wall fresh during events.
  useEffect(() => {
    const t = setTimeout(() => window.location.reload(), 2 * 60 * 1000);
    return () => clearTimeout(t);
  }, []);

  // Audience sigs drive the floating wall and the count
  const audienceSigs = useMemo(() => sigs.filter((s) => !s.is_chief_guest), [sigs]);
  const activeCgSigs = useMemo(
    () => sigs.filter((s) => s.is_chief_guest),
    [sigs],
  );

  const rollingCount = useRollingCount(audienceSigs.length);

  // Languages to rotate through, in fixed priority order: Tamil → Hindi → English.
  // Empty languages are skipped so a blank field never shows a blank panel.
  const pledgeItems = useMemo(() => {
    if (!pledgeConfig) return [];
    const order = [
      { lang: "ta", label: "தமிழ்", text: pledgeConfig.tamil },
      { lang: "hi", label: "हिन्दी", text: pledgeConfig.hindi },
      { lang: "en", label: "English", text: pledgeConfig.english },
    ];
    return order.filter((p) => p.text && p.text.trim().length > 0);
  }, [pledgeConfig]);

  const durationSeconds = pledgeConfig?.duration_seconds ?? 90;

  // Auto-rotate the visible language every `durationSeconds`. Resets to the top
  // (Tamil) whenever the texts or timing change so a fresh save restarts cleanly.
  useEffect(() => {
    setPledgeIdx(0);
    if (pledgeItems.length <= 1) return;
    const durMs = Math.max(5, durationSeconds) * 1000;
    const t = setInterval(() => {
      setPledgeIdx((i) => (i + 1) % pledgeItems.length);
    }, durMs);
    return () => clearInterval(t);
  }, [pledgeItems, durationSeconds]);

  const currentPledge = pledgeItems[pledgeIdx] ?? pledgeItems[0] ?? null;

  // Fetch persisted theme on mount
  useEffect(() => {
    fetch("/admin/display-theme")
      .then((r) => r.json())
      .then((d) => { if (d.theme) setDisplayTheme(d.theme); })
      .catch(() => {});
    // Also fetch current pledge config so display loads initial texts
    fetch("/admin/pledge-config")
      .then((r) => r.json())
      .then((d) => { if (d) setPledgeConfig(d); })
      .catch(() => {});
  }, []);

  const handleWS = useCallback((event: WSEvent) => {
    if (event.event === "init") {
      setSigs(event.data);
    } else if (event.event === "new_signature") {
      setSigs((prev) => [...prev, event.data]);
      if (!event.data.is_chief_guest) {
        setNewSig(event.data);
        setArrivalCount((c) => c + 1);
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
    } else if (event.event === "pledge_config") {
      setPledgeConfig(event.config);
    }
  }, []);

  useWebSocket(handleWS);

  const isDark = displayTheme !== "sky";

  return (
    <div className={`display-page${isDark ? " display-page--space" : ""}`}>
      <FloatingWall signatures={audienceSigs} newSig={newSig} displayTheme={displayTheme} />

      {/* Top-right NLC logo */}
      <img src="/nlclogo70th.png" alt="NLC" className="hud-logo-corner" />

      {/* Top-left HUD */}
        <div className="vigil-header">Live Sign Wall</div>
      <div className="display-hud">
        <div className="hud-event">NLC Neyveli Book Fair</div>
        <div className="hud-title">NLCIL VIGILANCE</div>
        <div className="hud-count">
          <span className="hud-count-num">{rollingCount}</span>
          <span className="hud-count-label"> signed the wall</span>
        </div>
      </div>

      {/* Chief Guest pinned panel — top-left, always visible while CG sigs exist */}
      {activeCgSigs.length > 0 && (
        <div className="cg-banner">
            <div className="cg-banner-title">★ DIGNITARIES</div>
          <div className="cg-cards">
            {activeCgSigs.map((s) => (
              <CgCard key={s.id} name={s.name} signature={s.signature} />
            ))}
          </div>
        </div>
      )}

      {/* Rotating multilingual pledge panel — Tamil → Hindi → English */}
      {currentPledge && (
        <div className="pledge-panel">
          <div className="pledge-panel-head">
            <span className="pledge-panel-badge">{currentPledge.label}</span>
            {pledgeItems.length > 1 && (
              <div className="pledge-panel-dots">
                {pledgeItems.map((p, i) => (
                  <span
                    key={p.lang}
                    className={`pledge-dot${i === pledgeIdx ? " active" : ""}`}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="pledge-panel-body">{currentPledge.text}</div>
        </div>
      )}

      {/* Admin gear — only visible when ?admin is in the URL */}
      {window.location.search.includes("admin") && (
        <a href="/admin" className="admin-gear" title="Admin">⚙</a>
      )}

      {/* Mascot — slides up from bottom-right like a news channel footer */}
      <MascotCorner arrivalCount={arrivalCount} latestName={newSig?.name} />

    </div>
  );
}

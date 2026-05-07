import React, { useState, useCallback, useRef, useEffect } from "react";
import { Signature, WSEvent, DisplayTheme } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { FloatingWall } from "../components/FloatingWall";

export function DisplayPage(): React.ReactElement {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [newSig, setNewSig] = useState<Signature | null>(null);
  const [count, setCount] = useState(0);
  const [displayTheme, setDisplayTheme] = useState<DisplayTheme>("sky");
  const newSigTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      newSigTimer.current = setTimeout(() => setNewSig(null), 3000);
    } else if (event.event === "clear") {
      setSignatures([]);
      setCount(0);
      setNewSig(null);
    } else if (event.event === "display_theme") {
      setDisplayTheme(event.theme);
    }
  }, []);

  useWebSocket(handleWS);

  const isSpace = displayTheme === "space";

  return (
    <div className={`display-page${isSpace ? " display-page--space" : ""}`}>
      <FloatingWall signatures={signatures} newSig={newSig} displayTheme={displayTheme} />

      {/* Top-left HUD */}
      <div className="display-hud">
        <img src="/nlclogo70th.png" alt="NLC" className="hud-logo" />
        <div className="hud-text">
          <div className="hud-event">NLC Neyveli Book Fair</div>
          <div className="hud-title">Live Sign Wall</div>
          <div className="hud-count">{count} signatures</div>
        </div>
      </div>

      {/* Bottom center */}
      <div className="display-footer-hud">
        <span className="hud-url">Scan QR or visit this server's IP on your phone</span>
      </div>

      {/* Admin gear — top right */}
      <a href="/admin" className="admin-gear" title="Admin">⚙</a>

      {/* New signature toast */}
      {newSig && (
        <div className="new-sig-toast" key={newSig.id}>
          ✦ {newSig.name} joined the wall!
        </div>
      )}
    </div>
  );
}

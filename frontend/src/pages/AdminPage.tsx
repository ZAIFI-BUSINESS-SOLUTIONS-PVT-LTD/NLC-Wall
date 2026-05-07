import React, { useState, useEffect } from "react";
import { useTheme } from "../hooks/useTheme";
import { DisplayTheme } from "../types";

interface Stats {
  count: number;
  status: string;
}

export function AdminPage(): React.ReactElement {
  const [theme, setTheme] = useTheme();
  const [displayTheme, setDisplayThemeState] = useState<DisplayTheme>("sky");
  const [stats, setStats] = useState<Stats | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportMsg, setExportMsg] = useState("");

  const fetchStats = async () => {
    try {
      const res = await fetch("/health");
      if (res.ok) setStats(await res.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStats();
    fetch("/admin/display-theme")
      .then((r) => r.json())
      .then((d) => { if (d.theme) setDisplayThemeState(d.theme); })
      .catch(() => {});
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSetDisplayTheme = async (t: DisplayTheme) => {
    setDisplayThemeState(t);
    try {
      await fetch("/admin/display-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: t }),
      });
    } catch {
      // ignore — local UI still updates
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Clear ALL signatures from the wall? This cannot be undone.")) return;
    setClearing(true);
    try {
      const res = await fetch("/admin/signatures", { method: "DELETE" });
      if (res.ok) {
        setClearMsg("Wall cleared successfully.");
        await fetchStats();
      } else {
        setClearMsg("Failed to clear.");
      }
    } catch {
      setClearMsg("Network error.");
    } finally {
      setClearing(false);
      setTimeout(() => setClearMsg(""), 3000);
    }
  };

  const handleExportJSON = async () => {
    try {
      const res = await fetch("/signatures");
      if (!res.ok) { setExportMsg("Failed to fetch signatures."); return; }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `signatures-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(`Exported ${data.length} signatures as JSON.`);
    } catch {
      setExportMsg("Export failed.");
    } finally {
      setTimeout(() => setExportMsg(""), 4000);
    }
  };

  const handleSaveImages = async () => {
    setSaving(true);
    try {
      const res = await fetch("/admin/save-images", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setExportMsg(`Saved ${data.newly_saved} image${data.newly_saved !== 1 ? "s" : ""} → ${data.signatures_dir}`);
      } else {
        setExportMsg("Failed to save images.");
      }
    } catch {
      setExportMsg("Network error.");
    } finally {
      setSaving(false);
      setTimeout(() => setExportMsg(""), 6000);
    }
  };

  const handleDownloadSheet = async () => {
    try {
      const res = await fetch("/signatures");
      if (!res.ok) { setExportMsg("Failed to fetch signatures."); return; }
      const sigs: { name: string; signature: string | null; timestamp: number }[] = await res.json();
      if (sigs.length === 0) { setExportMsg("No signatures to export."); return; }

      // Pre-load all signature images before touching the canvas
      const images = await Promise.all(
        sigs.map((sig) => {
          if (!sig.signature) return Promise.resolve<HTMLImageElement | null>(null);
          return new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = sig.signature!;
          });
        }),
      );

      const cols = Math.min(4, sigs.length);
      const cardW = 320;
      const cardH = 120;
      const pad = 16;
      const rows = Math.ceil(sigs.length / cols);
      const sheetW = cols * (cardW + pad) + pad;
      const sheetH = rows * (cardH + pad) + pad + 52;

      const canvas = document.createElement("canvas");
      canvas.width = sheetW;
      canvas.height = sheetH;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = "#f5f8ff";
      ctx.fillRect(0, 0, sheetW, sheetH);

      ctx.font = "bold 16px 'Noto Sans Tamil', sans-serif";
      ctx.fillStyle = "#334";
      ctx.textAlign = "center";
      ctx.fillText(
        `NLC Neyveli Book Fair — Live Sign Wall (${sigs.length} signature${sigs.length !== 1 ? "s" : ""})`,
        sheetW / 2,
        32,
      );

      const COLORS = ["#e63946","#e07b00","#2cb85c","#c8960a","#8b32cc","#e03a8a","#009688","#f05a28"];

      sigs.forEach((sig, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = pad + col * (cardW + pad);
        const cy = 52 + row * (cardH + pad);
        const color = COLORS[(sig.name.charCodeAt(0) + sig.name.length) % COLORS.length];
        const img = images[i];

        ctx.save();
        ctx.shadowColor = `${color}44`;
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect?: Function }).roundRect?.(cx, cy, cardW, cardH, 10)
          ?? roundRectPath(ctx, cx, cy, cardW, cardH, 10);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect?: Function }).roundRect?.(cx, cy, cardW, cardH, 10)
          ?? roundRectPath(ctx, cx, cy, cardW, cardH, 10);
        ctx.stroke();

        ctx.fillStyle = "#111";
        ctx.font = "bold 18px 'Noto Sans Tamil', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const nameY = img ? cy + 22 : cy + cardH / 2;
        ctx.fillText(sig.name, cx + cardW / 2, nameY);

        if (img) {
          const sigAreaY = cy + 36;
          const sigAreaH = cardH - 44;
          const sigAreaW = cardW - 24;
          const ratio = Math.min(sigAreaW / img.naturalWidth, sigAreaH / img.naturalHeight);
          const dw = img.naturalWidth * ratio;
          const dh = img.naturalHeight * ratio;
          ctx.drawImage(img, cx + (cardW - dw) / 2, sigAreaY, dw, dh);
        }
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `signature-sheet-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setExportMsg(`Downloaded sheet (${sigs.length} signatures).`);
        setTimeout(() => setExportMsg(""), 4000);
      }, "image/png");
    } catch {
      setExportMsg("Sheet generation failed.");
      setTimeout(() => setExportMsg(""), 3000);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <img src="/nlclogo70th.png" alt="NLC" className="admin-logo" />
        <div>
          <div className="admin-badge">Admin Panel</div>
          <h1 className="admin-title">Live Sign Wall</h1>
          <p className="admin-sub">NLC Neyveli Book Fair</p>
        </div>
      </header>

      <div className="admin-grid">

        {/* Settings card */}
        <div className="admin-card">
          <div className="admin-card-title">⚙ Settings</div>

          <div className="admin-row" style={{ marginBottom: 16 }}>
            <div className="admin-row-label">
              <span className="admin-row-icon">{theme === "dark" ? "🌙" : "☀️"}</span>
              Input Page Theme
            </div>
            <div className="theme-toggle-group">
              <button className={`theme-btn${theme === "dark" ? " active" : ""}`} onClick={() => setTheme("dark")}>Dark</button>
              <button className={`theme-btn${theme === "light" ? " active" : ""}`} onClick={() => setTheme("light")}>Light</button>
            </div>
          </div>

          <div className="admin-row">
            <div className="admin-row-label">
              <span className="admin-row-icon">{displayTheme === "sky" ? "☁️" : "🌌"}</span>
              Display Wall Theme
            </div>
            <div className="theme-toggle-group">
              <button
                className={`theme-btn${displayTheme === "sky" ? " active" : ""}`}
                onClick={() => handleSetDisplayTheme("sky")}
              >
                ☁ Sky
              </button>
              <button
                className={`theme-btn${displayTheme === "space" ? " active" : ""}`}
                onClick={() => handleSetDisplayTheme("space")}
              >
                🌌 Space
              </button>
            </div>
          </div>
        </div>

        {/* Stats card */}
        <div className="admin-card">
          <div className="admin-card-title">📊 Live Stats</div>
          <div className="admin-stat-grid">
            <div className="admin-stat">
              <div className="admin-stat-value">{stats?.count ?? "—"}</div>
              <div className="admin-stat-label">Total Signatures</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-value" style={{ color: "var(--cyan)" }}>
                {stats ? "●" : "○"}
              </div>
              <div className="admin-stat-label">{stats ? "Server Online" : "Connecting…"}</div>
            </div>
          </div>
        </div>

        {/* Export card */}
        <div className="admin-card">
          <div className="admin-card-title">💾 Export Data</div>
          <div className="admin-export-stack">
            <button className="btn-export" onClick={handleExportJSON}>
              📥 Download All as JSON
            </button>
            <button className="btn-export" onClick={handleDownloadSheet}>
              🖼 Download Signature Sheet (PNG)
            </button>
            <button className="btn-export btn-export-server" onClick={handleSaveImages} disabled={saving}>
              💿 {saving ? "Saving…" : "Save Signature Images to Server"}
            </button>
          </div>
          {exportMsg && <div className="admin-feedback admin-feedback-info">{exportMsg}</div>}
        </div>

        {/* Actions card */}
        <div className="admin-card">
          <div className="admin-card-title">🗑 Actions</div>
          <p className="admin-action-desc">
            Clears all signatures from the wall and notifies all connected display screens immediately.
          </p>
          <button className="btn-danger" onClick={handleClear} disabled={clearing}>
            {clearing ? "Clearing…" : "Clear All Signatures"}
          </button>
          {clearMsg && <div className="admin-feedback">{clearMsg}</div>}
        </div>

        {/* Navigation card */}
        <div className="admin-card">
          <div className="admin-card-title">🔗 Navigation</div>
          <div className="admin-nav-links">
            <a href="/" className="admin-nav-btn">✦ Visitor Input Page</a>
            <a href="/display" className="admin-nav-btn">📺 Display Wall</a>
          </div>
        </div>

      </div>
    </div>
  );
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y - r + h);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

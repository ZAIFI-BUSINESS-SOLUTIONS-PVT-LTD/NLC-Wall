import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "../hooks/useTheme";
import { DisplayTheme, ChiefGuestConfig, PledgeConfig } from "../types";

const DISPLAY_THEMES: { id: DisplayTheme; label: string; emoji: string }[] = [
  { id: "sky",    label: "Sky",    emoji: "🌤" },
  { id: "space",  label: "Space",  emoji: "🌌" },
  { id: "aurora", label: "Aurora", emoji: "🌠" },
  { id: "ocean",  label: "Ocean",  emoji: "🌊" },
  { id: "neon",   label: "Neon",   emoji: "⚡" },
  { id: "forest", label: "Forest", emoji: "🌿" },
  { id: "sunset", label: "Sunset", emoji: "🌅" },
];

const PAGE_SIZE = 20;
const SHEET_PAGE_SIZE = 100; // max signatures per PNG page

interface Stats {
  count: number;
  audience_count: number;
  cg_count: number;
  status: string;
}

interface SigMeta {
  id: string;
  name: string;
  timestamp: number;
  has_sig: boolean;
  is_chief_guest: boolean;
}

function msToDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function datetimeLocalToMs(s: string): number {
  return new Date(s).getTime();
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

async function loadImages(sigs: { signature: string | null }[]): Promise<(HTMLImageElement | null)[]> {
  return Promise.all(
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
}

function buildSheetCanvas(
  sigs: { name: string; signature: string | null; timestamp: number }[],
  images: (HTMLImageElement | null)[],
  header: string,
): HTMLCanvasElement {
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

  ctx.font = "bold 14px 'Noto Sans Tamil', sans-serif";
  ctx.fillStyle = "#334";
  ctx.textAlign = "center";
  ctx.fillText(header, sheetW / 2, 32);

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

  return canvas;
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setTimeout(resolve, 300);
    }, "image/png");
  });
}

function readTextFile(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function AdminPage(): React.ReactElement {
  const [theme, setTheme] = useTheme();
  const [displayTheme, setDisplayThemeState] = useState<DisplayTheme>("sky");
  const [stats, setStats] = useState<Stats | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState("");
  const [clearingCg, setClearingCg] = useState(false);
  const [clearCgMsg, setClearCgMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Pledge state — three languages (Tamil/Hindi/English) + one shared per-language duration
  const [pledge, setPledge] = useState<PledgeConfig>({
    tamil: "",
    hindi: "",
    english: "",
    duration_seconds: 90,
  });
  const [pledgeSaving, setPledgeSaving] = useState(false);
  const [pledgeMsg, setPledgeMsg] = useState("");

  // Chief Guest config state
  const [cgConfig, setCgConfig] = useState<ChiefGuestConfig>({
    enabled: false,
    retention_mode: "forever",
    retention_until: null,
  });
  const [cgDateInput, setCgDateInput] = useState("");
  const [cgSaving, setCgSaving] = useState(false);
  const [cgMsg, setCgMsg] = useState("");

  // DB table state
  const [dbRows, setDbRows] = useState<SigMeta[]>([]);
  const [dbTotal, setDbTotal] = useState(0);
  const [dbPage, setDbPage] = useState(0);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbMsg, setDbMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch("/health");
      if (res.ok) setStats(await res.json());
    } catch {
      // ignore
    }
  };

  const fetchDbRows = useCallback(async (page: number) => {
    setDbLoading(true);
    try {
      const res = await fetch(`/admin/db/signatures?skip=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setDbRows(data.items);
        setDbTotal(data.total);
      }
    } catch {
      // ignore
    } finally {
      setDbLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetch("/admin/display-theme")
      .then((r) => r.json())
      .then((d) => { if (d.theme) setDisplayThemeState(d.theme); })
      .catch(() => {});
    fetch("/admin/pledge-config")
      .then((r) => r.json())
      .then((d: PledgeConfig) => {
        if (d && typeof d === "object") {
          setPledge({
            tamil: d.tamil ?? "",
            hindi: d.hindi ?? "",
            english: d.english ?? "",
            duration_seconds: d.duration_seconds ?? 90,
          });
        }
      })
      .catch(() => {});
    fetch("/admin/chief-guest-config")
      .then((r) => r.json())
      .then((d: ChiefGuestConfig) => {
        setCgConfig(d);
        if (d.retention_until) setCgDateInput(msToDatetimeLocal(d.retention_until));
      })
      .catch(() => {});
    fetchDbRows(0);
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchDbRows]);

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

  const handleSavePledge = async () => {
    setPledgeSaving(true);
    try {
      const res = await fetch("/admin/pledge-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pledge),
      });
      if (res.ok) {
        const saved: PledgeConfig = await res.json();
        setPledge(saved);
        setPledgeMsg("Pledge saved and broadcast to display wall.");
      } else {
        setPledgeMsg("Failed to save pledge.");
      }
    } catch {
      setPledgeMsg("Network error.");
    } finally {
      setPledgeSaving(false);
      setTimeout(() => setPledgeMsg(""), 4000);
    }
  };

  const handleSaveCgConfig = async () => {
    const config: ChiefGuestConfig = {
      enabled: cgConfig.enabled,
      retention_mode: cgConfig.retention_mode,
      retention_until: cgConfig.retention_mode === "until_datetime" && cgDateInput
        ? datetimeLocalToMs(cgDateInput)
        : null,
    };
    setCgSaving(true);
    try {
      const res = await fetch("/admin/chief-guest-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const saved: ChiefGuestConfig = await res.json();
        setCgConfig(saved);
        setCgMsg("Chief Guest config saved and broadcast.");
      } else {
        setCgMsg("Failed to save config.");
      }
    } catch {
      setCgMsg("Network error.");
    } finally {
      setCgSaving(false);
      setTimeout(() => setCgMsg(""), 4000);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Clear all AUDIENCE signatures from the wall? Chief Guest signatures will be preserved.")) return;
    setClearing(true);
    try {
      const res = await fetch("/admin/signatures", { method: "DELETE" });
      if (res.ok) {
        setClearMsg("Audience signatures cleared.");
        await fetchStats();
        await fetchDbRows(0);
        setDbPage(0);
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

  const handleClearCg = async () => {
    if (!window.confirm("Clear all Chief Guest signatures? This cannot be undone.")) return;
    setClearingCg(true);
    try {
      const res = await fetch("/admin/chief-guest-signatures", { method: "DELETE" });
      if (res.ok) {
        setClearCgMsg("Chief Guest signatures cleared.");
        await fetchStats();
        await fetchDbRows(0);
        setDbPage(0);
      } else {
        setClearCgMsg("Failed to clear.");
      }
    } catch {
      setClearCgMsg("Network error.");
    } finally {
      setClearingCg(false);
      setTimeout(() => setClearCgMsg(""), 3000);
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

  const handleImportJSON = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await readTextFile(file);
      const data = JSON.parse(text);
      if (!Array.isArray(data)) {
        setExportMsg("Import failed: choose a SignWall JSON export.");
        return;
      }

      const res = await fetch("/admin/import-signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setExportMsg(`Imported ${body.total} signatures (${body.added} new, ${body.updated} updated).`);
        await fetchStats();
        await fetchDbRows(0);
        setDbPage(0);
      } else {
        setExportMsg(body.detail ?? "Import failed.");
      }
    } catch {
      setExportMsg("Import failed: invalid JSON file.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
      setTimeout(() => setExportMsg(""), 6000);
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

  const handleDownloadAudienceSheet = async () => {
    try {
      const res = await fetch("/signatures");
      if (!res.ok) { setExportMsg("Failed to fetch signatures."); return; }
      const allSigs: { name: string; signature: string | null; timestamp: number; is_chief_guest: boolean }[] = await res.json();
      const sigs = allSigs.filter((s) => !s.is_chief_guest);
      if (sigs.length === 0) { setExportMsg("No audience signatures to export."); return; }

      const images = await loadImages(sigs);
      const totalPages = Math.ceil(sigs.length / SHEET_PAGE_SIZE);
      const dateStr = new Date().toISOString().slice(0, 10);

      for (let page = 0; page < totalPages; page++) {
        const pageSigs = sigs.slice(page * SHEET_PAGE_SIZE, (page + 1) * SHEET_PAGE_SIZE);
        const pageImages = images.slice(page * SHEET_PAGE_SIZE, (page + 1) * SHEET_PAGE_SIZE);
        const headerText = totalPages > 1
          ? `NLC Neyveli Book Fair — Audience Signatures (${sigs.length} total) — Page ${page + 1} of ${totalPages}`
          : `NLC Neyveli Book Fair — Audience Signatures (${sigs.length})`;
        const canvas = buildSheetCanvas(pageSigs, pageImages, headerText);
        const filename = totalPages > 1
          ? `audience-sheet-${dateStr}-p${page + 1}.png`
          : `audience-sheet-${dateStr}.png`;
        await downloadCanvas(canvas, filename);
      }

      setExportMsg(`Downloaded ${totalPages} audience sheet${totalPages > 1 ? "s" : ""} (${sigs.length} signatures).`);
    } catch {
      setExportMsg("Sheet generation failed.");
    } finally {
      setTimeout(() => setExportMsg(""), 5000);
    }
  };

  const handleDownloadCgSheet = async () => {
    try {
      const res = await fetch("/signatures");
      if (!res.ok) { setExportMsg("Failed to fetch signatures."); return; }
      const allSigs: { name: string; signature: string | null; timestamp: number; is_chief_guest: boolean }[] = await res.json();
      const sigs = allSigs.filter((s) => s.is_chief_guest);
      if (sigs.length === 0) { setExportMsg("No Chief Guest signatures to export."); return; }

      const images = await loadImages(sigs);
      const dateStr = new Date().toISOString().slice(0, 10);
      const headerText = `NLC Neyveli Book Fair — Chief Guest Signatures (${sigs.length})`;
      const canvas = buildSheetCanvas(sigs, images, headerText);
      await downloadCanvas(canvas, `chief-guest-sheet-${dateStr}.png`);

      setExportMsg(`Downloaded Chief Guest sheet (${sigs.length} signature${sigs.length !== 1 ? "s" : ""}).`);
    } catch {
      setExportMsg("Chief Guest sheet generation failed.");
    } finally {
      setTimeout(() => setExportMsg(""), 5000);
    }
  };

  // DB table handlers
  const handleDbPageChange = (newPage: number) => {
    setDbPage(newPage);
    fetchDbRows(newPage);
    setEditingId(null);
  };

  const handleEditStart = (row: SigMeta) => {
    setEditingId(row.id);
    setEditName(row.name);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleEditSave = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/admin/db/signatures/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setDbRows((prev) => prev.map((r) => r.id === id ? { ...r, name: trimmed } : r));
        setDbMsg("Name updated.");
      } else {
        const err = await res.json().catch(() => ({}));
        setDbMsg(err.detail ?? "Update failed.");
      }
    } catch {
      setDbMsg("Network error.");
    } finally {
      setEditingId(null);
      setEditName("");
      setTimeout(() => setDbMsg(""), 3000);
    }
  };

  const handleDbDelete = async (row: SigMeta) => {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    setDeletingId(row.id);
    try {
      const res = await fetch(`/admin/db/signatures/${row.id}`, { method: "DELETE" });
      if (res.ok) {
        setDbMsg(`Deleted "${row.name}".`);
        await fetchDbRows(dbPage);
        await fetchStats();
      } else {
        const err = await res.json().catch(() => ({}));
        setDbMsg(err.detail ?? "Delete failed.");
      }
    } catch {
      setDbMsg("Network error.");
    } finally {
      setDeletingId(null);
      setTimeout(() => setDbMsg(""), 3000);
    }
  };

  const handleDownloadImage = (row: SigMeta) => {
    const a = document.createElement("a");
    a.href = `/admin/db/signatures/${row.id}/image`;
    a.download = `${row.name}_${row.id.slice(0, 8)}.png`;
    a.click();
  };

  const handleToggleCg = async (row: SigMeta) => {
    const isCg = !row.is_chief_guest;
    try {
      const res = await fetch(`/admin/db/signatures/${row.id}/chief-guest`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_chief_guest: isCg }),
      });
      if (res.ok) {
        setDbRows((prev) => prev.map((r) => r.id === row.id ? { ...r, is_chief_guest: isCg } : r));
        setDbMsg(isCg ? `"${row.name}" marked as Chief Guest.` : `"${row.name}" unmarked as Chief Guest.`);
        await fetchStats();
      } else {
        const err = await res.json().catch(() => ({}));
        setDbMsg(err.detail ?? "Update failed.");
      }
    } catch {
      setDbMsg("Network error.");
    } finally {
      setTimeout(() => setDbMsg(""), 3000);
    }
  };

  const totalPages = Math.ceil(dbTotal / PAGE_SIZE);

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <header className="admin-header">
        <img src="/nlclogo70th.png" alt="NLC" className="admin-logo" />
        <div>
          <div className="admin-badge">Admin Panel</div>
          <h1 className="admin-title">Live Sign Wall</h1>
          <p className="admin-sub">NLC Neyveli Book Fair</p>
        </div>
      </header>

      <div className="admin-grid">

        {/* ── Overview: stats + quick nav — full width ── */}
        <div className="admin-card admin-card--overview">
          <div className="overview-stats">
            <div className="overview-stat">
              <div className="overview-stat-value">{stats?.audience_count ?? "—"}</div>
              <div className="overview-stat-label">Audience</div>
            </div>
            <div className="overview-divider" />
            <div className="overview-stat">
              <div className="overview-stat-value overview-stat-value--gold">{stats?.cg_count ?? "—"}</div>
              <div className="overview-stat-label">Chief Guests</div>
            </div>
            <div className="overview-divider" />
            <div className="overview-stat">
              <div className="overview-stat-value">{stats?.count ?? "—"}</div>
              <div className="overview-stat-label">Total Signed</div>
            </div>
            <div className="overview-divider" />
            <div className="overview-stat">
              <div className={`overview-live-dot${stats ? " online" : ""}`} />
              <div className="overview-stat-label">{stats ? "Server Live" : "Connecting…"}</div>
            </div>
          </div>
          <div className="overview-nav">
            <a href="/" className="overview-nav-btn">✦ Input Page</a>
            <a href="/display" className="overview-nav-btn overview-nav-btn--primary">📺 Display Wall</a>
          </div>
        </div>

        {/* ── Settings ── */}
        <div className="admin-card">
          <div className="admin-card-title">⚙ Settings</div>

          <div className="settings-section">
            <div className="settings-label">Input Page Theme</div>
            <div className="theme-toggle-group">
              <button className={`theme-btn${theme === "dark" ? " active" : ""}`} onClick={() => setTheme("dark")}>🌙 Dark</button>
              <button className={`theme-btn${theme === "light" ? " active" : ""}`} onClick={() => setTheme("light")}>☀️ Light</button>
            </div>
          </div>

          <div className="settings-divider" />

          <div className="settings-section">
            <div className="settings-label">
              Display Wall Theme
              <span className="settings-label-active">
                {DISPLAY_THEMES.find((t) => t.id === displayTheme)?.emoji} {DISPLAY_THEMES.find((t) => t.id === displayTheme)?.label}
              </span>
            </div>
            <div className="theme-toggle-group theme-toggle-wrap">
              {DISPLAY_THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`theme-btn${displayTheme === t.id ? " active" : ""}`}
                  onClick={() => handleSetDisplayTheme(t.id)}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Chief Guest ── */}
        <div className="admin-card">
          <div className="admin-card-title">★ Chief Guest</div>
          <div className="cg-config-section">

            <div className="settings-section">
              <div className="settings-label">Show on Display Wall</div>
              <div className="theme-toggle-group">
                <button className={`theme-btn${cgConfig.enabled ? " active" : ""}`} onClick={() => setCgConfig((c) => ({ ...c, enabled: true }))}>On</button>
                <button className={`theme-btn${!cgConfig.enabled ? " active" : ""}`} onClick={() => setCgConfig((c) => ({ ...c, enabled: false }))}>Off</button>
              </div>
            </div>

            <div className="settings-divider" />

            <div className="settings-section">
              <div className="settings-label">Retention</div>
              <div className="theme-toggle-group">
                <button
                  className={`theme-btn${cgConfig.retention_mode === "forever" ? " active" : ""}`}
                  onClick={() => setCgConfig((c) => ({ ...c, retention_mode: "forever" }))}
                >Forever</button>
                <button
                  className={`theme-btn${cgConfig.retention_mode === "until_datetime" ? " active" : ""}`}
                  onClick={() => setCgConfig((c) => ({ ...c, retention_mode: "until_datetime" }))}
                >Until Date</button>
              </div>
            </div>

            {cgConfig.retention_mode === "until_datetime" && (
              <div className="cg-date-row" style={{ marginTop: 4 }}>
                <span className="cg-field-label">Expires at</span>
                <input
                  type="datetime-local"
                  className="cg-date-input"
                  value={cgDateInput}
                  onChange={(e) => setCgDateInput(e.target.value)}
                />
              </div>
            )}

            <button className="btn-pledge-save" style={{ marginTop: 8, width: "100%" }} onClick={handleSaveCgConfig} disabled={cgSaving}>
              {cgSaving ? "Saving…" : "💾 Save Config"}
            </button>
            {cgMsg && <div className="admin-feedback admin-feedback-info" style={{ marginTop: 10 }}>{cgMsg}</div>}
          </div>
        </div>

        {/* ── Pledge Content — full width ── */}
        <div className="admin-card pledge-card">
          <div className="pledge-card-header">
            <div className="admin-card-title" style={{ marginBottom: 0 }}>📜 Pledge Content</div>
            <span className="pledge-header-hint">Rotates: Tamil → Hindi → English</span>
          </div>

          <div className="pledge-duration-row">
            <label className="pledge-duration-label" htmlFor="pledge-duration">⏱ Time per language</label>
            <div className="pledge-duration-input-wrap">
              <input
                id="pledge-duration"
                type="number"
                className="pledge-duration-input"
                min={5}
                max={600}
                value={pledge.duration_seconds}
                onChange={(e) => setPledge((p) => ({ ...p, duration_seconds: Number(e.target.value) || 0 }))}
              />
              <span className="pledge-duration-unit">seconds</span>
            </div>
          </div>

          <div className="pledge-langs-grid">
            {(
              [
                { key: "tamil",   label: "Tamil — தமிழ்" },
                { key: "hindi",   label: "Hindi — हिन्दी" },
                { key: "english", label: "English" },
              ] as { key: "tamil" | "hindi" | "english"; label: string }[]
            ).map(({ key, label }) => (
              <div className="pledge-lang-block" key={key}>
                <div className="pledge-lang-label">{label}</div>
                <div className="pledge-field">
                  <textarea
                    className="pledge-textarea"
                    value={pledge[key]}
                    onChange={(e) => setPledge((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={`Enter ${key} pledge…`}
                    maxLength={4000}
                    rows={5}
                  />
                  <div className="pledge-action-row">
                    <span className="pledge-char-count">{pledge[key].length} / 4000</span>
                    {pledge[key].length > 0 && (
                      <button className="btn-pledge-clear" onClick={() => setPledge((p) => ({ ...p, [key]: "" }))}>✕ Clear</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pledge-save-row">
            <button className="btn-pledge-save" onClick={handleSavePledge} disabled={pledgeSaving}>
              {pledgeSaving ? "Broadcasting…" : "💾 Save & Broadcast"}
            </button>
          </div>
          {pledgeMsg && <div className="admin-feedback admin-feedback-info pledge-feedback">{pledgeMsg}</div>}
        </div>

        {/* ── Export ── */}
        <div className="admin-card">
          <div className="admin-card-title">💾 Export Data</div>
          <div className="admin-export-stack">
            <button className="btn-export" onClick={handleExportJSON}>
              📥 All Signatures — JSON
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="admin-import-input"
              onChange={(e) => handleImportJSON(e.target.files?.[0] ?? null)}
            />
            <button
              className="btn-export"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? "Importing..." : "Import Signatures - JSON"}
            </button>
            <button className="btn-export" onClick={handleDownloadAudienceSheet}>
              🖼 Audience Sheet — PNG
            </button>
            <button className="btn-export" onClick={handleDownloadCgSheet}>
              ★ Chief Guest Sheet — PNG
            </button>
            <button className="btn-export btn-export-server" onClick={handleSaveImages} disabled={saving}>
              💿 {saving ? "Saving to server…" : "Save Images to Server"}
            </button>
          </div>
          {exportMsg && <div className="admin-feedback admin-feedback-info" style={{ marginTop: 12 }}>{exportMsg}</div>}
        </div>

        {/* ── Danger Zone ── */}
        <div className="admin-card admin-card--danger">
          <div className="admin-card-title danger-zone-title">⚠ Danger Zone</div>

          <div className="danger-action">
            <div className="danger-action-info">
              <div className="danger-action-name">Clear Audience Wall</div>
              <div className="danger-action-desc">Removes all audience signatures. Chief Guest signatures are kept.</div>
            </div>
            <button className="btn-danger btn-danger--compact" onClick={handleClear} disabled={clearing}>
              {clearing ? "Clearing…" : "Clear"}
            </button>
          </div>
          {clearMsg && <div className="admin-feedback" style={{ marginBottom: 12 }}>{clearMsg}</div>}

          <div className="danger-divider" />

          <div className="danger-action">
            <div className="danger-action-info">
              <div className="danger-action-name">Clear Chief Guests</div>
              <div className="danger-action-desc">Removes all Chief Guest signatures from wall and database.</div>
            </div>
            <button className="btn-danger btn-danger--compact" onClick={handleClearCg} disabled={clearingCg}>
              {clearingCg ? "Clearing…" : "Clear"}
            </button>
          </div>
          {clearCgMsg && <div className="admin-feedback">{clearCgMsg}</div>}
        </div>

      </div>

      {/* ── Signatures Database — full width ── */}
      <div className="admin-db-section">
        <div className="admin-db-header">
          <div className="admin-db-title">🗄 Signatures Database</div>
          <div className="admin-db-meta">{dbTotal} record{dbTotal !== 1 ? "s" : ""}</div>
          <button className="btn-db-refresh" onClick={() => fetchDbRows(dbPage)} disabled={dbLoading}>
            {dbLoading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>

        {dbMsg && <div className="admin-db-msg">{dbMsg}</div>}

        <div className="admin-db-table-wrap">
          <table className="admin-db-table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th className="col-name">Name</th>
                <th className="col-time">Submitted</th>
                <th className="col-sig">Sig</th>
                <th className="col-cg" title="Chief Guest">★</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dbRows.length === 0 && !dbLoading && (
                <tr><td colSpan={6} className="db-empty">No signatures in database yet.</td></tr>
              )}
              {dbRows.map((row, idx) => {
                const rowNum = dbPage * PAGE_SIZE + idx + 1;
                const dt = new Date(row.timestamp);
                const dateStr = dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                const timeStr = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                const isEditing = editingId === row.id;
                const isDeleting = deletingId === row.id;

                return (
                  <tr key={row.id} className={`${isDeleting ? "row-deleting" : ""} ${row.is_chief_guest ? "row-cg" : ""}`}>
                    <td className="col-num">{rowNum}</td>
                    <td className="col-name">
                      {isEditing ? (
                        <div className="db-edit-row">
                          <input
                            className="db-name-input"
                            value={editName}
                            maxLength={60}
                            autoFocus
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSave(row.id);
                              if (e.key === "Escape") handleEditCancel();
                            }}
                          />
                          <button className="btn-db-save" onClick={() => handleEditSave(row.id)}>Save</button>
                          <button className="btn-db-cancel" onClick={handleEditCancel}>Cancel</button>
                        </div>
                      ) : (
                        <span className="db-name-text">{row.name}</span>
                      )}
                    </td>
                    <td className="col-time">
                      <span className="db-date">{dateStr}</span>
                      <span className="db-time">{timeStr}</span>
                    </td>
                    <td className="col-sig">
                      <span className={`db-sig-badge ${row.has_sig ? "has-sig" : "no-sig"}`}>
                        {row.has_sig ? "✓" : "—"}
                      </span>
                    </td>
                    <td className="col-cg">
                      <span className={`db-cg-badge ${row.is_chief_guest ? "is-cg" : "not-cg"}`}>★</span>
                    </td>
                    <td className="col-actions">
                      <div className="db-action-btns">
                        {!isEditing && (
                          <button className="btn-db-edit" title="Edit name" onClick={() => handleEditStart(row)}>✏</button>
                        )}
                        {row.has_sig && (
                          <button className="btn-db-dl" title="Download signature image" onClick={() => handleDownloadImage(row)}>⬇</button>
                        )}
                        <button
                          className={`btn-db-cg${row.is_chief_guest ? " active" : ""}`}
                          title={row.is_chief_guest ? "Unmark as Chief Guest" : "Mark as Chief Guest"}
                          onClick={() => handleToggleCg(row)}
                        >★</button>
                        <button className="btn-db-del" title="Delete" disabled={isDeleting} onClick={() => handleDbDelete(row)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="admin-db-pagination">
            <button className="btn-db-page" disabled={dbPage === 0} onClick={() => handleDbPageChange(dbPage - 1)}>← Prev</button>
            <span className="db-page-info">Page {dbPage + 1} of {totalPages}</span>
            <button className="btn-db-page" disabled={dbPage >= totalPages - 1} onClick={() => handleDbPageChange(dbPage + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

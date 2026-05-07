import React, { useState, useCallback } from "react";
import { NameInput } from "../components/NameInput";
import { SignatureCanvas } from "../components/SignatureCanvas";

type Status = "idle" | "submitting" | "success" | "error";

export function InputPage(): React.ReactElement {
  const [name, setName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [canvasResetToken, setCanvasResetToken] = useState(0);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, signature: signatureData }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "Unknown error" }));
        const detail = body.detail;
        throw new Error(typeof detail === "string" ? detail : "Submission failed");
      }

      setStatus("success");
      setName("");
      setSignatureData(null);
      setCanvasResetToken((t) => t + 1);
      setTimeout(() => setStatus("idle"), 3500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Submission failed");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }, [name, signatureData]);

  const isSubmitting = status === "submitting";

  return (
    <div className="input-page">
      <header className="input-header">
        <img src="/nlclogo70th.png" alt="NLC 70th Anniversary" className="nlc-logo" />
        <div className="event-badge">NLC Neyveli Book Fair</div>
        <h1 className="input-title">Live Sign Wall</h1>
        <p className="input-sub">Sign your name and appear on the big screen!</p>
      </header>

      <main className="input-form">
        <NameInput value={name} onChange={setName} disabled={isSubmitting} />
        <SignatureCanvas
          onExport={setSignatureData}
          disabled={isSubmitting}
          resetToken={canvasResetToken}
        />

        <button
          className="btn-submit"
          onClick={handleSubmit}
          disabled={isSubmitting || name.trim().length === 0}
        >
          {isSubmitting ? "Submitting…" : "✦ Submit to Wall"}
        </button>

        {status === "success" && (
          <div className="feedback success">
            🎉 Your name is now on the wall!
          </div>
        )}
        {status === "error" && (
          <div className="feedback error">{errorMsg}</div>
        )}
      </main>

      <footer className="input-footer">
        <a href="/display" className="display-link" target="_blank" rel="noreferrer">
          View Display Wall →
        </a>
      </footer>
    </div>
  );
}

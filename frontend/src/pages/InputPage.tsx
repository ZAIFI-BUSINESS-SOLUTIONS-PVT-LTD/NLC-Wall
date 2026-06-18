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
  // Captured before name is cleared so the success overlay can show it
  const [lastSubmittedName, setLastSubmittedName] = useState("");

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

      setLastSubmittedName(trimmed); // capture before clearing
      setStatus("success");
      setName("");
      setSignatureData(null);
      setCanvasResetToken((t) => t + 1);
      // 5000ms — long enough to walk to the display wall and find your card
      setTimeout(() => setStatus("idle"), 5000);
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
        <p className="input-sub">Write anything and appear on the big screen!</p>
      </header>

      <main className="input-form">
        {status === "success" ? (
          // Full-card ceremony overlay — replaces form on success.
          // Tells the person exactly what happened and where to look.
          <div className="success-overlay">
            <div className="success-check">✓</div>
            <div className="success-headline">You're on the wall!</div>
            <div className="success-name">{lastSubmittedName}</div>
            <div className="success-sub">Your name is now floating on the big screen!</div>
            <div className="success-look">👆 Look at the display wall now</div>
          </div>
        ) : (
          <>
            <NameInput
              value={name}
              onChange={setName}
              onDone={handleSubmit}
              disabled={isSubmitting}
            />
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

            {status === "error" && (
              <div className="feedback error">{errorMsg}</div>
            )}
          </>
        )}
      </main>

    </div>
  );
}

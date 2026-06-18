import React, { useRef, useEffect, useCallback, useState } from "react";
import SignaturePad from "signature_pad";

interface Props {
  onExport: (dataUrl: string | null) => void;
  disabled?: boolean;
  resetToken?: number;
}

export function SignatureCanvas({ onExport, disabled, resetToken }: Props): React.ReactElement {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const padRef      = useRef<SignaturePad | null>(null);
  // Stable ref so event handlers always call the latest onExport without
  // triggering effect re-runs (which would destroy/recreate the pad).
  const onExportRef = useRef(onExport);
  onExportRef.current = onExport;

  const [hasDrawn, setHasDrawn] = useState(false);
  const [canUndo,  setCanUndo]  = useState(false);

  // Resize the canvas bitmap to match its current CSS size + DPR.
  // Preserves existing strokes by saving/restoring pad data.
  // Called on mount and on every ResizeObserver notification (orientation change, etc.).
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const pad    = padRef.current;
    if (!canvas) return;

    const dpr  = Math.max(window.devicePixelRatio || 1, 1);
    const logW = canvas.offsetWidth;
    const logH = canvas.offsetHeight;
    if (!logW || !logH) return; // not yet laid out

    const data = pad?.toData() ?? [];

    canvas.width  = Math.round(logW * dpr);
    canvas.height = Math.round(logH * dpr);
    canvas.getContext("2d")!.scale(dpr, dpr);

    // signature_pad must be told about the new size so it recalculates its
    // internal scale; fromData() then redraws strokes at the new dimensions.
    if (pad) {
      pad.clear();
      if (data.length > 0) pad.fromData(data);
    }
  }, []);

  // Mount: create the pad and wire up a ResizeObserver.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initial size
    const dpr  = Math.max(window.devicePixelRatio || 1, 1);
    const logW = canvas.offsetWidth || 560;
    const logH = canvas.offsetHeight || 260;
    canvas.width  = Math.round(logW * dpr);
    canvas.height = Math.round(logH * dpr);
    canvas.getContext("2d")!.scale(dpr, dpr);

    const pad = new SignaturePad(canvas, {
      penColor:  "#0d2060",
      minWidth:  1.5,
      maxWidth:  3,
    });
    padRef.current = pad;

    const handleStroke = () => {
      const strokes = pad.toData();
      const has     = strokes.length > 0;
      setHasDrawn(has);
      setCanUndo(has);
      onExportRef.current(pad.toDataURL("image/png"));
    };
    pad.addEventListener("afterUpdateStroke", handleStroke);

    // ResizeObserver keeps the canvas correctly sized across orientation changes,
    // window resizes, and any layout shifts (e.g. soft keyboard appearing).
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(canvas);

    return () => {
      pad.removeEventListener("afterUpdateStroke", handleStroke);
      pad.off();
      ro.disconnect();
      padRef.current = null;
    };
  }, [resizeCanvas]);

  // Reflect disabled prop without recreating the pad.
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    if (disabled) pad.off();
    else          pad.on();
  }, [disabled]);

  const clearCanvas = useCallback(() => {
    const pad = padRef.current;
    if (!pad) return;
    pad.clear();
    setHasDrawn(false);
    setCanUndo(false);
    onExportRef.current(null);
  }, []);

  const undoStroke = useCallback(() => {
    const pad = padRef.current;
    if (!pad) return;
    const data = pad.toData();
    if (data.length === 0) return;
    data.pop();
    pad.fromData(data);
    const still = data.length > 0;
    setHasDrawn(still);
    setCanUndo(still);
    onExportRef.current(still ? pad.toDataURL("image/png") : null);
  }, []);

  useEffect(() => {
    if (resetToken !== undefined && resetToken > 0) clearCanvas();
  }, [resetToken, clearCanvas]);

  return (
    <div className="sig-canvas-wrap">
      <div className="sig-header">
        <span className="sig-label">Signature</span>
        <span className="sig-optional">Optional</span>
      </div>
      <div className="sig-face-wrap">
        {/* No width/height attrs — resizeCanvas sets them from offsetWidth/Height */}
        <canvas ref={canvasRef} className="sig-canvas" />
      </div>
      {(hasDrawn || canUndo) && (
        <div className="sig-actions">
          {canUndo && (
            <button type="button" onClick={undoStroke} className="btn-clear">↩ Undo</button>
          )}
          {hasDrawn && (
            <button type="button" onClick={clearCanvas} className="btn-clear">Clear</button>
          )}
        </div>
      )}
    </div>
  );
}

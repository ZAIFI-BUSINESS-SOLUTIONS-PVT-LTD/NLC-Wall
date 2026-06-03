import React, { useRef, useEffect, useCallback, useState } from "react";
import { scaleFacePath } from "../utils/faces";

interface Props {
  onExport: (dataUrl: string | null) => void;
  disabled?: boolean;
  resetToken?: number;
}

// Face style 0 (classic oval) is fixed for the tablet drawing guide.
const TABLET_FACE_STYLE = 0;

export function SignatureCanvas({ onExport, disabled, resetToken }: Props): React.ReactElement {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const guideRef   = useRef<HTMLCanvasElement>(null);
  const faceRef    = useRef<Path2D | null>(null);
  const prevRef    = useRef<[number, number] | null>(null);
  const drawing    = useRef(false);
  const historyRef = useRef<ImageData[]>([]);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [canUndo,  setCanUndo]  = useState(false);

  // Build canvas-space face path from the canvas logical dimensions.
  function buildFacePath(logW: number, logH: number): Path2D {
    const cx = logW / 2;
    const cy = logH * 0.47;
    const hw = Math.min(logW * 0.165, 96);
    const hh = Math.min(logH * 0.43,  118);
    return scaleFacePath(TABLET_FACE_STYLE, cx, cy, hw, hh);
  }

  function drawGuide(gCtx: CanvasRenderingContext2D, fp: Path2D): void {
    gCtx.clearRect(0, 0, gCtx.canvas.width, gCtx.canvas.height);
    // Subtle dashed face outline for drawing guidance
    gCtx.save();
    gCtx.strokeStyle = "rgba(0,60,180,0.22)";
    gCtx.lineWidth   = 1.5;
    gCtx.setLineDash([5, 5]);
    gCtx.stroke(fp);
    gCtx.setLineDash([]);
    // Very subtle interior tint to show the drawing zone
    gCtx.fillStyle = "rgba(0,60,180,0.04)";
    gCtx.fill(fp);
    gCtx.restore();
  }

  // Initialize canvases after mount (handles DPR scaling).
  useEffect(() => {
    const canvas = canvasRef.current;
    const guide  = guideRef.current;
    if (!canvas || !guide) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const logW = rect.width  || canvas.width;
    const logH = rect.height || canvas.height;

    // Scale drawing canvas buffer
    canvas.width  = Math.round(logW * dpr);
    canvas.height = Math.round(logH * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // Scale guide canvas buffer to match
    guide.width  = Math.round(logW * dpr);
    guide.height = Math.round(logH * dpr);
    const gCtx = guide.getContext("2d")!;
    gCtx.scale(dpr, dpr);

    // Build and cache face path in logical coords
    const fp = buildFacePath(logW, logH);
    faceRef.current = fp;
    drawGuide(gCtx, fp);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    setHasDrawn(false);
    setCanUndo(false);
    onExport(null);
    // Re-draw guide (stays on guide canvas — nothing to refresh here)
  }, [onExport]);

  const undoStroke = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length === 0) return;
    const ctx = canvas.getContext("2d")!;
    const prev = historyRef.current.pop()!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(prev, 0, 0);
    const still = historyRef.current.length > 0;
    setHasDrawn(still);
    setCanUndo(still);
    onExport(still ? canvas.toDataURL("image/png") : null);
  }, [onExport]);

  useEffect(() => {
    if (resetToken !== undefined && resetToken > 0) clearCanvas();
  }, [resetToken, clearCanvas]);

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) * (canvas.width  / rect.width),
      (e.clientY - rect.top)  * (canvas.height / rect.height),
    ];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let exportPending = false;
    const scheduleExport = () => {
      if (exportPending) return;
      exportPending = true;
      requestAnimationFrame(() => {
        exportPending = false;
        onExport(canvas.toDataURL("image/png"));
      });
    };

    const startDraw = (x: number, y: number) => {
      if (disabled) return;
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (historyRef.current.length > 20) historyRef.current.shift();
      drawing.current = true;
      prevRef.current = [x, y];
    };

    const continueDraw = (x: number, y: number) => {
      if (!drawing.current || disabled || !prevRef.current) return;
      const [px, py] = prevRef.current;
      ctx.save();
      // Clip strokes to face shape so nothing bleeds outside the frame
      if (faceRef.current) ctx.clip(faceRef.current);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.strokeStyle = "#0d2060";
      ctx.lineWidth   = 3;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";
      ctx.stroke();
      ctx.restore();
      prevRef.current = [x, y];
      setHasDrawn(true);
      setCanUndo(true);
      scheduleExport();
    };

    const stopDraw = () => {
      drawing.current = false;
      prevRef.current = null;
    };

    const onMouseDown  = (e: MouseEvent)  => startDraw(...getPos(e, canvas));
    const onMouseMove  = (e: MouseEvent)  => continueDraw(...getPos(e, canvas));
    const onTouchStart = (e: TouchEvent)  => { e.preventDefault(); startDraw(...getPos(e.touches[0], canvas)); };
    const onTouchMove  = (e: TouchEvent)  => { e.preventDefault(); continueDraw(...getPos(e.touches[0], canvas)); };

    canvas.addEventListener("mousedown",  onMouseDown);
    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("mouseup",    stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove",  onTouchMove,  { passive: false });
    canvas.addEventListener("touchend",   stopDraw);

    return () => {
      canvas.removeEventListener("mousedown",  onMouseDown);
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("mouseup",    stopDraw);
      canvas.removeEventListener("mouseleave", stopDraw);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove",  onTouchMove);
      canvas.removeEventListener("touchend",   stopDraw);
    };
  }, [disabled, onExport]);

  return (
    <div className="sig-canvas-wrap">
      <div className="sig-header">
        <span className="sig-label">Signature</span>
        <span className="sig-optional">Optional</span>
      </div>
      <div className="sig-face-wrap">
        {/* Drawing canvas — face-clipped strokes, this is what gets exported */}
        <canvas ref={canvasRef} width={560} height={260} className="sig-canvas" />
        {/* Guide overlay — face outline only, not exported, pointer-events:none */}
        <canvas ref={guideRef}  width={560} height={260} className="sig-face-guide" />
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

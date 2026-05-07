import React, { useRef, useEffect, useCallback, useState } from "react";

interface Props {
  onExport: (dataUrl: string | null) => void;
  disabled?: boolean;
  resetToken?: number;
}

export function SignatureCanvas({ onExport, disabled, resetToken }: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const historyRef = useRef<ImageData[]>([]);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    setHasDrawn(false);
    setCanUndo(false);
    onExport(null);
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

  // Scale canvas buffer to device pixel ratio so signatures are crisp on Retina/high-DPI tablets
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    if (dpr <= 1) return;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.getContext("2d")!.scale(dpr, dpr);
  }, []);

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) * (canvas.width / rect.width),
      (e.clientY - rect.top) * (canvas.height / rect.height),
    ];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const startDraw = (x: number, y: number) => {
      if (disabled) return;
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (historyRef.current.length > 20) historyRef.current.shift();
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const continueDraw = (x: number, y: number) => {
      if (!drawing.current || disabled) return;
      ctx.lineTo(x, y);
      ctx.strokeStyle = "#0d2060";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      setHasDrawn(true);
      setCanUndo(true);
      onExport(canvas.toDataURL("image/png"));
    };

    const stopDraw = () => { drawing.current = false; };

    const onMouseDown = (e: MouseEvent) => startDraw(...getPos(e, canvas));
    const onMouseMove = (e: MouseEvent) => continueDraw(...getPos(e, canvas));
    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); startDraw(...getPos(e.touches[0], canvas)); };
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); continueDraw(...getPos(e.touches[0], canvas)); };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", stopDraw);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", stopDraw);
      canvas.removeEventListener("mouseleave", stopDraw);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", stopDraw);
    };
  }, [disabled, onExport]);

  return (
    <div className="sig-canvas-wrap">
      <div className="sig-label">Signature</div>
      <canvas ref={canvasRef} width={560} height={200} className="sig-canvas" />
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

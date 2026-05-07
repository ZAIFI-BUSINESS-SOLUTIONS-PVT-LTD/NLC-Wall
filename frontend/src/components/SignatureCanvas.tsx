import React, { useRef, useEffect, useCallback, useState } from "react";

interface Props {
  onExport: (dataUrl: string | null) => void;
  disabled?: boolean;
  resetToken?: number; // increment to clear the canvas externally
}

export function SignatureCanvas({ onExport, disabled, resetToken }: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onExport(null);
  }, [onExport]);

  // External reset trigger
  useEffect(() => {
    if (resetToken !== undefined && resetToken > 0) clearCanvas();
  }, [resetToken, clearCanvas]);

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
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const continueDraw = (x: number, y: number) => {
      if (!drawing.current || disabled) return;
      ctx.lineTo(x, y);
      ctx.strokeStyle = "#1a1550";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      setHasDrawn(true);
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
      <div className="sig-label">
        Signature <span className="optional">(optional)</span>
      </div>
      <canvas ref={canvasRef} width={560} height={200} className="sig-canvas" />
      {hasDrawn && (
        <button type="button" onClick={clearCanvas} className="btn-clear">Clear</button>
      )}
    </div>
  );
}

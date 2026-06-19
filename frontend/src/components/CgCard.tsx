import React, { useRef, useState, useEffect } from "react";
import { FONT_STACK, CG_NAME_FONT, scriptMultiplier } from "../utils/textSizing";

interface Props {
  name: string;
  signature?: string | null;
}

export function CgCard({ name, signature }: Props): React.ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [fontSize, setFontSize] = useState<number>(CG_NAME_FONT.base);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const avail = Math.max(el.clientWidth - 16, 40);
    const mult = scriptMultiplier(name);
    const max = Math.min(CG_NAME_FONT.max * mult, 20);
    const min = CG_NAME_FONT.min;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    let chosen = Math.round(CG_NAME_FONT.base * mult);
    chosen = Math.min(chosen, max);
    for (let fs = chosen; fs >= min; fs--) {
      ctx.font = `700 ${fs}px ${FONT_STACK}`;
      const w = ctx.measureText(name).width;
      if (w <= avail) {
        setFontSize(fs);
        return;
      }
    }
    setFontSize(min);
  }, [name]);

  return (
    <div className="cg-card" ref={rootRef}>
      {signature && (
        <img src={signature} className="cg-card-sig" alt="signature" />
      )}
      <div
        className="cg-card-name"
        style={{ fontSize: `${fontSize}px`, fontWeight: 700 }}
        title={name}
      >
        {name}
      </div>
    </div>
  );
}

export default CgCard;

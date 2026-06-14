import { useEffect, useState } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

/**
 * MascotCorner — cinematic news-ticker style mascot.
 *
 * Sequence per cycle:
 *   hidden 14 s → swoops in from bottom-right with bounce + glow →
 *   idles with float + bob + sparkles for 7 s →
 *   waves goodbye and slides out → repeat
 */

const HIDDEN_MS  = 14_000;
const VISIBLE_MS =  7_000;

// Sparkle positions (relative to mascot container)
const SPARKLES = [
  { id: 1, x: -18, y: 30,  size: 10, delay: 0.0 },
  { id: 2, x:  90, y: 10,  size:  7, delay: 0.3 },
  { id: 3, x: -10, y: 80,  size:  6, delay: 0.6 },
  { id: 4, x:  80, y: 60,  size:  9, delay: 0.9 },
  { id: 5, x:  40, y: -12, size:  8, delay: 0.15 },
  { id: 6, x: 105, y: 90,  size:  6, delay: 0.75 },
];

function Sparkle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <motion.div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        pointerEvents: "none",
      }}
      initial={{ scale: 0, opacity: 0, rotate: 0 }}
      animate={{
        scale:   [0, 1.4, 0.8, 1.2, 0],
        opacity: [0, 1,   0.7, 1,   0],
        rotate:  [0, 90, 180, 270, 360],
      }}
      transition={{
        duration: 2.2,
        delay,
        repeat: Infinity,
        repeatDelay: 1.8,
        ease: "easeInOut",
      }}
    >
      {/* 4-point star */}
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <path
          d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z"
          fill="#FFD700"
          stroke="#FFA500"
          strokeWidth="0.5"
        />
      </svg>
    </motion.div>
  );
}

export function MascotCorner() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const controls = useAnimation();

  useEffect(() => {
    let cancelled = false;

    const cycle = async () => {
      if (cancelled) return;

      // Wait hidden
      await new Promise(r => setTimeout(r, HIDDEN_MS));
      if (cancelled) return;

      setLeaving(false);
      setVisible(true);

      // Stay visible
      await new Promise(r => setTimeout(r, VISIBLE_MS));
      if (cancelled) return;

      // Trigger exit wave
      setLeaving(true);
      await new Promise(r => setTimeout(r, 800));
      if (cancelled) return;

      setVisible(false);

      // Loop
      cycle();
    };

    cycle();
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        right: 24,
        zIndex: 9999,
        pointerEvents: "none",
        width: 200,
        height: 300,
      }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key="mascot-wrapper"
            style={{ position: "absolute", bottom: 0, right: 0, width: "100%", height: "100%" }}
            // Entry: swoop up + rotate in from right
            initial={{ y: 320, x: 60, rotate: 12, scale: 0.6, opacity: 0 }}
            animate={
              leaving
                ? {
                    // Exit: lean back and wave goodbye, then slide down-right
                    y: 320,
                    x: 80,
                    rotate: -8,
                    scale: 0.7,
                    opacity: 0,
                    transition: { duration: 0.7, ease: [0.4, 0, 1, 1] },
                  }
                : {
                    y: 0,
                    x: 0,
                    rotate: 0,
                    scale: 1,
                    opacity: 1,
                    transition: {
                      type: "spring",
                      stiffness: 160,
                      damping: 16,
                      mass: 0.9,
                    },
                  }
            }
          >
            {/* Glow / spotlight behind mascot */}
            <motion.div
              style={{
                position: "absolute",
                bottom: -10,
                left: "50%",
                transform: "translateX(-50%)",
                width: 160,
                height: 160,
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse at center, rgba(255,200,50,0.35) 0%, rgba(255,140,0,0.12) 50%, transparent 75%)",
                filter: "blur(8px)",
                pointerEvents: "none",
              }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Idle float — the whole mascot gently bobs */}
            <motion.div
              animate={
                leaving
                  ? {}
                  : { y: [0, -10, 0] }
              }
              transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
              style={{ position: "relative" }}
            >
              {/* Sparkles */}
              {!leaving &&
                SPARKLES.map((s) => (
                  <Sparkle key={s.id} x={s.x} y={s.y} size={s.size} delay={s.delay} />
                ))}

              {/* Mascot image with idle tilt */}
              <motion.img
                src="/Mascot.webp"
                alt="Neyon the NLC mascot"
                animate={
                  leaving
                    ? { rotate: -15, scale: 0.85 }
                    : { rotate: [0, 2, -1, 2, 0] }
                }
                transition={
                  leaving
                    ? { duration: 0.5 }
                    : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
                }
                style={{
                  display: "block",
                  height: 260,
                  width: "auto",
                  objectFit: "contain",
                  filter:
                    "drop-shadow(0 8px 24px rgba(0,0,0,0.45)) drop-shadow(0 0 12px rgba(255,180,0,0.3))",
                  transformOrigin: "bottom center",
                }}
              />
            </motion.div>

            {/* Shadow ellipse on the ground */}
            <motion.div
              style={{
                position: "absolute",
                bottom: -4,
                left: "50%",
                transform: "translateX(-50%)",
                width: 90,
                height: 14,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.25)",
                filter: "blur(4px)",
              }}
              animate={{ scaleX: [1, 0.88, 1], opacity: [0.6, 0.4, 0.6] }}
              transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { unlockAudio, sfx } from "@/lib/sound";

const STATUSES = [
  "NEURAL CORE OFFLINE",
  "AWAITING INPUT",
  "INITIALIZE",
];

const HANDOFF_DELAY = 450;

export default function LandingScreen({
  onInit,
}: {
  onInit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [statusIdx, setStatusIdx] = useState(0);
  const [showBtn, setShowBtn] = useState(false);
  const [showText, setShowText] = useState(true);
  const [initializing, setInitializing] = useState(false);

  /* ================================================================
   * BACKGROUND PARTICLES
   * ================================================================ */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;

      canvas.width = W * dpr;
      canvas.height = H * dpr;

      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 70 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.3 + 0.3,
      a: Math.random() * 0.4 + 0.05,
      vx: (Math.random() - 0.5) * 0.06,
      vy: (Math.random() - 0.5) * 0.06,
    }));

    let raf = 0;

    function draw() {
      const W = window.innerWidth;
      const H = window.innerHeight;

      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        ctx.beginPath();
        ctx.fillStyle = `rgba(0,229,255,${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  /* ================================================================
   * STATUS SEQUENCE
   * ================================================================ */

  useEffect(() => {
    let i = 0;
    let textTimer: ReturnType<typeof setTimeout> | null = null;

    const iv = setInterval(() => {
      if (initializing) {
        clearInterval(iv);
        return;
      }

      i++;

      if (i < STATUSES.length) {
        setShowText(false);

        textTimer = setTimeout(() => {
          setStatusIdx(i);
          setShowText(true);
        }, 300);
      } else {
        clearInterval(iv);

        textTimer = setTimeout(() => {
          if (!initializing) {
            setShowBtn(true);
          }
        }, 500);
      }
    }, 1300);

    return () => {
      clearInterval(iv);
      if (textTimer) clearTimeout(textTimer);
    };
  }, [initializing]);

  /* ================================================================
   * INITIALIZE
   * ================================================================ */

  const handleInit = async () => {
    if (initializing) return;

    setInitializing(true);
    setShowBtn(false);
    setShowText(false);

    /*
     * This click is a genuine browser user gesture.
     *
     * Unlock Web Audio first, then immediately play
     * the real boot-up sound.
     */
    await unlockAudio();

    sfx.boot();

    /*
     * Keep the central core visible briefly so the
     * landing screen hands off smoothly to the
     * ActivationSequence.
     */
    initTimerRef.current = setTimeout(() => {
      onInit();
    }, HANDOFF_DELAY);
  };

  /* ================================================================
   * CLEANUP
   * ================================================================ */

  useEffect(() => {
    return () => {
      if (initTimerRef.current) {
        clearTimeout(initTimerRef.current);
      }
    };
  }, []);

  /* ================================================================
   * RENDER
   * ================================================================ */

  return (
    <div
      className="fixed inset-0 z-[800] flex flex-col items-center justify-center bg-bg"
      style={{
        pointerEvents: initializing ? "none" : "auto",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* ==========================================================
            NEURAL CORE
            ========================================================== */}

        <div
          className="core-pulse h-2.5 w-2.5 rounded-full bg-cyan"
          style={{
            opacity: 1,
          }}
        />

        {/* ==========================================================
            STATUS
            ========================================================== */}

        <div
          role="status"
          aria-live="polite"
          className="min-h-[18px] font-mono text-xs uppercase tracking-[3px] text-dim transition-opacity duration-300"
          style={{
            opacity:
              showText && !showBtn && !initializing
                ? 1
                : 0,
          }}
        >
          {STATUSES[statusIdx]}
        </div>

        {/* ==========================================================
            INITIALIZE BUTTON
            ========================================================== */}

        <button
          type="button"
          onClick={handleInit}
          disabled={initializing}
          className="border border-cyan/30 bg-cyan/[0.03] px-8 py-3.5 font-mono text-[13px] uppercase tracking-[4px] text-white transition-all duration-300 hover:border-cyan hover:bg-cyan/[0.08] hover:shadow-[0_0_24px_rgba(0,229,255,0.25)]"
          style={{
            opacity:
              showBtn && !initializing
                ? 1
                : 0,

            pointerEvents:
              showBtn && !initializing
                ? "auto"
                : "none",

            transform: initializing
              ? "translateY(8px)"
              : "translateY(0)",

            transition:
              "opacity 300ms ease, transform 300ms ease",
          }}
        >
          Click to Initialize
        </button>
      </div>
    </div>
  );
}
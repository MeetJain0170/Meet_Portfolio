"use client";

import React, { useCallback, useEffect, useRef } from "react";

/**
 * FlashTransition.tsx
 * 
 * High-performance, zero-lag cinematic white flash and wandering cyan node explosion.
 * Features full-screen spatial distribution and 5-second drunk-walk Brownian motion.
 */

interface Particle {
  x: number;          // Initial X across full viewport
  y: number;          // Initial Y across full viewport
  vx: number;         // Primary trajectory vector X
  vy: number;         // Primary trajectory vector Y
  size: number;
  alpha: number;
  seed: number;       // Per-particle noise seed for erratic wandering
  wanderSpeed: number;// Intensity of directional drift
  angle: number;      // Evolving trajectory heading
}

// Timing Constants
const FLASH_IN_MS = 60;      // Instant peak white (~60ms)
const WHITE_HOLD_MS = 0;     // Immediate transition into fade
const FADE_OUT_MS = 5000;    // Extended 5-second fade duration

// Particle Allocation
const PARTICLE_COUNT_DESKTOP = 120;
const PARTICLE_COUNT_MOBILE = 60;

const TAU = Math.PI * 2;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function useFlash() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const callbackRef = useRef<(() => void) | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef(0);

  const dimensionsRef = useRef({
    width: 0,
    height: 0,
    dpr: 1,
  });

  const cleanup = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    for (const timer of timersRef.current) {
      clearTimeout(timer);
    }
    timersRef.current = [];
    callbackRef.current = null;
  }, []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    dimensionsRef.current = { width, height, dpr };
  }, []);

  /*
   * Instantiate Particles Across Entire Viewport (Corners + Edges Included)
   */
  const createParticles = useCallback(() => {
    const { width, height } = dimensionsRef.current;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const count = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;

    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      // Uniform random coverage including strict boundaries/margins
      const x = randomBetween(-20, width + 20);
      const y = randomBetween(-20, height + 20);

      const angle = Math.random() * TAU;
      const speed = randomBetween(0.3, 0.8);
      const depth = Math.random();

      let size: number;
      let alpha: number;

      if (depth < 0.35) {
        size = randomBetween(1.2, 1.8);
        alpha = randomBetween(0.55, 0.75);
      } else if (depth < 0.8) {
        size = randomBetween(1.8, 2.6);
        alpha = randomBetween(0.75, 0.95);
      } else {
        size = randomBetween(2.6, 3.6);
        alpha = randomBetween(0.95, 1.0);
      }

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        alpha,
        seed: Math.random() * 1000,
        wanderSpeed: randomBetween(0.015, 0.045), // Turning velocity
        angle,
      });
    }

    particlesRef.current = particles;
  }, []);

  /*
   * 60 FPS Engine with Drunken Brownian Motion Algorithm
   */
  const animateParticles = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = dimensionsRef.current;
    const elapsed = timestamp - startTimeRef.current;
    const progress = Math.min(elapsed / FADE_OUT_MS, 1);

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particlesRef.current.length; i++) {
      const p = particlesRef.current[i];

      // Drunk wander calculation: Continuously alter trajectory angle over time
      const noise =
        Math.sin(p.seed + elapsed * 0.002) *
        Math.cos(p.seed * 0.5 + elapsed * 0.0015);

      p.angle += noise * p.wanderSpeed;

      // Update position with dynamic erratic vector components
      p.x += Math.cos(p.angle) * (p.vx + Math.sin(elapsed * 0.003) * 0.2);
      p.y += Math.sin(p.angle) * (p.vy + Math.cos(elapsed * 0.003) * 0.2);

      // Smooth multi-stage fade matching the 5-second backdrop decay
      let particleFade = 1;
      if (progress > 0.5) {
        const fadeProgress = (progress - 0.5) / 0.5;
        particleFade = 1 - easeOutCubic(fadeProgress);
      }

      const alpha = p.alpha * particleFade;

      if (alpha <= 0) continue;

      // Draw sharp cyan node (#00e5ff)
      ctx.beginPath();
      ctx.fillStyle = `rgba(0, 229, 255, ${alpha})`;
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();

      if (p.size > 2.2 && alpha > 0.5) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.28})`;
        ctx.arc(
          p.x,
          p.y,
          Math.max(0.7, p.size * 0.35),
          0,
          TAU
        );
        ctx.fill();
      }
    }

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animateParticles);
    } else {
      animationRef.current = null;
      ctx.clearRect(0, 0, width, height);
    }
  }, []);

  const trigger = useCallback(
    (onPeak?: () => void) => {
      cleanup();
      setupCanvas();
      createParticles();

      callbackRef.current = onPeak ?? null;

      const container = containerRef.current;
      if (!container) return;

      // Rapid Flash In
      container.style.transition = `opacity ${FLASH_IN_MS}ms cubic-bezier(0,0,0.2,1)`;
      container.style.opacity = "1";

      const flashTimer = setTimeout(() => {
        callbackRef.current?.();
        callbackRef.current = null;

        const holdTimer = setTimeout(() => {
          // Extended 5-second continuous fade
          if (container) {
            container.style.transition = `opacity ${FADE_OUT_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
            container.style.opacity = "0";
          }

          startTimeRef.current = performance.now();
          animationRef.current = requestAnimationFrame(animateParticles);

          const finishTimer = setTimeout(() => {
            if (animationRef.current !== null) {
              cancelAnimationFrame(animationRef.current);
              animationRef.current = null;
            }
            timersRef.current = [];
          }, FADE_OUT_MS + 20);

          timersRef.current.push(finishTimer);
        }, WHITE_HOLD_MS);

        timersRef.current.push(holdTimer);
      }, FLASH_IN_MS);

      timersRef.current.push(flashTimer);
    },
    [cleanup, setupCanvas, createParticles, animateParticles]
  );

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const Flash = useCallback(() => {
    return (
      <div
        ref={containerRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[870]"
        style={{
          pointerEvents: "none",
          contain: "strict",
          opacity: 0,
          willChange: "opacity",
        }}
      >
        <div className="absolute inset-0 bg-white" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full pointer-events-none"
          aria-hidden="true"
        />
      </div>
    );
  }, []);

  return {
    trigger,
    Flash,
  };
}
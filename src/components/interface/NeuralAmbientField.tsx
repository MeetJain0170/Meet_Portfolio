"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  phase: number;
  size: number;
  energy: number;
};

type EventNode = {
  particle: number;
  target: number;
  progress: number;
  life: number;
};

const TAU = Math.PI * 2;

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function NeuralAmbientField({
  reducedMotion = false,
  intensity = 0,
}: {
  reducedMotion?: boolean;
  intensity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const mouse = useRef({
    x: -1000,
    y: -1000,
    active: false,
  });

  const intensityRef = useRef(intensity);

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;

    const particles: Particle[] = [];
    const events: EventNode[] = [];

    let scanProgress = -1;
    let nextScan = 0;
    let nextEvent = 0;
    let lastTime = performance.now();

    const particleCount = () => {
      if (width < 700) return 24;
      if (width < 1100) return 34;
      return 46;
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      // Never let high-DPI displays explode canvas cost.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const desired = particleCount();

      while (particles.length < desired) {
        const x = random(0, width);
        const y = random(0, height);

        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: random(-0.025, 0.025),
          vy: random(-0.025, 0.025),
          phase: random(0, TAU),
          size: random(0.7, 1.8),
          energy: random(0.2, 0.8),
        });
      }

      particles.length = desired;
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      mouse.current.x = event.clientX;
      mouse.current.y = event.clientY;
      mouse.current.active = true;
    };

    const onPointerLeave = () => {
      mouse.current.active = false;
    };

    window.addEventListener("pointermove", onPointerMove, {
      passive: true,
    });

    document.addEventListener("mouseleave", onPointerLeave);

    const schedule = (time: number) => {
      if (scanProgress < 0 && time >= nextScan) {
        scanProgress = -0.12;
        nextScan = time + random(9000, 15000);
      }

      if (time >= nextEvent) {
        if (particles.length > 2) {
          const particle = Math.floor(
            Math.random() * particles.length
          );

          let target = Math.floor(
            Math.random() * particles.length
          );

          if (target === particle) {
            target = (target + 1) % particles.length;
          }

          events.push({
            particle,
            target,
            progress: 0,
            life: 1,
          });
        }

        nextEvent = time + random(4500, 11000);
      }
    };

    const drawParticle = (
      particle: Particle,
      alpha: number,
      color: string,
      radiusMultiplier = 1
    ) => {
      ctx.beginPath();

      ctx.arc(
        particle.x,
        particle.y,
        particle.size * radiusMultiplier,
        0,
        TAU
      );

      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    };

    const drawScan = (time: number) => {
      if (scanProgress < 0) return;

      scanProgress += 0.0011 * (time - lastTime);

      if (scanProgress > 1.15) {
        scanProgress = -1;
        return;
      }

      const x = scanProgress * (width + 160) - 80;

      const gradient = ctx.createLinearGradient(
        x - 100,
        0,
        x + 100,
        0
      );

      gradient.addColorStop(
        0,
        "rgba(0,229,255,0)"
      );

      gradient.addColorStop(
        0.48,
        "rgba(0,229,255,0.035)"
      );

      gradient.addColorStop(
        0.5,
        "rgba(0,229,255,0.22)"
      );

      gradient.addColorStop(
        0.52,
        "rgba(0,229,255,0.035)"
      );

      gradient.addColorStop(
        1,
        "rgba(0,229,255,0)"
      );

      ctx.fillStyle = gradient;
      ctx.globalAlpha = 1;
      ctx.fillRect(x - 100, 0, 200, height);

      ctx.fillStyle = "rgba(0,229,255,0.3)";
      ctx.fillRect(x, 0, 1, height);
    };

    const drawEvents = () => {
      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];

        const source = particles[event.particle];
        const target = particles[event.target];

        if (!source || !target) {
          events.splice(i, 1);
          continue;
        }

        event.progress += 0.008;

        const fade =
          Math.sin(event.progress * Math.PI);

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        ctx.strokeStyle = "rgba(0,229,255,0.12)";
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = fade;
        ctx.stroke();

        const px =
          source.x +
          (target.x - source.x) * event.progress;

        const py =
          source.y +
          (target.y - source.y) * event.progress;

        ctx.beginPath();
        ctx.arc(px, py, 1.7, 0, TAU);

        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.shadowColor = "rgba(0,229,255,0.9)";
        ctx.shadowBlur = 7;
        ctx.globalAlpha = fade;
        ctx.fill();

        ctx.shadowBlur = 0;

        if (event.progress >= 1) {
          events.splice(i, 1);
        }
      }
    };

    const draw = (time: number) => {
      if (!running) return;

      const dt = Math.min(
        time - lastTime,
        32
      );

      lastTime = time;

      schedule(time);

      ctx.clearRect(0, 0, width, height);

      const mouseX = mouse.current.x;
      const mouseY = mouse.current.y;
      const mouseActive = mouse.current.active;

      const cursorRadius = 150;
      const cursorRadiusSq =
        cursorRadius * cursorRadius;

      const breathing =
        reducedMotion
          ? 0
          : Math.sin(time * 0.00055) * 2;

      /*
       * PARTICLES
       *
       * Only particles close to the cursor perform
       * distance calculations. The rest simply breathe.
       */
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.phase += dt * 0.00035;

        const ambientX =
          Math.sin(p.phase) * 0.18;

        const ambientY =
          Math.cos(p.phase * 0.8) * 0.18;

        p.baseX += p.vx * dt;
        p.baseY += p.vy * dt;

        /*
         * Wrap instead of respawning.
         * This prevents visual popping.
         */
        if (p.baseX < -20) p.baseX = width + 20;
        if (p.baseX > width + 20) p.baseX = -20;
        if (p.baseY < -20) p.baseY = height + 20;
        if (p.baseY > height + 20) p.baseY = -20;

        let targetX =
          p.baseX + ambientX + breathing * 0.03;

        let targetY =
          p.baseY + ambientY + breathing * 0.03;

        let cursorEnergy = 0;

        if (mouseActive) {
          const dx = mouseX - p.baseX;
          const dy = mouseY - p.baseY;

          const distanceSq =
            dx * dx + dy * dy;

          if (distanceSq < cursorRadiusSq) {
            const distance =
              Math.sqrt(distanceSq) || 1;

            const influence =
              1 - distance / cursorRadius;

            cursorEnergy = influence;

            /*
             * Very small electromagnetic attraction.
             * No violent particle movement.
             */
            const force =
              influence *
              influence *
              0.22;

            targetX += dx / distance * force * 18;
            targetY += dy / distance * force * 18;

            /*
             * Cursor connections.
             */
            if (influence > 0.55) {
              ctx.beginPath();
              ctx.moveTo(p.baseX, p.baseY);
              ctx.lineTo(mouseX, mouseY);

              ctx.strokeStyle =
                "rgba(0,229,255,0.035)";

              ctx.lineWidth = 0.5;
              ctx.globalAlpha =
                influence * 0.55;

              ctx.stroke();
            }
          }
        }

        /*
         * Smooth movement.
         *
         * This is deliberately low-pass filtered.
         * No guitar-string vibration.
         */
        p.x +=
          (targetX - p.x) *
          Math.min(1, dt * 0.0022);

        p.y +=
          (targetY - p.y) *
          Math.min(1, dt * 0.0022);

        const alpha =
          0.12 +
          p.energy * 0.12 +
          cursorEnergy * 0.48;

        const radius =
          p.size *
          (1 + cursorEnergy * 1.7);

        drawParticle(
          p,
          alpha,
          cursorEnergy > 0.15
            ? "rgba(0,229,255,0.95)"
            : "rgba(170,190,220,0.7)",
          radius / p.size
        );
      }

      /*
       * Sparse local neural connections.
       *
       * Only nearby particles are checked.
       * 46 particles means this is tiny computationally.
       */
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];

        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];

          const dx = a.x - b.x;
          const dy = a.y - b.y;

          const distanceSq =
            dx * dx + dy * dy;

          if (distanceSq > 120 * 120) continue;

          const distance =
            Math.sqrt(distanceSq);

          if (distance > 120) continue;

          const alpha =
            (1 - distance / 120) * 0.045;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);

          ctx.strokeStyle =
            "rgba(138,43,255,0.35)";

          ctx.globalAlpha = alpha;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      drawEvents();
      drawScan(time);

      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else {
        running = true;
        lastTime = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    nextScan =
      performance.now() + random(5000, 9000);

    nextEvent =
      performance.now() + random(3000, 7000);

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);

      window.removeEventListener(
        "resize",
        resize
      );

      window.removeEventListener(
        "pointermove",
        onPointerMove
      );

      document.removeEventListener(
        "mouseleave",
        onPointerLeave
      );

      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[101]"
      style={{
        opacity: reducedMotion
          ? 0
          : 0.8 + Math.min(intensity, 1) * 0.1,
      }}
    />
  );
}
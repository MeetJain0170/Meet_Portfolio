"use client";

import { useEffect, useMemo, useState } from "react";
import { GraphNodeDef } from "@/lib/graph";
import { profile } from "@/data/profile";
import SoundToggle from "./SoundToggle";
import PeripheralNeuralField from "./PeripheralNeuralField";
import NeuralAmbientField from "./NeuralAmbientField";

function hashId(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function nodeIdFor(value: string) {
  return hashId(value).toString(16).toUpperCase().padStart(6, "0").slice(0, 6);
}

export default function SystemHUD({
  breadcrumb,
  onReturn,
  aboutActive,
  reducedMotion = false,
  interactionIntensity = 0,
  activatedId = null,
  onSelectBreadcrumb,
}: {
  breadcrumb: GraphNodeDef[];
  onReturn: () => void;
  aboutActive: boolean;
  /** Forwarded to PeripheralNeuralField; also relaxes the HUD's own motion. */
  reducedMotion?: boolean;
  /** 0..1 — briefly livens up the HUD + peripheral field on real activity. */
  interactionIntensity?: number;
  /** Current focused node id, used to derive a live-looking NODE_ID. */
  activatedId?: string | null;
  /** If provided, breadcrumb segments become clickable — jumps to that node. */
  onSelectBreadcrumb?: (id: string) => void;
}) {
  const nested = breadcrumb.length > 1;
  const activeCluster = breadcrumb[breadcrumb.length - 1]?.label ?? profile.name;

  const HUD = {
    text: "rgba(255,255,255,1)",
    mutedText: "rgba(255,255,255,0.92)",
    subtleText: "rgba(255,255,255,0.72)",
    panel: "rgba(0,0,0,0.78)",
    panelBorder: "rgba(255,255,255,0.42)",
    cyanBorder: "rgba(0,229,255,0.68)",
    violetBorder: "rgba(138,43,255,0.68)",
  };

  /* ---------------------------------------------------------------------
   * Entrance choreography — panels rise in staggered rather than popping
   * in all at once, matching the boot-sequence tone elsewhere in the app.
   * ------------------------------------------------------------------- */

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const riseStyle = (delayMs: number): React.CSSProperties =>
    reducedMotion
      ? {}
      : {
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(-6px)",
        transition: `opacity 420ms ease ${delayMs}ms, transform 420ms cubic-bezier(0.16,0.84,0.44,1) ${delayMs}ms`,
      };

  /* ---------------------------------------------------------------------
   * Reactive telemetry — a live-looking signal reading instead of a
   * hardcoded string, plus a NODE_ID actually derived from what's focused.
   * ------------------------------------------------------------------- */

  const [signal, setSignal] = useState(98.2);

  useEffect(() => {
    const iv = setInterval(() => {
      setSignal((v) => {
        const next = v + (Math.random() - 0.5) * 1.4;
        return Math.max(96.4, Math.min(99.6, next));
      });
    }, 1400);
    return () => clearInterval(iv);
  }, []);

  const nodeId = useMemo(
    () => nodeIdFor(activatedId ?? activeCluster),
    [activatedId, activeCluster]
  );

  const intensityGlow = Math.min(1, interactionIntensity);

  return (
    <>
      <PeripheralNeuralField
        aboutActive={aboutActive}
        reducedMotion={reducedMotion}
        intensity={interactionIntensity}
      />

      <NeuralAmbientField
        reducedMotion={reducedMotion}
        intensity={interactionIntensity}
      />

      {/* AMBIENT HUD ATMOSPHERE */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      >
        {/* Existing cyan corner glow */}
        <div
          className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(0,229,255,${0.085 + intensityGlow * 0.04
              }) 0%, rgba(0,229,255,0.03) 35%, transparent 70%)`,
            transition: "background 300ms ease",
          }}
        />

        {/* Existing violet corner glow */}
        <div
          className="absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(138,43,255,${0.09 + intensityGlow * 0.04
              }) 0%, rgba(138,43,255,0.03) 38%, transparent 72%)`,
            transition: "background 300ms ease",
          }}
        />

        {/* NEW — CENTRAL NEURAL AMBIENCE */}
        <div
          className="absolute inset-0"
          style={{
            background: `
        radial-gradient(
          circle at 50% 48%,
          rgba(0,229,255,0.045) 0%,
          rgba(0,229,255,0.018) 22%,
          transparent 52%
        ),
        radial-gradient(
          circle at 62% 42%,
          rgba(138,43,255,0.035) 0%,
          rgba(138,43,255,0.015) 24%,
          transparent 55%
        )
      `,
          }}
        />

        {/* NEW — SOFT CYAN BLOOM */}
        <div
          className="absolute -left-[10%] top-[35%] h-[520px] w-[520px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(0,229,255,0.035) 0%, rgba(0,229,255,0.012) 35%, transparent 70%)",
            filter: "blur(30px)",
            animation: "ambient-bloom-a 18s ease-in-out infinite alternate",
          }}
        />

        {/* NEW — SOFT VIOLET BLOOM */}
        <div
          className="absolute -right-[8%] top-[20%] h-[600px] w-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(138,43,255,0.04) 0%, rgba(138,43,255,0.012) 38%, transparent 72%)",
            filter: "blur(35px)",
            animation: "ambient-bloom-b 22s ease-in-out infinite alternate",
          }}
        />

        {/* Existing grid */}
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.055,
            backgroundImage: `
        linear-gradient(rgba(0,229,255,0.45) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,229,255,0.45) 1px, transparent 1px)
      `,
            backgroundSize: "64px 64px",
          }}
        />

        {/* Existing scanlines */}
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.035,
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(255,255,255,0.5) 4px)",
          }}
        />

        {/* Existing vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at center, transparent 35%, rgba(4,5,10,0.08) 75%, rgba(4,5,10,0.35) 100%)",
          }}
        />
      </div>

      {/* =========================================================
          TOP BAR — merged identity + status (was two separate boxes)
          ========================================================= */}

      <div
        className="fixed left-5 top-5 z-[200] select-none md:left-7 md:top-7"
        style={riseStyle(0)}
      >
        <div
          className="relative flex flex-col gap-3 px-4 py-3 backdrop-blur-[5px] sm:flex-row sm:items-center sm:gap-6"
          style={{
            background: HUD.panel,
            border: `1px solid ${HUD.cyanBorder}`,
            boxShadow: `
              inset 0 0 24px rgba(0,229,255,0.035),
              0 0 ${30 + intensityGlow * 14}px rgba(0,229,255,${0.055 + intensityGlow * 0.05
              })
            `,
            transition: "box-shadow 250ms ease",
          }}
        >
          <span
            className="absolute -left-px -top-px h-2 w-2"
            style={{
              borderLeft: "1px solid rgba(0,229,255,0.9)",
              borderTop: "1px solid rgba(0,229,255,0.9)",
            }}
          />

          {/* Identity */}
          <div>
            <div
              className="font-mono text-[10px] tracking-[2.5px]"
              style={{ color: HUD.text }}
            >
              {profile.name.toUpperCase()}{" "}
              <span style={{ color: HUD.subtleText }}>//</span>{" "}
              <b className="font-medium" style={{ color: "rgba(0,229,255,0.95)" }}>
                NEURAL CORE
              </b>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: "#00e5ff",
                  boxShadow: "0 0 9px rgba(0,229,255,1)",
                }}
              />
              <span
                className="font-mono text-[8px] tracking-[2px]"
                style={{ color: HUD.mutedText }}
              >
                SYSTEM INTERFACE
              </span>
            </div>
          </div>

          {/* Divider */}
          <span
            className="hidden h-8 w-px sm:block"
            style={{ background: "rgba(255,255,255,0.12)" }}
          />
        </div>



        {/* Breadcrumb — the discarded neural path, now an actual trail.
            Violet, per the color rule (location/telemetry). */}
        {nested && (
          <div
            className="mt-2 flex flex-wrap items-center gap-1.5 px-1 font-mono text-[9px] tracking-[1.5px]"
            style={riseStyle(90)}
          >
            {breadcrumb.map((node, i) => {
              const isLast = i === breadcrumb.length - 1;
              const clickable = !isLast && Boolean(onSelectBreadcrumb);

              return (
                <span key={node.id} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span style={{ color: "rgba(167,139,250,0.45)" }}>›</span>
                  )}
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => onSelectBreadcrumb?.(node.id)}
                      className="rounded-none outline-none transition-colors duration-150 hover:text-white focus-visible:ring-1 focus-visible:ring-violet-400/70"
                      style={{ color: "rgba(167,139,250,0.75)" }}
                    >
                      {node.label}
                    </button>
                  ) : (
                    <span
                      style={{
                        color: isLast
                          ? "rgba(167,139,250,0.95)"
                          : "rgba(167,139,250,0.6)",
                      }}
                    >
                      {node.label}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================
          NODE TELEMETRY — small violet pill, live-derived NODE_ID
          ========================================================= */}

      <div
        className="fixed right-5 top-5 z-[200] hidden select-none md:right-7 md:top-7 md:block"
        style={riseStyle(60)}
      >
        <div
          className="px-4 py-3 backdrop-blur-[5px]"
          style={{
            background: HUD.panel,
            border: `1px solid ${HUD.violetBorder}`,
            boxShadow: "inset 0 0 24px rgba(138,43,255,0.03)",
          }}
        >
          <div
            className="mb-2 font-mono text-[8px] tracking-[2.5px]"
            style={{ color: HUD.subtleText }}
          >
            NEURAL TELEMETRY
          </div>
          <div className="flex gap-5 font-mono text-[9px] tracking-[1.5px]">
            <span style={{ color: HUD.mutedText }}>
              NODE_ID:{" "}
              <b style={{ color: "rgba(167,139,250,0.95)" }}>{nodeId}</b>
            </span>
            <span style={{ color: HUD.mutedText }}>
              ACTIVE:{" "}
              <b style={{ color: "rgba(167,139,250,0.95)" }}>{activeCluster}</b>
            </span>
          </div>
        </div>
      </div>

      {/* SIGNAL / NETWORK — independent bottom-left telemetry */}
      <div
        className="fixed bottom-5 left-5 z-[200] select-none md:bottom-7 md:left-7"
        style={riseStyle(120)}
      >
        <div
          className="flex gap-5 px-4 py-3 backdrop-blur-[5px]"
          style={{
            background: HUD.panel,
            border: `1px solid ${HUD.cyanBorder}`,
            boxShadow: "0 0 25px rgba(0,229,255,0.12)",
          }}
        >
          <span className="font-mono text-[9px] tracking-[1.5px]" style={{ color: HUD.mutedText }}>
            SIGNAL:{" "}
            <b style={{ color: "rgba(0,229,255,0.95)" }}>
              {signal.toFixed(1)}%
            </b>
          </span>

          <span className="font-mono text-[9px] tracking-[1.5px]" style={{ color: HUD.mutedText }}>
            NETWORK:{" "}
            <b style={{ color: "rgba(110,231,183,0.9)" }}>
              ONLINE
            </b>
          </span>
        </div>
      </div>
      {/* SOUND */}
      <div
        className="fixed bottom-5 right-5 z-[200] md:bottom-7 md:right-7"
        style={riseStyle(120)}
      >
        <div
          className="backdrop-blur-[5px]"
          style={{
            background: HUD.panel,
            border: `1px solid ${HUD.panelBorder}`,
            boxShadow: "0 0 25px rgba(0,229,255,0.20)",
          }}
        >
          <SoundToggle />
        </div>
      </div>

      {/* RETURN TO CORE — now properly hidden from keyboard/AT when inert,
          not just visually hidden while remaining a live tab stop. */}
      <button
        type="button"
        onClick={onReturn}
        tabIndex={nested ? 0 : -1}
        aria-hidden={!nested}
        className="fixed left-1/2 top-5 z-[200] -translate-x-1/2 select-none px-5 py-2.5 font-mono text-[9px] tracking-[2.5px] backdrop-blur-md transition-all duration-300 md:top-7"
        style={{
          opacity: nested ? 1 : 0,
          pointerEvents: nested ? "auto" : "none",
          background: HUD.panel,
          border: `1px solid ${nested ? "rgba(0,229,255,0.4)" : "rgba(0,229,255,0.15)"}`,
          color: nested ? HUD.text : HUD.subtleText,
          boxShadow: nested
            ? `0 0 25px rgba(0,229,255,0.065), inset 0 0 15px rgba(0,229,255,0.035)`
            : "none",
        }}
      >
        <span className="mr-2" style={{ color: "rgba(0,229,255,0.9)" }}>
          ←
        </span>
        RETURN TO CORE
        <span className="ml-3" style={{ color: HUD.subtleText }}>
          (ESC)
        </span>
      </button>

      {/* SCREEN EDGE MARKERS */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-1/2 z-[150] h-16 w-1 -translate-y-1/2"
        style={{ borderLeft: "1px solid rgba(0,229,255,0.32)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-0 top-1/2 z-[150] h-16 w-1 -translate-y-1/2"
        style={{ borderRight: "1px solid rgba(138,43,255,0.32)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-5 left-1/2 z-[150] hidden -translate-x-1/2 font-mono text-[7px] tracking-[4px] md:block"
        style={{ color: HUD.subtleText }}
      >
        NEURAL SYSTEM // ACTIVE
      </div>
    </>
  );
}
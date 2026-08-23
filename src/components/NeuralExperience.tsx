"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import LandingScreen from "./neural/LandingScreen";
import ActivationSequence from "./neural/ActivationSequence";
import NeuralCanvas from "./neural/NeuralCanvas";
import GraphNode from "./neural/GraphNode";
import AboutTokens from "./neural/AboutTokens";

import SystemHUD from "./interface/SystemHUD";
import NeuralCursor from "./interface/NeuralCursor";

import { useFlash } from "./effects/FlashTransition";
import { sfx, unlockAudio } from "@/lib/sound";

import { useNeuralGraph } from "@/hooks/useNeuralGraph";
import { graphRoot, nodeMap } from "@/data/graph";

import { useReducedMotion, useIsMobile } from "@/hooks/useReducedMotion";
import { layoutGraph, NodePosition } from "@/lib/layout";

import type { NodeDragApi } from "@/hooks/useNeuralSimulation";

/* ================================================================
 * BOOT
 * ================================================================ */

const BOOT_LINES = [
  "INITIALIZING NEURAL INTERFACE...",
  "LOADING CORE...",
  "[###################]",
  "ESTABLISHING CONNECTIONS...",
  "SYNCING MEMORY...",
  "SYSTEM ONLINE.",
];

type Phase = "boot" | "landing" | "activation" | "network";

/* ================================================================
 * INITIALIZATION
 * ================================================================ */

function InitializationGate({
  onStart,
}: {
  onStart: () => void;
}) {
  const handleStart = async () => {
    await unlockAudio();
    onStart();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#020309]">
      <button
        type="button"
        onClick={handleStart}
        className="group flex flex-col items-center outline-none"
      >
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-cyan/50 bg-cyan/[0.03] shadow-[0_0_35px_rgba(0,229,255,.15)] transition-all duration-300 group-hover:scale-110 group-hover:border-cyan group-hover:shadow-[0_0_60px_rgba(0,229,255,.35)]">
          <span className="h-2 w-2 rounded-full bg-cyan shadow-[0_0_18px_6px_rgba(0,229,255,.45)]" />

          <span className="pointer-events-none absolute inset-0 rounded-full border border-cyan/10 animate-ping" />
        </div>

        <span className="mt-8 font-mono text-[10px] tracking-[4px] text-cyan/80">
          NEURAL INTERFACE
        </span>

        <span className="mt-3 font-mono text-[9px] tracking-[2px] text-dim transition-colors group-hover:text-white">
          [ START CORE ]
        </span>

        <span className="mt-5 font-mono text-[7px] tracking-[1.5px] text-white/20">
          SECURE HANDSHAKE REQUIRED // CORE STANDBY
        </span>
      </button>
    </div>
  );
}

/* ================================================================
 * BOOT SCREEN
 * ================================================================ */

function BootScreen({
  onDone,
}: {
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    sfx.typing();

    const interval = window.setInterval(() => {
      setIndex((current) => {
        if (current >= BOOT_LINES.length - 1) {
          window.clearInterval(interval);

          sfx.systemOnline();

          window.setTimeout(() => {
            setFading(true);
          }, 180);

          return current;
        }

        sfx.processing();
        return current + 1;
      });
    }, 500);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!fading) return;

    const timer = window.setTimeout(onDone, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fading, onDone]);

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-bg"
      role="status"
      aria-live="polite"
      style={{
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? "none" : "auto",
        transition: "opacity 500ms cubic-bezier(.22,1,.36,1)",
      }}
    >
      <pre
        className="whitespace-pre-wrap font-mono text-xs tracking-wide text-cyan/85"
        style={{
          transform: fading ? "translateY(-6px)" : "translateY(0)",
          transition: "transform 500ms cubic-bezier(.22,1,.36,1)",
        }}
      >
        {BOOT_LINES.slice(0, index + 1).join("\n")}
      </pre>
    </div>
  );
}

/* ================================================================
 * MAIN EXPERIENCE
 * ================================================================ */

export default function NeuralExperience() {
  const [initialized, setInitialized] = useState(false);
  const [phase, setPhase] = useState<Phase>("landing");

  const [dims, setDims] = useState({
    w: 1200,
    h: 800,
  });

  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  const { trigger, Flash } = useFlash();

  const {
    activePath,
    hoveredId,
    activatedId,

    isOnPath,

    handleEnter,
    handleLeave,
    handleActivate,

    collapseOne,
    resetToRoot,

    breadcrumb,
  } = useNeuralGraph();

  /* ================================================================
   * DRAG API
   * ================================================================ */

  const dragApiRef = useRef<NodeDragApi | null>(null);

  const handleDragStart = useCallback(
    (id: string, x: number, y: number) => {
      dragApiRef.current?.startNodeDrag(id, x, y);
    },
    []
  );

  const consumeDragSuppressedClick = useCallback(() => {
    return (
      dragApiRef.current?.consumeDragSuppressedClick() ?? false
    );
  }, []);

  const registerNodeElement = useCallback(
    (id: string, el: HTMLElement | null) => {
      dragApiRef.current?.registerNodeElement(id, el);
    },
    []
  );

  /* ================================================================
   * VIEWPORT
   * ================================================================ */

  useEffect(() => {
    const resize = () => {
      setDims({
        w: window.innerWidth,
        h: window.innerHeight,
      });
    };

    resize();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  /* ================================================================
   * SEMANTIC FOCUS
   *
   * IMPORTANT: layout focus is derived from `activePath` ONLY.
   * `activatedId` also fires for terminal leaf selections (which must
   * NOT change layout — see the leaf activation rule in
   * useNeuralGraph.ts), so it is used purely for transient HUD/pulse
   * feedback below, never for deciding what layoutGraph() renders.
   * ================================================================ */

  const focusId = activePath[activePath.length - 1] ?? "meet jain";

  const focusNode =
    nodeMap.get(focusId) ?? graphRoot;

  /* ================================================================
   * GRAPH LAYOUT
   * ================================================================ */

  const positions = useMemo(() => {
    const cx = dims.w / 2;
    const cy = dims.h / 2;

    const baseRadius =
      Math.min(dims.w, dims.h) *
      (isMobile ? 0.18 : 0.20);

    return layoutGraph(
      graphRoot,
      cx,
      cy,
      baseRadius,
      activePath,
      dims.w,
      dims.h
    );
  }, [
    dims,
    isMobile,
    activePath,
  ]);

  /* ================================================================
   * ESCAPE = GO ONE LEVEL BACK
   * ================================================================ */

  useEffect(() => {
    if (phase !== "network") return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        collapseOne();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [
    phase,
    collapseOne,
  ]);

  /* ================================================================
   * ACTIVATION
   * ================================================================ */

  const handleActivationDone = useCallback(() => {
    trigger(() => {
      setPhase("network");
    });
  }, [trigger]);

  /* ================================================================
   * RENDERABLE NEURAL NODES
   *
   * `positions` is already the curated, structurally-correct set of
   * everything that should be visible (normal ring OR full detail
   * constellation) — layoutGraph() decides that, not this component.
   * ================================================================ */

  const renderableEntries = useMemo(() => {
    const entries: {
      def: NonNullable<ReturnType<typeof nodeMap.get>>;
      pos: NodePosition;
    }[] = [];

    positions.forEach((pos, id) => {
      const def = nodeMap.get(id);

      if (!def) return;

      entries.push({
        def,
        pos,
      });
    });

    return entries;
  }, [positions]);

  /* ================================================================
   * HOVER
   * ================================================================ */

  const hoveredNode =
    hoveredId
      ? nodeMap.get(hoveredId)
      : null;

  const hoveredPos =
    hoveredId
      ? positions.get(hoveredId)
      : null;

  const showTooltip = Boolean(
    hoveredNode &&
      hoveredPos &&
      hoveredNode.id !== "about" &&
      (hoveredNode.meta?.length ||
        hoveredNode.description)
  );

  /* ================================================================
   * START
   * ================================================================ */

  const handleStart = useCallback(() => {
    setInitialized(true);
    setPhase("boot");
  }, []);

  /* ================================================================
   * RENDER
   * ================================================================ */

  return (
    <>
      {!initialized && (
        <InitializationGate
          onStart={handleStart}
        />
      )}

      <NeuralCursor />

      {phase === "boot" && (
        <BootScreen
          onDone={() => setPhase("landing")}
        />
      )}

      {phase === "landing" && (
        <LandingScreen
          onInit={() => setPhase("activation")}
        />
      )}

      {phase === "activation" && (
        <ActivationSequence
          reducedMotion={reducedMotion}
          isMobile={isMobile}
          onDone={handleActivationDone}
        />
      )}

      <Flash />

      {phase === "network" && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          <NeuralCanvas
            positions={positions}
            reducedMotion={reducedMotion}
            isMobile={isMobile}
            activePath={activePath}
            hoveredId={hoveredId}
            focusId={focusId}
            onDragApiReady={(api) => {
              dragApiRef.current = api;
            }}
          />

          <div className="absolute inset-0 z-10">
            {/*
              Everything in `positions` is already the intended visible
              set (normal ring or full detail constellation) — nothing
              here needs dimming based on parentId anymore, since
              layoutGraph() only emits nodes that belong in the current
              view.
            */}

            {renderableEntries.map(
              ({ def, pos }) => {
                const active =
                  isOnPath(def.id) || activatedId === def.id;

                const hovered =
                  hoveredId === def.id;

                return (
                  <GraphNode
                    key={def.id}
                    node={def}
                    pos={pos}
                    isHovered={hovered}
                    isOnPath={active}
                    dimmed={false}
                    onEnter={() => {
                      if (!isMobile) {
                        handleEnter(def.id);
                      }
                    }}
                    onLeave={() => {
                      if (!isMobile) {
                        handleLeave(def.id);
                      }
                    }}
                    onActivate={() => {
                      handleActivate(def);
                    }}
                    onDragStart={
                      handleDragStart
                    }
                    consumeDragSuppressedClick={
                      consumeDragSuppressedClick
                    }
                    registerNodeElement={
                      registerNodeElement
                    }
                  />
                );
              }
            )}

            {focusId === "about" && (
              <AboutTokens
                x={dims.w / 2}
                y={dims.h / 2 + 80}
              />
            )}

            {showTooltip &&
              hoveredNode &&
              hoveredPos && (
                <div
                  className="pointer-events-none absolute z-[80] -translate-x-1/2 border border-cyan/30 bg-panel/90 px-4 py-3 font-mono backdrop-blur-md"
                  style={{
                    left: hoveredPos.x,
                    top:
                      hoveredPos.y + 28,
                    minWidth: 160,
                    maxWidth: 300,
                  }}
                >
                  <div className="text-[11px] tracking-[3px] text-cyan">
                    [{hoveredNode.label}]
                  </div>

                  {hoveredNode.meta?.map(
                    (meta, index) => (
                      <div
                        key={`${meta}-${index}`}
                        className="mt-1 text-[9px] tracking-[1.5px] text-dim"
                      >
                        {meta}
                      </div>
                    )
                  )}

                  {hoveredNode.description && (
                    <div className="mt-2 text-[10px] leading-relaxed text-white/70">
                      {hoveredNode.description}
                    </div>
                  )}
                </div>
              )}
          </div>

          <SystemHUD
            breadcrumb={breadcrumb}
            onReturn={resetToRoot}
            aboutActive={focusId === "about"}
          />
        </div>
      )}
    </>
  );
}
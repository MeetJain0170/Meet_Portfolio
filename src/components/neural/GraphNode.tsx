"use client";

import { useEffect, useRef } from "react";
import { GraphNodeDef } from "@/lib/graph";
import { NodePosition } from "@/lib/layout";

const COLORS: Record<number, string> = {
  0: "#00e5ff",
  1: "#00e5ff",
  2: "#8a2bff",
  3: "#ff2ec4",
  4: "#eef3ff",
  5: "#eef3ff",
};

function nodeSize(depth: number, kind: string) {
  if (kind === "core") return 26;
  if (depth === 1) return 21;

  // Action nodes such as GitHub.
  if (kind === "action") return 19;

  // Architecture / technology / leaf nodes.
  if (kind === "tech") return 16;
  if (kind === "grand") return 17;

  if (depth === 2) return 17;

  return 15;
}

function labelSize(depth: number, kind: string) {
  if (depth === 0) return 24;
  if (depth === 1) return 15;

  // Keep architecture and technology labels permanently readable.
  if (kind === "tech") return 13;
  if (kind === "grand") return 13;
  if (kind === "action") return 13;

  if (depth === 2) return 13;

  return 12;
}

interface GraphNodeProps {
  node: GraphNodeDef;
  pos: NodePosition;
  isHovered: boolean;
  isOnPath: boolean;
  dimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onActivate: () => void;
  onDragStart?: (id: string, x: number, y: number) => void;
  consumeDragSuppressedClick?: () => boolean;
  registerNodeElement?: (id: string, el: HTMLElement | null) => void;
}

export default function GraphNode({
  node,
  pos,
  isHovered,
  isOnPath,
  dimmed,
  onEnter,
  onLeave,
  onActivate,
  onDragStart,
  consumeDragSuppressedClick,
  registerNodeElement,
}: GraphNodeProps) {
  const pointerDown = useRef(false);
  const elRef = useRef<HTMLButtonElement | null>(null);

  const size = nodeSize(pos.depth, node.kind);
  const color = COLORS[Math.min(pos.depth, 5)] ?? COLORS[0];

  const active = isHovered || isOnPath;
  const core = node.kind === "core";
  const action = node.kind === "action";

  // Leaf / detail nodes ALWAYS show their labels.
  const leaf =
    node.kind === "tech" ||
    node.kind === "grand" ||
    pos.depth >= 2;

  const showLabel = leaf || pos.depth <= 1 || active || action;

  const glow = active
    ? `0 0 12px 4px ${color}cc, 0 0 30px 9px ${color}66, 0 0 65px 18px ${color}25`
    : `0 0 10px 3px ${color}77, 0 0 22px 5px ${color}22`;

  useEffect(() => {
    const el = elRef.current;

    if (el) {
      el.style.transform = "translate(-50%, -50%)";
    }

    registerNodeElement?.(node.id, el);

    return () => {
      registerNodeElement?.(node.id, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    pointerDown.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);

    onDragStart?.(node.id, event.clientX, event.clientY);
  };

  const handlePointerUp = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    pointerDown.current = false;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleClick = () => {
    if (consumeDragSuppressedClick?.()) return;
    onActivate();
  };

  return (
    <button
      ref={elRef}
      type="button"
      id={`node-${node.id}`}
      aria-label={node.label}
      aria-current={isOnPath ? "true" : undefined}
      className="group absolute flex touch-none select-none flex-col items-center outline-none"
      style={{
        left: pos.x,
        top: pos.y,
        zIndex: active ? 40 : pos.depth <= 1 ? 20 : 10,
        opacity: dimmed ? 0.14 : 1,
        transition:
          "left .45s cubic-bezier(.16,.84,.44,1), " +
          "top .45s cubic-bezier(.16,.84,.44,1), " +
          "opacity .35s ease",
        cursor: pointerDown.current ? "grabbing" : "pointer",
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
    >
      {/* Larger invisible interaction field */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          width: Math.max(size * 4.5, 60),
          height: Math.max(size * 4.5, 60),
          background: active
            ? `radial-gradient(circle, ${color}20 0%, ${color}08 42%, transparent 74%)`
            : "transparent",
          transition: "background .25s ease",
        }}
      />

      {/* Expanding neural ring */}
      {active && !core && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full border"
          style={{
            width: size * 2.5,
            height: size * 2.5,
            borderColor: `${color}65`,
            boxShadow: `0 0 16px ${color}28`,
            animation: "node-ring 1.7s ease-out infinite",
          }}
        />
      )}

      {/* Action diamond */}
      {action && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-sm border"
          style={{
            width: size + 11,
            height: size + 11,
            borderColor: `${color}${active ? "aa" : "60"}`,
            transform: "rotate(45deg)",
            transition: "border-color .2s ease",
          }}
        />
      )}

      {/* Neural nucleus */}
      <span
        aria-hidden="true"
        className="relative block rounded-full"
        style={{
          width: size,
          height: size,
          background:
            `radial-gradient(circle at 30% 25%, ` +
            `#fff 0%, #fff 12%, ${color} 42%, ` +
            `${color}88 65%, transparent 80%)`,
          boxShadow: glow,
          transform: active ? "scale(1.3)" : "scale(1)",
          transition:
            "transform .25s cubic-bezier(.2,.8,.2,1), " +
            "box-shadow .25s ease",
        }}
      />

      {/* Core heartbeat */}
      {core && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full border"
          style={{
            width: size * 2.2,
            height: size * 2.2,
            borderColor: `${color}35`,
            animation: "core-pulse 2.4s ease-in-out infinite",
          }}
        />
      )}

      {/* ALWAYS VISIBLE LABEL FOR LEAF NODES */}
      {showLabel && (
        <span
          className="pointer-events-none mt-3 whitespace-nowrap font-mono uppercase"
          style={{
            fontSize: labelSize(pos.depth, node.kind),

            letterSpacing:
              pos.depth === 0
                ? "6px"
                : node.kind === "tech" || node.kind === "grand"
                  ? "2.5px"
                  : "2px",

            // Leaf nodes remain readable even when not hovered.
            color: active
              ? "#eef3ff"
              : leaf
                ? "#cbd3eb"
                : "#5b6480",

            opacity: 1,

            textShadow: active
              ? `0 0 8px ${color}, 0 0 18px ${color}55`
              : leaf
                ? `0 0 6px ${color}44`
                : "none",

            transform: "translateY(0)",

            transition:
              "color .2s ease, opacity .2s ease, " +
              "transform .2s ease, text-shadow .2s ease",
          }}
        >
          {node.label}
        </span>
      )}

      {/* Metadata */}
      {active && node.meta?.length ? (
        <span
          className="pointer-events-none mt-1 whitespace-nowrap font-mono text-[10px] tracking-[1.5px]"
          style={{
            color: `${color}99`,
            opacity: 0.9,
          }}
        >
          {node.meta.join(" · ")}
        </span>
      ) : null}
    </button>
  );
}
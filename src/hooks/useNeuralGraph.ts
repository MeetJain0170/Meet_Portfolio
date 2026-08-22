"use client";

import { useCallback, useMemo, useState } from "react";
import { graphRoot, nodeMap, parentMap } from "@/data/graph";
import { GraphNodeDef, pathTo } from "@/lib/graph";
import { sfx } from "@/lib/sound";

export interface NeuralGraphState {
  activePath: string[];
  hoveredId: string | null;
  activatedId: string | null;
  signalPath: string[];
  interactionIntensity: number;

  isExpanded: (id: string) => boolean;
  isOnPath: (id: string) => boolean;
  handleEnter: (id: string) => void;
  handleLeave: (id: string) => void;
  handleActivate: (node: GraphNodeDef) => void;
  collapseOne: () => void;
  resetToRoot: () => void;
  breadcrumb: GraphNodeDef[];
}

export function useNeuralGraph(): NeuralGraphState {
  const [activePath, setActivePath] = useState<string[]>(["meet"]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activatedId, setActivatedId] = useState<string | null>(null);
  const [signalPath, setSignalPath] = useState<string[]>(["meet"]);
  const [interactionIntensity, setInteractionIntensity] = useState(0);

  const activeSet = useMemo(() => new Set(activePath), [activePath]);

  const isExpanded = useCallback(
    (id: string) => activeSet.has(id) || hoveredId === id,
    [activeSet, hoveredId]
  );

  const isOnPath = useCallback(
    (id: string) => activeSet.has(id),
    [activeSet]
  );

  const handleEnter = useCallback((id: string) => {
    setHoveredId(id);
    setInteractionIntensity((v) => Math.min(1, v + 0.08));
    sfx.hover();
  }, []);

  const handleLeave = useCallback((id: string) => {
    setHoveredId((current) => (current === id ? null : current));
    setInteractionIntensity((v) => Math.max(0, v - 0.04));
  }, []);

  /**
   * LEAF NODE ACTIVATION RULE
   *
   *   node.action exists          -> perform the action.
   *   node has meaningful children -> focus it (normal recursive nav).
   *   otherwise                    -> terminal leaf: give selection/pulse
   *                                    feedback but do NOT navigate into
   *                                    an empty graph, and do NOT touch
   *                                    activePath.
   */
  const handleActivate = useCallback((node: GraphNodeDef) => {
    if (node.action) {
      setActivatedId(node.id);
      setSignalPath([node.id]);
      setInteractionIntensity(1);
      sfx.action();

      if (node.action.kind === "external") {
        window.open(node.action.href, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = node.action.href;
      }

      return;
    }

    const hasMeaningfulChildren = Boolean(
      node.children && node.children.length > 0
    );

    if (!hasMeaningfulChildren) {
      // Terminal node (tech leaf, architecture stage, etc). Keep the
      // current constellation exactly as-is, just surface a light
      // selection pulse for feedback/tooltip purposes.
      setActivatedId(node.id);
      setInteractionIntensity((v) => Math.min(1, Math.max(v, 0.5)));
      sfx.hover();
      return;
    }

    setActivePath((current) => {
      const deepest = current[current.length - 1] === node.id;

      if (deepest && current.length > 1) {
        const collapsed = current.slice(0, -1);
        setActivatedId(node.id);
        setSignalPath(collapsed);
        setInteractionIntensity(0.65);
        sfx.expand();
        return collapsed;
      }

      const next = pathTo(node.id, parentMap);

      setActivatedId(node.id);
      setSignalPath(next);
      setInteractionIntensity(Math.min(1, 0.35 + next.length * 0.12));
      sfx.lock();

      return next;
    });
  }, []);

  const collapseOne = useCallback(() => {
    setActivePath((current) => {
      if (current.length <= 1) return current;

      const next = current.slice(0, -1);
      setSignalPath(next);
      setActivatedId(next[next.length - 1] ?? "meet");
      setInteractionIntensity(0.55);
      sfx.expand();

      return next;
    });
  }, []);

  const resetToRoot = useCallback(() => {
    setActivePath(["meet"]);
    setSignalPath(["meet"]);
    setActivatedId("meet");
    setHoveredId(null);
    setInteractionIntensity(0);
    sfx.expand();
  }, []);

  const breadcrumb = useMemo(
    () => activePath.map((id) => nodeMap.get(id)).filter(Boolean) as GraphNodeDef[],
    [activePath]
  );

  return {
    activePath,
    hoveredId,
    activatedId,
    signalPath,
    interactionIntensity,
    isExpanded,
    isOnPath,
    handleEnter,
    handleLeave,
    handleActivate,
    collapseOne,
    resetToRoot,
    breadcrumb,
  };
}

export { graphRoot, nodeMap, parentMap };
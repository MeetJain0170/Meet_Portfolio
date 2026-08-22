"use client";

import { useEffect } from "react";
import { NodePosition } from "@/lib/layout";
import {
useNeuralSimulation,
type NodeDragApi,
} from "@/hooks/useNeuralSimulation";

interface NeuralCanvasProps {
positions: Map<string, NodePosition>;
reducedMotion: boolean;
isMobile: boolean;
activePath: string[];
hoveredId: string | null;
focusId: string | null;
onDragApiReady?: (api: NodeDragApi) => void;
}

export default function NeuralCanvas({
positions,
reducedMotion,
isMobile,
activePath,
hoveredId,
focusId,
onDragApiReady,
}: NeuralCanvasProps) {
const { canvasRef, dragApi } = useNeuralSimulation({
  positions,
  reducedMotion,
  isMobile,
  activePath,
  hoveredId,
  focusId,
});

useEffect(() => {
  onDragApiReady?.(dragApi);
}, [dragApi, onDragApiReady]);

return (
  <canvas
    ref={canvasRef}
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 h-full w-full"
  />
);
}
import { NodePosition } from "@/lib/layout";

export type NeuronLifecycle = "entering" | "active" | "exiting" | "hidden";

export interface Neuron {
  id: string;
  parentId: string | null;
  depth: number;

  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;

  targetX: number;
  targetY: number;

  // Focus/orbit information supplied by layout.
  isFocus: boolean;
  isOrbit: boolean;

  // Temporary convergence target for cinematic transitions.
  convergeX: number | null;
  convergeY: number | null;
  convergeDelay: number;

  state: NeuronLifecycle;
  opacity: number;
  scale: number;
  stateSince: number;

  // Neural activity.
  energy: number;
  activity: number;
  firing: number;
  refractoryUntil: number;

  // Interaction.
  focusWeight: number;
  onActivePath: boolean;
  hovered: boolean;
  dragging: boolean;

  // Stable procedural identity.
  seed: number;
  phase: number;

  // Short-lived motion trail.
  trail: { x: number; y: number }[];
}

export type SynapseLifecycle = "entering" | "active" | "exiting" | "hidden";

export interface Synapse {
  id: string;
  fromId: string;
  toId: string;

  strength: number;
  energy: number;
  pulse: number;
  seed: number;

  state: SynapseLifecycle;
  opacity: number;
  stateSince: number;

  // Spring-damped rope control point (world space).
  sagX: number;
  sagY: number;
  sagVX: number;
  sagVY: number;

  // Cached *projected* control point for this frame, so the synapse pass
  // and the signal/tracer pass reuse one projection instead of computing
  // it twice. Optional so objects created elsewhere (reconcile.ts) still
  // satisfy the type without changes there.
  controlProjX?: number;
  controlProjY?: number;
  controlProjFrame?: number;
}

export interface Signal {
  id: number;
  synapseId: string;
  progress: number;
  direction: 1 | -1;
  energy: number;
  speed: number;
  age: number;
}

export interface Pulse {
  x: number;
  y: number;
  radius: number;
  life: number;
  strength: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  seed: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;

  targetX: number;
  targetY: number;
  targetZoom: number;

  vx: number;
  vy: number;
  vzoom: number;

  // Cinematic rotation.
  roll: number;
  targetRoll: number;

  // Temporary activation push.
  push: number;
  targetPush: number;
}

export interface Pointer {
  x: number;
  y: number;
  targetX: number;
  targetY: number;

  active: boolean;
  down: boolean;

  // DOM node currently being dragged.
  draggingId: string | null;

  // Prevents the node from jumping when grabbed away from its center.
  dragDX: number;
  dragDY: number;
}

export type TransitionPhase =
  | "idle"
  | "scattered"
  | "attract"
  | "converge"
  | "lock"
  | "reveal"
  | "settling";

export interface TransitionState {
  phase: TransitionPhase;
  targetId: string | null;
  startedAt: number;
  phaseStartedAt: number;
}

export interface SimContext {
  width: number;
  height: number;
  time: number;
  delta: number;

  camera: Camera;
  pointer: Pointer;

  reducedMotion: boolean;
  isMobile: boolean;
}

/**
 * Semantic → simulation boundary.
 *
 * `layoutGraph()` produces NodePosition objects.
 * The simulation converts them into persistent Neuron objects.
 */
export interface NeuralLayout {
  positions: Map<string, NodePosition>;
  focusId: string | null;
  activePath: string[];
}
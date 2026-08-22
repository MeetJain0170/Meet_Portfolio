import { Pulse, Signal, TransitionState } from "./types";

/**
 * Neural navigation transition controller.
 *
 * Navigation model:
 *
 *   CLICK
 *     ↓
 *   immediate focus
 *     ↓
 *   camera centers
 *     ↓
 *   children orbit the focused node
 *     ↓
 *   previous branch retracts smoothly
 *     ↓
 *   system settles
 *
 * No special-case About animation and no long cinematic phases.
 */

const SETTLE_MS = 420;

export function createTransitionState(): TransitionState {
  return {
    phase: "idle",
    targetId: null,
    startedAt: 0,
    phaseStartedAt: 0,
  };
}

/**
 * Every node uses the same interaction model.
 *
 * There is deliberately no special About transition.
 */
export function isMajorTransitionTarget(_id: string | null) {
  return false;
}

/**
 * Begin a new focus transition.
 *
 * The target is registered immediately so the simulation can react on the
 * same frame. If another node is already focused, the transition redirects
 * instead of replaying an unnecessary intro animation.
 */
export function beginTransition(
  state: TransitionState,
  targetId: string,
  now: number
) {
  state.targetId = targetId;
  state.startedAt = now;
  state.phaseStartedAt = now;
  state.phase = "attract";
}

/**
 * End the active transition and allow the spring system to settle.
 */
export function endTransition(
  state: TransitionState,
  now: number
) {
  state.phase = "settling";
  state.phaseStartedAt = now;
  state.targetId = null;
}

/**
 * Advances the lightweight transition state.
 *
 * `true` means the simulation is currently changing focus and topology
 * reconciliation should avoid fighting the interaction.
 */
export function updateTransition(
  state: TransitionState,
  now: number
): boolean {
  if (state.phase === "idle") return false;

  if (state.phase === "settling") {
    if (now - state.phaseStartedAt >= SETTLE_MS) {
      state.phase = "idle";
      state.startedAt = 0;
      state.phaseStartedAt = now;
    }
    return false;
  }

  // Focus transitions are intentionally short. The actual movement is
  // handled continuously by the neural physics/layout system.
  if (now - state.phaseStartedAt >= 180) {
    state.phase = "settling";
    state.phaseStartedAt = now;
  }

  return true;
}

/**
 * Total elapsed time since the current focus interaction began.
 */
export function transitionElapsed(
  state: TransitionState,
  now: number
) {
  return state.startedAt > 0
    ? Math.max(0, now - state.startedAt)
    : 0;
}

/**
 * Remove old electrical activity before redirecting focus.
 *
 * This prevents signals from a closed branch from travelling through the
 * newly focused graph.
 */
export function clearTransientActivity(
  signals: Signal[],
  pulses: Pulse[]
) {
  signals.length = 0;
  pulses.length = 0;
}

/**
 * Clears obsolete cinematic convergence targets.
 *
 * Focus/orbit positioning is now controlled by the layout + physics system,
 * so convergence coordinates should never remain active after navigation.
 */
export function clearConvergenceTargets(
  neurons: Map<
    string,
    {
      convergeX: number | null;
      convergeY: number | null;
      convergeDelay: number;
      trail: unknown[];
    }
  >
) {
  neurons.forEach((neuron) => {
    neuron.convergeX = null;
    neuron.convergeY = null;
    neuron.convergeDelay = 0;
    neuron.trail.length = 0;
  });
}
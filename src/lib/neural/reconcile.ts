import { NodePosition } from "@/lib/layout";
import { Neuron, Synapse } from "./types";

/**
 * Stable deterministic hash.
 *
 * Used for visual personality:
 * - seed
 * - phase
 *
 * This means a node looks the same when revisited instead of getting
 * a completely different random personality every time.
 */
function hash(value: string) {
  let result = 0;

  for (let i = 0; i < value.length; i++) {
    result = (result << 5) - result + value.charCodeAt(i);
    result |= 0;
  }

  return Math.abs(result);
}

function synapseId(fromId: string, toId: string) {
  return `${fromId}__${toId}`;
}

/**
 * Creates a neuron at a sensible spawn point.
 *
 * New children preferably emerge from their parent rather than appearing
 * instantly at their final radial position.
 */
function makeNeuron(
  id: string,
  position: NodePosition,
  now: number,
  spawnFrom: { x: number; y: number } | null
): Neuron {
  const origin = spawnFrom ?? {
    x: position.x,
    y: position.y,
  };

  const stableSeed = hash(id) / 2147483647;

  return {
    id,

    parentId: position.parentId,
    depth: position.depth,

    // ------------------------------------------------------------------
    // Physical state
    // ------------------------------------------------------------------

    x: origin.x,
    y: origin.y,

    // Keep pseudo-depth deterministic.
    z: 0.35 + stableSeed * 0.65,

    vx: 0,
    vy: 0,

    // ------------------------------------------------------------------
    // Semantic target
    // ------------------------------------------------------------------

    targetX: position.x,
    targetY: position.y,

    // Normal navigation does not use cinematic convergence.
    convergeX: null,
    convergeY: null,
    convergeDelay: 0,

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    state: "entering",
    opacity: 0,
    scale: 0,
    stateSince: now,

    // ------------------------------------------------------------------
    // Neural activity
    // ------------------------------------------------------------------

    energy: 0,
    activity: 0,
    firing: 0,
    refractoryUntil: 0,

    // ------------------------------------------------------------------
    // Interaction
    // ------------------------------------------------------------------

    focusWeight: 0,
    onActivePath: false,
    hovered: false,

    dragging: false,
    isFocus: false,
    isOrbit: false,

    seed: stableSeed,
    phase: stableSeed * Math.PI * 2,

    trail: [],
  };
}

/**
 * Creates one visible parent -> child connection.
 */
function makeSynapse(
  fromId: string,
  toId: string,
  now: number
): Synapse {
  return {
    id: synapseId(fromId, toId),
    fromId,
    toId,

    strength: 0.65 + Math.random() * 0.35,

    energy: 0,
    pulse: 0,

    seed: Math.random(),

    state: "entering",
    opacity: 0,
    stateSince: now,

    /*
     * Drag-only rope state.
     *
     * Normal rendering does NOT use these values.
     */
    sagX: 0,
    sagY: 0,
    sagVX: 0,
    sagVY: 0,
  };
}

/**
 * Reconcile the persistent simulation state with the CURRENT visible graph.
 *
 * IMPORTANT DESIGN RULE:
 *
 * `positions` is the source of truth for what is visible.
 *
 * The graph is intentionally focus-based:
 *
 *     focused node
 *          |
 *     direct children
 *
 * Everything else exits.
 *
 * This means we do NOT keep the old expanded graph sitting around at 18%
 * opacity. Nodes that disappear from `positions` are explicitly transitioned
 * out and subsequently removed from the registry.
 *
 * This is intentionally different from the old "persistent neural universe"
 * approach. We want a clean recursive navigation experience rather than a
 * growing pile of invisible neurons.
 */
export function reconcile(
  neurons: Map<string, Neuron>,
  synapses: Map<string, Synapse>,
  positions: Map<string, NodePosition>,
  now: number,
  frozen: boolean
) {
  // --------------------------------------------------------------------------
  // 1. Register / update visible neurons
  // --------------------------------------------------------------------------

  const visibleIds = new Set<string>();

  positions.forEach((position, id) => {
    visibleIds.add(id);

    let neuron = neurons.get(id);

    // ------------------------------------------------------------------------
    // Brand-new node
    // ------------------------------------------------------------------------

    if (!neuron) {
      const parent = position.parentId
        ? neurons.get(position.parentId)
        : null;

      neuron = makeNeuron(
        id,
        position,
        now,
        parent
          ? {
            x: parent.x,
            y: parent.y,
          }
          : null
      );

      neurons.set(id, neuron);
    }

    // ------------------------------------------------------------------------
    // Revive a node that was previously leaving.
    //
    // We preserve its identity/personality but restart the entrance animation.
    // ------------------------------------------------------------------------

    else if (
      neuron.state === "exiting" ||
      neuron.state === "hidden"
    ) {
      neuron.state = "entering";
      neuron.stateSince = now;

      // Clear stale motion from the previous branch.
      neuron.vx = 0;
      neuron.vy = 0;

      neuron.dragging = false;

      // If it was fully hidden, start it from its parent if possible.
      if (neuron.opacity <= 0 || neuron.scale <= 0) {
        const parent = position.parentId
          ? neurons.get(position.parentId)
          : null;

        if (parent) {
          neuron.x = parent.x;
          neuron.y = parent.y;
        } else {
          neuron.x = position.x;
          neuron.y = position.y;
        }
      }
    }

    // ------------------------------------------------------------------------
    // Update semantic information.
    // ------------------------------------------------------------------------

    neuron.parentId = position.parentId;
    neuron.depth = position.depth;

    neuron.targetX = position.x;
    neuron.targetY = position.y;

    // The node is visible in the current semantic graph.
    neuron.onActivePath = true;
  });

  // --------------------------------------------------------------------------
  // 2. Exit everything that is no longer part of the focused graph.
  //
  // This is the key difference from the previous implementation.
  //
  // If a node is not in `positions`, it is no longer part of the visible
  // interaction space.
  // --------------------------------------------------------------------------

  neurons.forEach((neuron, id) => {
    if (visibleIds.has(id)) {
      return;
    }

    if (
      neuron.state === "active" ||
      neuron.state === "entering"
    ) {
      neuron.state = "exiting";
      neuron.stateSince = now;
      neuron.onActivePath = false;

      neuron.hovered = false;
      neuron.focusWeight = 0;

      // Stop dragging a node that is leaving.
      neuron.dragging = false;
    }
  });

  // --------------------------------------------------------------------------
  // 3. Build the CURRENT synapse topology.
  //
  // A connection exists ONLY when:
  //
  //     parent exists
  //     AND
  //     child exists
  //     AND
  //     both are currently visible.
  //
  // This guarantees that when EXPERIENCE becomes the focus, only:
  //
  //     EXPERIENCE -> KRISH PLAST
  //     EXPERIENCE -> PARSHWA PLAST
  //
  // remain.
  // --------------------------------------------------------------------------

  const visibleSynapseIds = new Set<string>();

  positions.forEach((position, id) => {
    const parentId = position.parentId;

    if (!parentId) {
      return;
    }

    // Never create a connection to something outside the current graph.
    if (!visibleIds.has(parentId)) {
      return;
    }

    const sid = synapseId(parentId, id);

    visibleSynapseIds.add(sid);

    let synapse = synapses.get(sid);

    // ------------------------------------------------------------------------
    // New connection
    // ------------------------------------------------------------------------

    if (!synapse) {
      synapse = makeSynapse(parentId, id, now);
      synapses.set(sid, synapse);
      return;
    }

    // ------------------------------------------------------------------------
    // Revive a connection that was previously exiting.
    // ------------------------------------------------------------------------

    if (
      synapse.state === "exiting" ||
      synapse.state === "hidden"
    ) {
      synapse.state = "entering";
      synapse.stateSince = now;

      synapse.energy = 0;
      synapse.pulse = 0;

      synapse.sagVX = 0;
      synapse.sagVY = 0;
    }
  });

  // --------------------------------------------------------------------------
  // 4. Exit stale synapses.
  //
  // Connections disappear along with their nodes instead of remaining as
  // invisible/ghost edges.
  // --------------------------------------------------------------------------

  synapses.forEach((synapse, sid) => {
    if (visibleSynapseIds.has(sid)) {
      return;
    }

    if (
      synapse.state === "active" ||
      synapse.state === "entering"
    ) {
      synapse.state = "exiting";
      synapse.stateSince = now;

      synapse.energy *= 0.5;
      synapse.pulse *= 0.5;
    }
  });

  // --------------------------------------------------------------------------
  // 5. Garbage collect fully hidden neurons and synapses.
  //
  // This keeps the registry clean instead of allowing every navigation step
  // to accumulate another set of dead objects.
  //
  // We only remove objects that are already fully hidden. The render/physics
  // lifecycle remains responsible for performing the actual fade-out.
  // --------------------------------------------------------------------------

  if (!frozen) {
    neurons.forEach((neuron, id) => {
      if (
        neuron.state === "hidden" &&
        !visibleIds.has(id)
      ) {
        neurons.delete(id);
      }
    });

    synapses.forEach((synapse, sid) => {
      if (
        synapse.state === "hidden" &&
        !visibleSynapseIds.has(sid)
      ) {
        synapses.delete(sid);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 6. Frozen transitions
  //
  // During a major cinematic transition we do NOT aggressively alter topology.
  // Existing entities remain untouched while the transition system controls
  // the choreography.
  //
  // New semantic nodes are still registered so they can be ready when the
  // transition finishes.
  // --------------------------------------------------------------------------

  if (frozen) {
    positions.forEach((position, id) => {
      if (neurons.has(id)) {
        return;
      }

      const parent = position.parentId
        ? neurons.get(position.parentId)
        : null;

      neurons.set(
        id,
        makeNeuron(
          id,
          position,
          now,
          parent
            ? {
              x: parent.x,
              y: parent.y,
            }
            : null
        )
      );
    });
  }
}
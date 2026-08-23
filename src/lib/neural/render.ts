import {
  Neuron,
  Particle,
  Pulse,
  Signal,
  SimContext,
  Synapse,
} from "./types";

const TAU = Math.PI * 2;

const CYAN = "0,229,255";
const WHITE = "238,243,255";
const MIN_ALPHA = 0.01;
const SYNAPSE_Y_OFFSET = -18;

// Distance-based curvature tuning. These are proportions of edge length, not
// pixel constants, so the graph stays visually consistent as it scales.
const SHORT_EDGE_BEND = 0.22;
const LONG_EDGE_BEND = 0.055;
const REFERENCE_DISTANCE = 260; // where "short" fades into "long"; not tied to any specific node
const BEND_MIN_PX = 6;
const BEND_MAX_PX = 92;

const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* -------------------------------------------------------------------------- */
/* COLOR                                                                      */
/* -------------------------------------------------------------------------- */

function depthColor(depth: number, energy: number): string {
  const t = clamp(depth / 5);

  let r: number;
  let g: number;
  let b: number;

  if (t < 0.5) {
    const p = t / 0.5;
    r = lerp(0, 138, p);
    g = lerp(229, 43, p);
    b = 255;
  } else {
    const p = (t - 0.5) / 0.5;
    r = lerp(138, 255, p);
    g = lerp(43, 46, p);
    b = lerp(255, 196, p);
  }

  const white = clamp(energy * 0.45);

  return (
    `${lerp(r, 238, white) | 0},` +
    `${lerp(g, 243, white) | 0},` +
    `${lerp(b, 255, white) | 0}`
  );
}

/* -------------------------------------------------------------------------- */
/* GLOW                                                                       */
/* -------------------------------------------------------------------------- */

function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number
) {
  if (alpha <= 0.002 || !Number.isFinite(radius) || radius <= 0.5) {
    return;
  }

  const r = Math.min(radius, 110);

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);

  gradient.addColorStop(0, `rgba(${color},${alpha})`);
  gradient.addColorStop(0.25, `rgba(${color},${alpha * 0.32})`);
  gradient.addColorStop(0.55, `rgba(${color},${alpha * 0.1})`);
  gradient.addColorStop(1, `rgba(${color},0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/* -------------------------------------------------------------------------- */
/* BACKGROUND                                                                 */
/* -------------------------------------------------------------------------- */

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020309";
  ctx.fillRect(0, 0, width, height);
}

export function drawAtmosphere(
  _ctx: CanvasRenderingContext2D,
  _width: number,
  _height: number,
  _time: number
) {
  // Deliberately empty.
}

/* -------------------------------------------------------------------------- */
/* AMBIENT PARTICLES                                                          */
/* -------------------------------------------------------------------------- */

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  time: number
) {
  if (!particles.length) {
    return;
  }

  ctx.save();

  for (const particle of particles) {
    const scale = 0.65 + particle.z * 0.55;

    const alpha =
      particle.alpha *
      (0.82 + 0.18 * Math.sin(time * 0.001 + particle.seed));

    const radius = particle.size * scale;

    if (alpha <= 0.005 || radius <= 0.1) {
      continue;
    }

    ctx.beginPath();
    ctx.fillStyle = `rgba(91,100,128,${alpha})`;
    ctx.arc(particle.x, particle.y, radius, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* AUTHORITATIVE NODE POSITION                                                */
/* -------------------------------------------------------------------------- */

function getNodePoint(neuron: Neuron) {
  const x = neuron.dragging ? neuron.x : neuron.targetX;
  const y = neuron.dragging ? neuron.y : neuron.targetY;

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

/* -------------------------------------------------------------------------- */
/* NODE VISUAL RADIUS — single source of truth                               */
/*                                                                            */
/* BUG FOUND: the previous version of this file claimed neuronRadius() was    */
/* "shared by drawNeuron() and getAttachmentPoints()" — that comment was      */
/* false. drawNeuron() actually computed its own radius inline, with a        */
/* different base size per depth, a different energy weight (0.45 vs 0.5),    */
/* a focus term keyed off neuron.focusWeight instead of neuron.isFocus, and   */
/* a firing-expansion multiplier that neuronRadius() didn't have at all. So   */
/* the boundary synapses attached to and the boundary actually drawn on      */
/* screen could disagree, most visibly while a node was firing.              */
/*                                                                            */
/* getNeuronVisualRadius() is now the ONLY place node size is computed.       */
/* drawNeuron() and getAttachmentPoints() both call it — the two literally    */
/* cannot drift apart anymore because there is only one formula.             */
/*                                                                            */
/* CAVEAT — depth 0 (MEET): drawNeuron() returns early for depth 0 (see       */
/* below); MEET is a DOM element sized by GraphNode.tsx's nodeSize()/CSS      */
/* hover-scale, which this file has no import path to. The depth-0 branch    */
/* below is a same-shape approximation for synapse attachment only — it      */
/* is NOT verified against the actual DOM circle. A real fix would export    */
/* nodeSize() from a module both GraphNode.tsx and this file import, so      */
/* there's one number instead of two independent guesses.                    */
/* -------------------------------------------------------------------------- */

function getNeuronVisualRadius(neuron: Neuron): number {
  const scale = Number.isFinite(neuron.scale) ? Math.max(0, neuron.scale) : 0;

  const energy = clamp(
    neuron.energy + neuron.activity * 0.45 + neuron.firing * 0.5
  );

  const focusMultiplier = 1 + neuron.focusWeight * 0.25;
  const firingExpansion = neuron.firing > 0.5 ? 1.18 : 1;

  const baseRadius =
    neuron.depth === 0
      ? 12 // unverified DOM approximation — see caveat above
      : neuron.depth === 1
        ? 5.5
        : neuron.depth === 2
          ? 4
          : 2.4;

  const radius = Math.max(
    0.5,
    Math.min(32, baseRadius * scale * (1 + energy * 0.45) * focusMultiplier)
  );

  return radius * firingExpansion;
}

/* -------------------------------------------------------------------------- */
/* EDGE ATTACHMENT — meets the node's visual boundary, not its center         */
/* -------------------------------------------------------------------------- */

function getAttachmentPoints(
  _from: Neuron,
  _to: Neuron,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  return {
    startX: ax,
    startY: ay,
    endX: bx,
    endY: by,
  };
}

/* -------------------------------------------------------------------------- */
/* CURVE — cubic Bézier                                                       */
/* -------------------------------------------------------------------------- */

function cubicPoint(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number
) {
  const safeT = clamp(t);
  const u = 1 - safeT;
  const uu = u * u;
  const tt = safeT * safeT;

  return {
    x: uu * u * x0 + 3 * uu * safeT * x1 + 3 * u * tt * x2 + tt * safeT * x3,
    y: uu * u * y0 + 3 * uu * safeT * y1 + 3 * u * tt * y2 + tt * safeT * y3,
  };
}

/* -------------------------------------------------------------------------- */
/* SIBLING-AWARE FAN-OUT                                                      */
/*                                                                            */
/* Call prepareEdgeFanOut() once per frame with the full edge/neuron set      */
/* before drawing. For each parent, its children are sorted by their true    */
/* angle around the parent, then each child gets a bias in [-1, 1] based on   */
/* its position in that sorted order (middle children near 0, outer children  */
/* toward the extremes). Because the bias comes from spatial order rather      */
/* than a per-edge seed, two siblings that leave a hub at nearly the same      */
/* angle get nearly the same bias — they can never end up bent toward each     */
/* other, which is what caused sibling curves to cross previously.            */
/* -------------------------------------------------------------------------- */

interface FanEntry {
  bias: number;
  count: number;
}

const fanBiasCache = new Map<string, FanEntry>();

function edgeKey(edge: Synapse): string {
  return `${edge.fromId}->${edge.toId}`;
}

export function prepareEdgeFanOut(
  synapses: Iterable<Synapse>,
  neurons: Map<string, Neuron>
) {
  fanBiasCache.clear();

  const byParent = new Map<string, Synapse[]>();

  for (const edge of synapses) {
    if (edge.state === "hidden") {
      continue;
    }

    const list = byParent.get(edge.fromId);

    if (list) {
      list.push(edge);
    } else {
      byParent.set(edge.fromId, [edge]);
    }
  }

  for (const [parentId, children] of byParent) {
    const parent = neurons.get(parentId);
    const parentPoint = parent ? getNodePoint(parent) : null;

    if (!parentPoint) {
      continue;
    }

    const withAngles: { edge: Synapse; angle: number }[] = [];

    for (const edge of children) {
      const child = neurons.get(edge.toId);
      const childPoint = child ? getNodePoint(child) : null;

      if (!childPoint) {
        continue;
      }

      withAngles.push({
        edge,
        angle: Math.atan2(
          childPoint.y - parentPoint.y,
          childPoint.x - parentPoint.x
        ),
      });
    }

    withAngles.sort((a, b) => a.angle - b.angle);

    const count = withAngles.length;

    withAngles.forEach(({ edge }, index) => {
      const bias = count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
      fanBiasCache.set(edgeKey(edge), { bias, count });
    });
  }
}

// Used only when prepareEdgeFanOut() hasn't been called for the current
// frame. Deliberately seed-free: sign is a pure function of the edge's true
// direction, so it can't flip independently for two similarly-angled edges.
function fallbackBias(dx: number, dy: number): number {
  return clamp(Math.sin(Math.atan2(dy, dx) * 2), -1, 1);
}

/* -------------------------------------------------------------------------- */
/* ROPE CONTROL POINTS                                                        */
/*                                                                            */
/* Idle:                                                                      */
/*   A short, mostly-straight "stem" leaving the parent, then most of the     */
/*   curvature happens on approach to the child — fibers depart cleanly and    */
/*   sweep in, rather than bending immediately. Bend magnitude is distance-    */
/*   aware (shallow for long hub-to-hub edges, stronger for short leaf         */
/*   edges) and its direction/size come from the sibling fan bias above.      */
/*                                                                            */
/* Dragging:                                                                  */
/*   Unchanged from the existing sag physics (edge.sagX/sagY, updated in       */
/*   physics.ts) converted to an exact cubic equivalent via the standard      */
/*   quadratic→cubic formula, so the curve never visibly changes shape when   */
/*   a drag starts or ends.                                                   */
/* -------------------------------------------------------------------------- */

function getRopeControlPoints(
  edge: Synapse,
  from: Neuron,
  to: Neuron,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  time: number
) {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);

  if (!Number.isFinite(distance) || distance < 2) {
    return {
      control1X: startX,
      control1Y: startY,
      control2X: endX,
      control2Y: endY,
    };
  }

  const dragging = from.dragging || to.dragging;

  if (dragging) {
    const qx = Number.isFinite(edge.sagX)
      ? edge.sagX
      : (startX + endX) * 0.5;

    const qy = Number.isFinite(edge.sagY)
      ? edge.sagY
      : (startY + endY) * 0.5;

    return {
      control1X: startX + (2 / 3) * (qx - startX),
      control1Y: startY + (2 / 3) * (qy - startY),
      control2X: endX + (2 / 3) * (qx - endX),
      control2Y: endY + (2 / 3) * (qy - endY),
    };
  }

  const tx = dx / distance;
  const ty = dy / distance;
  const nx = -ty;
  const ny = tx;

  // Restrained straight departure, capped relative to distance so short
  // edges can never get a stem long enough to make the control points cross.
  const stem = Math.min(clamp(distance * 0.3, 12, 90), distance * 0.42);

  const normalizedDistance = clamp(distance / REFERENCE_DISTANCE);
  const bendRatio = lerp(SHORT_EDGE_BEND, LONG_EDGE_BEND, normalizedDistance);
  const bend = clamp(distance * bendRatio, BEND_MIN_PX, BEND_MAX_PX);

  const cached = fanBiasCache.get(edgeKey(edge));
  const bias = cached ? cached.bias : fallbackBias(dx, dy);

  // A very small, sign-preserving breathing motion — never enough to flip
  // which side the curve bends toward, just a bit of life.
  const breathe = 1 + 0.06 * Math.sin(time * 0.0004 + bias * 4.2);

  const lateral = bend * bias * breathe;

  // Departure tangent is exactly radial — no lateral term at all. The fiber
  // leaves the node dead-on along the line between the two centers; every
  // bit of curvature is introduced by the arrival control point instead.
  const control1X = startX + tx * stem;
  const control1Y = startY + ty * stem;
  const control2X = endX - tx * stem + nx * lateral;
  const control2Y = endY - ty * stem + ny * lateral;

  return { control1X, control1Y, control2X, control2Y };
}

/* -------------------------------------------------------------------------- */
/* ROPE GEOMETRY — single source of truth for static rope, particles, signals */
/* -------------------------------------------------------------------------- */

interface RopeGeometry {
  startX: number;
  startY: number;
  control1X: number;
  control1Y: number;
  control2X: number;
  control2Y: number;
  endX: number;
  endY: number;
  distance: number;
}

function getRopeGeometry(
  edge: Synapse,
  from: Neuron,
  to: Neuron,
  time: number
): RopeGeometry | null {
  const a = getNodePoint(from);
  const b = getNodePoint(to);

  if (!a || !b) {
    return null;
  }

  const attachment = getAttachmentPoints(
    from,
    to,
    a.x,
    a.y + SYNAPSE_Y_OFFSET,
    b.x,
    b.y + SYNAPSE_Y_OFFSET
  );

  const distance = Math.hypot(
    attachment.endX - attachment.startX,
    attachment.endY - attachment.startY
  );

  if (!Number.isFinite(distance) || distance < 1) {
    return null;
  }

  const controls = getRopeControlPoints(
    edge,
    from,
    to,
    attachment.startX,
    attachment.startY,
    attachment.endX,
    attachment.endY,
    time
  );

  return {
    startX: attachment.startX,
    startY: attachment.startY,
    control1X: controls.control1X,
    control1Y: controls.control1Y,
    control2X: controls.control2X,
    control2Y: controls.control2Y,
    endX: attachment.endX,
    endY: attachment.endY,
    distance,
  };
}

function buildRopePath(ctx: CanvasRenderingContext2D, geometry: RopeGeometry) {
  ctx.beginPath();
  ctx.moveTo(geometry.startX, geometry.startY);
  ctx.bezierCurveTo(
    geometry.control1X,
    geometry.control1Y,
    geometry.control2X,
    geometry.control2Y,
    geometry.endX,
    geometry.endY
  );
}

/* -------------------------------------------------------------------------- */
/* INFORMATION PARTICLES                                                      */
/*                                                                            */
/* Tiny data packets continuously travel along the existing synapse path.    */
/* This is purely visual and does NOT modify simulation state.                */
/* -------------------------------------------------------------------------- */

function drawInformationParticles(
  ctx: CanvasRenderingContext2D,
  edge: Synapse,
  geometry: RopeGeometry,
  color: string,
  opacity: number,
  time: number
) {
  /*
   * Keep the number of packets low so the network feels alive rather than
   * looking like a highway full of traffic.
   */
  const particleCount =
    geometry.distance > 260
      ? 2
      : 1;

  for (let i = 0; i < particleCount; i++) {
    /*
     * Each edge gets its own deterministic phase.
     *
     * edge.seed makes every synapse start at a different point so all
     * particles don't move in perfect synchronisation.
     */
    const phase =
      edge.seed * 7.31 +
      i * 0.47;

    /*
     * Slow continuous movement.
     *
     * The modulo keeps the particle looping forever from start -> end.
     */
    const speed =
      0.00028 +
      (edge.seed % 1) * 0.00010;

    const progress =
      (
        time * speed +
        phase
      ) % 1;

    const point =
      cubicPoint(
        progress,
        geometry.startX,
        geometry.startY,
        geometry.control1X,
        geometry.control1Y,
        geometry.control2X,
        geometry.control2Y,
        geometry.endX,
        geometry.endY
      );

    /*
     * Fade the particle slightly near the endpoints.
     *
     * This prevents the packet from looking like it is sitting directly
     * on top of the neuron socket.
     */
    const edgeFade =
      Math.sin(progress * Math.PI);

    /*
     * Very subtle brightness pulse.
     */
    const pulse =
      0.78 +
      0.22 *
      Math.sin(
        time * 0.004 +
        phase * 9
      );

    const alpha =
      opacity *
      edgeFade *
      pulse *
      0.72;

    if (alpha <= 0.005) {
      continue;
    }

    /*
     * Soft atmospheric glow around the information packet.
     */
    drawGlow(
      ctx,
      point.x,
      point.y,
      7,
      color,
      alpha * 0.42
    );

    /*
     * Tiny bright core.
     */
    ctx.beginPath();

    ctx.fillStyle =
      `rgba(${color},${alpha})`;

    ctx.shadowColor =
      `rgba(${color},${alpha})`;

    ctx.shadowBlur = 5;

    ctx.arc(
      point.x,
      point.y,
      1.15,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Two tiny trailing particles.
     *
     * These are positioned slightly behind the main packet along the same
     * Bézier curve, creating the "information is flowing" impression.
     */
    for (let trail = 1; trail <= 2; trail++) {
      const trailProgress =
        progress -
        trail * 0.025;

      if (trailProgress < 0) {
        continue;
      }

      const trailPoint =
        cubicPoint(
          trailProgress,
          geometry.startX,
          geometry.startY,
          geometry.control1X,
          geometry.control1Y,
          geometry.control2X,
          geometry.control2Y,
          geometry.endX,
          geometry.endY
        );

      const trailAlpha =
        alpha *
        (0.32 / trail);

      ctx.beginPath();

      ctx.fillStyle =
        `rgba(${color},${trailAlpha})`;

      ctx.shadowColor =
        `rgba(${color},${trailAlpha})`;

      ctx.shadowBlur = 3;

      ctx.arc(
        trailPoint.x,
        trailPoint.y,
        0.55,
        0,
        TAU
      );

      ctx.fill();
    }
  }
}
/* -------------------------------------------------------------------------- */
/* SYNAPSE                                                                    */
/*                                                                            */
/* Render order matters: call this BEFORE drawNeuron() for the same frame so  */
/* the node's own fill/glow naturally covers the last pixel or two of the     */
/* line, reinforcing the "line enters the node" read without needing the      */
/* line itself to overshoot into the node.                                   */
/* -------------------------------------------------------------------------- */

export function drawSynapse(
  ctx: CanvasRenderingContext2D,
  edge: Synapse,
  from: Neuron,
  to: Neuron,
  simCtx: SimContext
) {
  if (
    edge.state === "hidden" ||
    edge.opacity <= MIN_ALPHA ||
    from.state === "hidden" ||
    to.state === "hidden"
  ) {
    return;
  }

  const endpointOpacity = Math.min(from.opacity, to.opacity);

  if (endpointOpacity <= MIN_ALPHA) {
    return;
  }

  const geometry = getRopeGeometry(edge, from, to, simCtx.time);

  if (!geometry) {
    return;
  }

  const energy = clamp(edge.energy + edge.pulse * 0.7);
  const depth = Math.max(from.depth, to.depth);
  const color = depthColor(depth, energy);

  // The simulation marks the focused neuron with isFocus; any synapse
  // touching the special "about" focus target fades out rather than
  // competing with it visually.
  const aboutFade = simCtx.focusId === "about" ? 0.05 : 1;

  const opacity = clamp(edge.opacity * endpointOpacity * aboutFade);

  if (opacity <= MIN_ALPHA) {
    return;
  }

  // Outer atmospheric glow — thin and dim; the glow comes from blur, not
  // from a thick stroke.
  ctx.save();
  buildRopePath(ctx, geometry);
  ctx.strokeStyle = `rgba(${color},${(0.028 + energy * 0.03) * opacity})`;
  ctx.lineWidth = 3.4 + energy * 2.1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = `rgba(${color},${0.22 * opacity})`;
  ctx.shadowBlur = 12 + energy * 7;
  ctx.stroke();
  ctx.restore();

  // Main halo.
  ctx.save();
  buildRopePath(ctx, geometry);
  ctx.strokeStyle = `rgba(${color},${(0.065 + energy * 0.05) * opacity})`;
  ctx.lineWidth = 1.7 + energy * 0.9;
  ctx.lineCap = "round";
  ctx.shadowColor = `rgba(${color},${0.28 * opacity})`;
  ctx.shadowBlur = 5 + energy * 3.5;
  ctx.stroke();
  ctx.restore();

  // Crisp neural core — thin (~0.7–1.1px), elegant, restrained.
  ctx.save();
  buildRopePath(ctx, geometry);
  ctx.strokeStyle = `rgba(${color},${(0.2 + energy * 0.13) * opacity})`;
  ctx.lineWidth = 0.72 + energy * 0.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = `rgba(${color},${0.32 * opacity})`;
  ctx.shadowBlur = 2 + energy * 2.6;
  ctx.stroke();
  ctx.restore();

  // Connection sockets — reinforce the attachment point itself.
  const socketAlpha = (0.14 + energy * 0.18) * opacity;

  drawGlow(ctx, geometry.startX, geometry.startY, 3.2 + energy * 1.8, color, socketAlpha);
  drawGlow(ctx, geometry.endX, geometry.endY, 3.2 + energy * 1.8, color, socketAlpha);

  // Decorative synaptic particles: 0–2 at idle, kept subtle so the moving
  // signal (drawSignals) is the thing that actually draws the eye.
  const particleCount = energy > 0.65 ? 2 : energy > 0.3 ? 1 : 0;

  for (let i = 0; i < particleCount; i++) {
    const baseT = (i + 1) / (particleCount + 1);

    const point = cubicPoint(
      baseT,
      geometry.startX,
      geometry.startY,
      geometry.control1X,
      geometry.control1Y,
      geometry.control2X,
      geometry.control2Y,
      geometry.endX,
      geometry.endY
    );

    const pulse =
      0.55 + 0.45 * Math.sin(simCtx.time * 0.002 + edge.seed * 21 + i * 2.8);

    const alpha = (0.2 + energy * 0.28) * pulse * opacity;

    drawGlow(ctx, point.x, point.y, 3 + energy * 3, color, alpha * 0.5);

    ctx.beginPath();
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.arc(point.x, point.y, 0.9 + energy * 0.65, 0, TAU);
    ctx.fill();
  }
  /*
   * Continuous information flow.
   */
  drawInformationParticles(
    ctx,
    edge,
    geometry,
    color,
    opacity,
    simCtx.time
  );
}

/* -------------------------------------------------------------------------- */
/* SIGNALS — reuse the exact same geometry function as drawSynapse           */
/* -------------------------------------------------------------------------- */

export function drawSignals(
  ctx: CanvasRenderingContext2D,
  signals: Signal[],
  synapses: Map<string, Synapse>,
  neurons: Map<string, Neuron>,
  simCtx: SimContext
) {
  if (!signals.length) {
    return;
  }

  const signalFade = simCtx.focusId === "about" ? 0.05 : 1;

  for (const signal of signals) {
    const edge = synapses.get(signal.synapseId);

    if (!edge) {
      continue;
    }

    const from = neurons.get(edge.fromId);
    const to = neurons.get(edge.toId);

    if (!from || !to || from.state === "hidden" || to.state === "hidden") {
      continue;
    }

    const geometry = getRopeGeometry(edge, from, to, simCtx.time);

    if (!geometry) {
      continue;
    }

    const progress = clamp(signal.progress);

    const point = cubicPoint(
      progress,
      geometry.startX,
      geometry.startY,
      geometry.control1X,
      geometry.control1Y,
      geometry.control2X,
      geometry.control2Y,
      geometry.endX,
      geometry.endY
    );

    const trailDistance = Math.min(0.12, 22 / Math.max(geometry.distance, 1));

    const trailProgress =
      signal.direction === 1
        ? Math.max(0, progress - trailDistance)
        : Math.min(1, progress + trailDistance);

    const trail = cubicPoint(
      trailProgress,
      geometry.startX,
      geometry.startY,
      geometry.control1X,
      geometry.control1Y,
      geometry.control2X,
      geometry.control2Y,
      geometry.endX,
      geometry.endY
    );

    const color =
      signal.energy > 0.75
        ? WHITE
        : depthColor(Math.max(from.depth, to.depth), signal.energy);

    // Signal trail.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(trail.x, trail.y);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = `rgba(${color},${(0.5 + signal.energy * 0.35) * signalFade})`;
    ctx.lineWidth = 1.4 + signal.energy * 1.6;
    ctx.lineCap = "round";
    ctx.shadowColor = `rgba(${color},0.95)`;
    ctx.shadowBlur = 9 + signal.energy * 9;
    ctx.stroke();
    ctx.restore();

    // Signal glow.
    drawGlow(
      ctx,
      point.x,
      point.y,
      12 + signal.energy * 15,
      color,
      0.24 * signal.energy * signalFade
    );

    // Signal core.
    ctx.beginPath();
    ctx.fillStyle = `rgba(${WHITE},${(0.72 + signal.energy * 0.28) * signalFade})`;
    ctx.arc(point.x, point.y, 1.35 + signal.energy * 2, 0, TAU);
    ctx.fill();
  }
}

/* -------------------------------------------------------------------------- */
/* PULSES                                                                     */
/* -------------------------------------------------------------------------- */

export function drawPulses(ctx: CanvasRenderingContext2D, pulses: Pulse[]) {
  if (!pulses.length) {
    return;
  }

  for (const pulse of pulses) {
    const life = clamp(pulse.life / 900);
    const opacity = (1 - life) * pulse.strength * 0.2;

    if (opacity <= 0.005) {
      continue;
    }

    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, Math.max(0, pulse.radius), 0, TAU);
    ctx.strokeStyle = `rgba(${CYAN},${opacity})`;
    ctx.lineWidth = 0.6 + pulse.strength * 0.8;
    ctx.stroke();
  }
}

/* -------------------------------------------------------------------------- */
/* NEURON TRAILS                                                              */
/* -------------------------------------------------------------------------- */

export function drawNeuronTrail(
  ctx: CanvasRenderingContext2D,
  neuron: Neuron,
  _simCtx: SimContext
) {
  if (neuron.trail.length < 2 || neuron.opacity <= MIN_ALPHA) {
    return;
  }

  const color = depthColor(neuron.depth, neuron.energy);

  ctx.save();
  ctx.beginPath();

  let first = true;

  for (const point of neuron.trail) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      continue;
    }

    if (first) {
      ctx.moveTo(point.x, point.y);
      first = false;
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }

  if (first) {
    ctx.restore();
    return;
  }

  ctx.strokeStyle = `rgba(${color},${0.08 * neuron.opacity})`;
  ctx.lineWidth = 0.8;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* NEURONS                                                                    */
/*                                                                            */
/* MEET itself is still rendered by GraphNode.tsx.                            */
/* -------------------------------------------------------------------------- */

export function drawNeuron(
  ctx: CanvasRenderingContext2D,
  neuron: Neuron,
  _simCtx: SimContext
) {
  if (neuron.state === "hidden" || neuron.opacity <= MIN_ALPHA || neuron.depth === 0) {
    return;
  }

  const point = getNodePoint(neuron);

  if (!point) {
    return;
  }

  const energy = clamp(
    neuron.energy + neuron.activity * 0.45 + neuron.firing * 0.5
  );

  const color = depthColor(neuron.depth, energy);
  const opacity = Number.isFinite(neuron.opacity) ? clamp(neuron.opacity) : 0;

  // Same function getAttachmentPoints() uses — this IS the boundary a
  // synapse attaches to, because it's the only formula for node size left.
  const visualRadius = getNeuronVisualRadius(neuron);

  if (!Number.isFinite(visualRadius) || visualRadius <= 0) {
    return;
  }

  if (energy > 0.05 && opacity > 0.05) {
    drawGlow(
      ctx,
      point.x,
      point.y,
      Math.min(visualRadius * (2.4 + energy * 2.4), 58),
      color,
      (0.024 + energy * 0.055) * opacity
    );
  }

  ctx.beginPath();
  ctx.fillStyle = `rgba(${color},${(0.35 + energy * 0.45) * opacity})`;
  ctx.arc(point.x, point.y, Math.max(0.5, visualRadius), 0, TAU);
  ctx.fill();

  if (energy > 0.08) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(${WHITE},${(0.18 + energy * 0.45) * opacity})`;
    ctx.arc(point.x, point.y, Math.max(0.5, Math.min(2.5, visualRadius * 0.24)), 0, TAU);
    ctx.fill();
  }

  if (neuron.firing > 0.15) {
    const arm = Math.min(visualRadius * (1.6 + neuron.firing * 2), 24);

    ctx.strokeStyle = `rgba(${WHITE},${clamp(neuron.firing * 0.28 * opacity)})`;
    ctx.lineWidth = 0.55;

    ctx.beginPath();
    ctx.moveTo(point.x - arm, point.y);
    ctx.lineTo(point.x + arm, point.y);
    ctx.moveTo(point.x, point.y - arm);
    ctx.lineTo(point.x, point.y + arm);
    ctx.stroke();
  }
}

/* -------------------------------------------------------------------------- */
/* CORE                                                                       */
/* -------------------------------------------------------------------------- */

export function drawCore(
  _ctx: CanvasRenderingContext2D,
  _core: Neuron,
  _simCtx: SimContext
) {
  // MEET is rendered by GraphNode.tsx.
}

/* -------------------------------------------------------------------------- */
/* POINTER FIELD                                                              */
/* -------------------------------------------------------------------------- */

export function drawPointerField(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
) {
  const radius = 80;

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

  gradient.addColorStop(0, "rgba(0,229,255,0.012)");
  gradient.addColorStop(0.55, "rgba(0,229,255,0.004)");
  gradient.addColorStop(1, "rgba(0,229,255,0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

/* -------------------------------------------------------------------------- */
/* VIGNETTE                                                                   */
/* -------------------------------------------------------------------------- */

export function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.25,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.75
  );

  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.72, "rgba(0,0,0,0.08)");
  gradient.addColorStop(1, "rgba(0,0,0,0.42)");

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
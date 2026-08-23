import {Neuron,Particle,Pulse,Signal,SimContext,Synapse,} from "./types";

const TAU = Math.PI * 2;

const CYAN = "0,229,255";
const WHITE = "238,243,255";
const MIN_ALPHA = 0.01;

// Small visual lift for synapse ropes only.
const SYNAPSE_Y_OFFSET = -18;

const clamp = (
  value: number,
  min = 0,
  max = 1
) => Math.max(min, Math.min(max, value));

const lerp = (
  a: number,
  b: number,
  t: number
) => a + (b - a) * t;

/* -------------------------------------------------------------------------- */
/* COLOR                                                                      */
/* -------------------------------------------------------------------------- */

function depthColor(
  depth: number,
  energy: number
): string {
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

  const white = clamp(
    energy * 0.45
  );

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
  if (
    alpha <= 0.002 ||
    !Number.isFinite(radius) ||
    radius <= 0.5
  ) {
    return;
  }

  const r = Math.min(
    radius,
    110
  );

  const gradient =
    ctx.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      r
    );

  gradient.addColorStop(
    0,
    `rgba(${color},${alpha})`
  );

  gradient.addColorStop(
    0.25,
    `rgba(${color},${alpha * 0.32})`
  );

  gradient.addColorStop(
    0.55,
    `rgba(${color},${alpha * 0.10})`
  );

  gradient.addColorStop(
    1,
    `rgba(${color},0)`
  );

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(
    x,
    y,
    r,
    0,
    TAU
  );
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
  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  ctx.fillStyle = "#020309";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );
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
    const scale =
      0.65 +
      particle.z * 0.55;

    /*
     * Alpha breathes very slightly.
     * Position never oscillates here.
     */
    const alpha =
      particle.alpha *
      (
        0.82 +
        0.18 *
        Math.sin(
          time * 0.001 +
          particle.seed
        )
      );

    const radius =
      particle.size *
      scale;

    if (
      alpha <= 0.005 ||
      radius <= 0.1
    ) {
      continue;
    }

    ctx.beginPath();

    ctx.fillStyle =
      `rgba(91,100,128,${alpha})`;

    ctx.arc(
      particle.x,
      particle.y,
      radius,
      0,
      TAU
    );

    ctx.fill();
  }

  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* AUTHORITATIVE NODE POSITION                                                */
/*                                                                            */
/* layout.ts produces targetX/targetY through the simulation reconciliation.  */
/* Those coordinates are treated as the visual screen-space position.         */
/*                                                                            */
/* This is the critical change. We do NOT run node endpoints through          */
/* camera.projectNeuron() for synapses. That was creating a second coordinate */
/* system and is why the wires could float away from the actual DOM nodes.    */
/* -------------------------------------------------------------------------- */

function getNodePoint(
  neuron: Neuron
) {
  const x =
    neuron.dragging
      ? neuron.x
      : neuron.targetX;

  const y =
    neuron.dragging
      ? neuron.y
      : neuron.targetY;

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return null;
  }

  return { x, y };
}

/* -------------------------------------------------------------------------- */
/* NODE RADIUS                                                                */
/* -------------------------------------------------------------------------- */

function neuronRadius(
  neuron: Neuron
): number {
  const base =
    neuron.depth === 0
      ? 12
      : neuron.depth === 1
        ? 8
        : neuron.depth === 2
          ? 5.5
          : 3.5;

  const energy = clamp(
    neuron.energy +
    neuron.activity * 0.5 +
    neuron.firing * 0.5
  );

  const focus =
    neuron.isFocus
      ? 1.18
      : 1;

  return Math.max(
    1.5,
    Math.min(
      30,
      base *
      focus *
      neuron.scale *
      (1 + energy * 0.25)
    )
  );
}

/* -------------------------------------------------------------------------- */
/* EDGE ATTACHMENT                                                            */
/*                                                                            */
/* DO NOT offset the endpoints inward.                                        */
/*                                                                            */
/* The synapse is drawn directly to the exact node center. If GraphNode is    */
/* above the canvas, the node naturally covers the last few pixels of the     */
/* line. This guarantees zero visible gaps even if CSS/node radius changes.   */
/* -------------------------------------------------------------------------- */

function getAttachmentPoints(
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
/* CURVE                                                                      */
/* -------------------------------------------------------------------------- */

function quadraticPoint(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const safeT = clamp(t);
  const u = 1 - safeT;

  return {
    x:
      u * u * x0 +
      2 * u * safeT * x1 +
      safeT * safeT * x2,

    y:
      u * u * y0 +
      2 * u * safeT * y1 +
      safeT * safeT * y2,
  };
}

/* -------------------------------------------------------------------------- */
/* ROPE CONTROL POINT                                                         */
/*                                                                            */
/* Idle  -> exact midpoint = straight line.                                   */
/* Drag  -> use physics sag, heavily clamped.                                 */
/* -------------------------------------------------------------------------- */

function getRopeControlPoint(
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
      x: (startX + endX) * 0.5,
      y: (startY + endY) * 0.5,
    };
  }

  const midX = (startX + endX) * 0.5;
  const midY = (startY + endY) * 0.5;

  const dragging = from.dragging || to.dragging;

  if (!dragging) {
    // VERY subtle organic synapse movement
    const nx = -dy / distance;
    const ny = dx / distance;

    const wiggle =
      Math.sin(time * 0.0012 + edge.seed * 3.7) * 2.2;

    return {
      x: midX + nx * wiggle,
      y: midY + ny * wiggle,
    };
  }

  // Existing drag physics
  const nx = -dy / distance;
  const ny = dx / distance;

  const rawX = Number.isFinite(edge.sagX)
    ? edge.sagX
    : midX;

  const rawY = Number.isFinite(edge.sagY)
    ? edge.sagY
    : midY;

  const offsetX = rawX - midX;
  const offsetY = rawY - midY;

  const perpendicular =
    offsetX * nx +
    offsetY * ny;

  const maxSag = Math.min(
    70,
    Math.max(10, distance * 0.12)
  );

  const safeSag = clamp(
    perpendicular,
    -maxSag,
    maxSag
  );

  return {
    x: midX + nx * safeSag,
    y: midY + ny * safeSag,
  };
}

/* -------------------------------------------------------------------------- */
/* ROPE GEOMETRY                                                              */
/* -------------------------------------------------------------------------- */

interface RopeGeometry {
  startX: number;
  startY: number;

  controlX: number;
  controlY: number;

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
  const a =
    getNodePoint(from);

  const b =
    getNodePoint(to);

  if (!a || !b) {
    return null;
  }

  const attachment =
    getAttachmentPoints(
      a.x,
      a.y + SYNAPSE_Y_OFFSET,
      b.x,
      b.y + SYNAPSE_Y_OFFSET
    );

  const distance =
    Math.hypot(
      attachment.endX -
      attachment.startX,

      attachment.endY -
      attachment.startY
    );

  if (
    !Number.isFinite(distance) ||
    distance < 1
  ) {
    return null;
  }

  const control =
    getRopeControlPoint(
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
    startX:
      attachment.startX,

    startY:
      attachment.startY,

    controlX:
      control.x,

    controlY:
      control.y,

    endX:
      attachment.endX,

    endY:
      attachment.endY,

    distance,
  };
}

function buildRopePath(
  ctx: CanvasRenderingContext2D,
  geometry: RopeGeometry
) {
  ctx.beginPath();

  ctx.moveTo(
    geometry.startX,
    geometry.startY
  );

  ctx.quadraticCurveTo(
    geometry.controlX,
    geometry.controlY,
    geometry.endX,
    geometry.endY
  );
}

/* -------------------------------------------------------------------------- */
/* SYNAPSE                                                                    */
/* -------------------------------------------------------------------------- */

export function drawSynapse(
  ctx: CanvasRenderingContext2D,
  edge: Synapse,
  from: Neuron,
  to: Neuron,
  simCtx: SimContext
) {
  if (simCtx.focusId === "about") {
    return;
  }
  if (
    edge.state === "hidden" ||
    edge.opacity <= MIN_ALPHA ||
    from.state === "hidden" ||
    to.state === "hidden"
  ) {
    return;
  }

  const endpointOpacity =
    Math.min(
      from.opacity,
      to.opacity
    );

  if (endpointOpacity <= MIN_ALPHA) {
    return;
  }

  const geometry =
    getRopeGeometry(
      edge,
      from,
      to,
      simCtx.time
    );

  if (!geometry) {
    return;
  }

  /*
   * FOCUS FADE
   *
   * The simulation marks the currently focused neuron with
   * neuron.isFocus. Any synapse connected to that neuron is
   * faded slightly so the selected node becomes the visual
   * center without completely destroying the connection.
   */

  const energy =
    clamp(
      edge.energy +
      edge.pulse * 0.7
    );

  const depth =
    Math.max(
      from.depth,
      to.depth
    );

  const color =
    depthColor(
      depth,
      energy
    );

  const isAboutSelected =
    simCtx.focusId === "about";

  const aboutFade =
    isAboutSelected
      ? 0.05
      : 1;

  const opacity =
    clamp(
      edge.opacity *
      endpointOpacity *
      aboutFade
    );

  if (opacity <= MIN_ALPHA) {
    return;
  }

  /*
   * Outer atmospheric glow.
   */
  ctx.save();

  buildRopePath(
    ctx,
    geometry
  );

  ctx.strokeStyle =
    `rgba(${color},${(
      0.035 + energy * 0.035
    ) * opacity})`;

  ctx.lineWidth =
    5 +
    energy * 3;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.shadowColor =
    `rgba(${color},${0.25 * opacity})`;

  ctx.shadowBlur =
    13 +
    energy * 8;

  ctx.stroke();

  ctx.restore();

  /*
   * Main halo.
   */
  ctx.save();

  buildRopePath(
    ctx,
    geometry
  );

  ctx.strokeStyle =
    `rgba(${color},${(
      0.075 + energy * 0.06
    ) * opacity})`;

  ctx.lineWidth =
    2.2 +
    energy * 1.1;

  ctx.lineCap = "round";

  ctx.shadowColor =
    `rgba(${color},${0.30 * opacity})`;

  ctx.shadowBlur =
    6 +
    energy * 4;

  ctx.stroke();

  ctx.restore();

  /*
   * Crisp neural core.
   */
  ctx.save();

  buildRopePath(
    ctx,
    geometry
  );

  ctx.strokeStyle =
    `rgba(${color},${(
      0.22 + energy * 0.14
    ) * opacity})`;

  ctx.lineWidth =
    0.85 +
    energy * 0.7;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.shadowColor =
    `rgba(${color},${0.35 * opacity})`;

  ctx.shadowBlur =
    2 +
    energy * 3;

  ctx.stroke();

  ctx.restore();

  /*
   * Connection sockets.
   *
   * These sit exactly on the node centers, reinforcing the attachment.
   */
  const socketAlpha =
    (
      0.16 +
      energy * 0.20
    ) *
    opacity;

  drawGlow(
    ctx,
    geometry.startX,
    geometry.startY,
    3.5 + energy * 2,
    color,
    socketAlpha
  );

  drawGlow(
    ctx,
    geometry.endX,
    geometry.endY,
    3.5 + energy * 2,
    color,
    socketAlpha
  );

  /*
   * Decorative synaptic particles.
   *
   * IMPORTANT:
   * Their position is fixed when idle. Only brightness pulses.
   */
  const particleCount =
    energy > 0.65
      ? 2
      : 1;

  for (
    let i = 0;
    i < particleCount;
    i++
  ) {
    const baseT =
      particleCount <= 1
        ? 0.5
        : 0.25 +
        (
          i /
          (particleCount - 1)
        ) *
        0.50;

    const point =
      quadraticPoint(
        baseT,
        geometry.startX,
        geometry.startY,
        geometry.controlX,
        geometry.controlY,
        geometry.endX,
        geometry.endY
      );

    const pulse =
      0.55 +
      0.45 *
      Math.sin(
        simCtx.time * 0.002 +
        edge.seed * 21 +
        i * 2.8
      );

    const alpha =
      (
        0.18 +
        energy * 0.35
      ) *
      pulse *
      opacity;

    drawGlow(
      ctx,
      point.x,
      point.y,
      4 +
      energy * 4,
      color,
      alpha * 0.55
    );

    ctx.beginPath();

    ctx.fillStyle =
      `rgba(${color},${alpha})`;

    ctx.arc(
      point.x,
      point.y,
      0.7 +
      energy * 0.7,
      0,
      TAU
    );

    ctx.fill();
  }
}

/* -------------------------------------------------------------------------- */
/* SIGNALS                                                                    */
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

  const signalFade =
    simCtx.focusId === "about"
      ? 0.05
      : 1;

  for (const signal of signals) {
    const edge =
      synapses.get(
        signal.synapseId
      );

    if (!edge) {
      continue;
    }

    const from =
      neurons.get(
        edge.fromId
      );

    const to =
      neurons.get(
        edge.toId
      );

    if (
      !from ||
      !to ||
      from.state === "hidden" ||
      to.state === "hidden"
    ) {
      continue;
    }

    const geometry =
      getRopeGeometry(
        edge,
        from,
        to,
        simCtx.time
      );

    if (!geometry) {
      continue;
    }

    const progress =
      clamp(
        signal.progress
      );

    const point =
      quadraticPoint(
        progress,
        geometry.startX,
        geometry.startY,
        geometry.controlX,
        geometry.controlY,
        geometry.endX,
        geometry.endY
      );

    const trailDistance =
      Math.min(
        0.12,
        22 /
        Math.max(
          geometry.distance,
          1
        )
      );

    const trailProgress =
      signal.direction === 1
        ? Math.max(
          0,
          progress -
          trailDistance
        )
        : Math.min(
          1,
          progress +
          trailDistance
        );

    const trail =
      quadraticPoint(
        trailProgress,
        geometry.startX,
        geometry.startY,
        geometry.controlX,
        geometry.controlY,
        geometry.endX,
        geometry.endY
      );

    const color =
      signal.energy > 0.75
        ? WHITE
        : depthColor(
          Math.max(
            from.depth,
            to.depth
          ),
          signal.energy
        );

    /*
     * Signal trail.
     */
    ctx.save();

    ctx.beginPath();

    ctx.moveTo(
      trail.x,
      trail.y
    );

    ctx.lineTo(
      point.x,
      point.y
    );

    ctx.strokeStyle =
      `rgba(${color},${(
        0.50 +
        signal.energy * 0.35
      ) * signalFade})`;

    ctx.lineWidth =
      1.4 +
      signal.energy * 1.6;

    ctx.lineCap = "round";

    ctx.shadowColor =
      `rgba(${color},0.95)`;

    ctx.shadowBlur =
      9 +
      signal.energy * 9;

    ctx.stroke();

    ctx.restore();

    /*
     * Signal glow.
     */
    drawGlow(
      ctx,
      point.x,
      point.y,
      12 + signal.energy * 15,
      color,
      0.24 * signal.energy * signalFade
    );

    /*
     * Signal core.
     */
    ctx.beginPath();

    ctx.fillStyle =
      `rgba(${WHITE},${(
        0.72 +
        signal.energy * 0.28
      ) * signalFade})`;

    ctx.arc(
      point.x,
      point.y,
      1.35 +
      signal.energy * 2,
      0,
      TAU
    );

    ctx.fill();
  }
}

/* -------------------------------------------------------------------------- */
/* PULSES                                                                     */
/* -------------------------------------------------------------------------- */

export function drawPulses(
  ctx: CanvasRenderingContext2D,
  pulses: Pulse[]
) {
  if (!pulses.length) {
    return;
  }

  for (const pulse of pulses) {
    const life =
      clamp(
        pulse.life / 900
      );

    const opacity =
      (1 - life) *
      pulse.strength *
      0.2;

    if (
      opacity <= 0.005
    ) {
      continue;
    }

    ctx.beginPath();

    ctx.arc(
      pulse.x,
      pulse.y,
      Math.max(
        0,
        pulse.radius
      ),
      0,
      TAU
    );

    ctx.strokeStyle =
      `rgba(${CYAN},${opacity})`;

    ctx.lineWidth =
      0.6 +
      pulse.strength * 0.8;

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
  if (
    neuron.trail.length < 2 ||
    neuron.opacity <= MIN_ALPHA
  ) {
    return;
  }

  const color =
    depthColor(
      neuron.depth,
      neuron.energy
    );

  ctx.save();

  ctx.beginPath();

  let first = true;

  for (
    const point of neuron.trail
  ) {
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y)
    ) {
      continue;
    }

    if (first) {
      ctx.moveTo(
        point.x,
        point.y
      );

      first = false;
    } else {
      ctx.lineTo(
        point.x,
        point.y
      );
    }
  }

  if (first) {
    ctx.restore();
    return;
  }

  ctx.strokeStyle =
    `rgba(${color},${(
      0.08 *
      neuron.opacity
    )})`;

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
  if (
    neuron.state === "hidden" ||
    neuron.opacity <= MIN_ALPHA ||
    neuron.depth === 0
  ) {
    return;
  }

  const point =
    getNodePoint(
      neuron
    );

  if (!point) {
    return;
  }

  const energy =
    clamp(
      neuron.energy +
      neuron.activity * 0.45 +
      neuron.firing * 0.5
    );

  const color =
    depthColor(
      neuron.depth,
      energy
    );

  const baseRadius =
    neuron.depth === 1
      ? 5.5
      : neuron.depth === 2
        ? 4
        : 2.4;

  const scale =
    Number.isFinite(
      neuron.scale
    )
      ? Math.max(
        0,
        neuron.scale
      )
      : 0;

  const opacity =
    Number.isFinite(
      neuron.opacity
    )
      ? clamp(
        neuron.opacity
      )
      : 0;

  const radius =
    Math.max(
      0.5,
      Math.min(
        32,
        baseRadius *
        scale *
        (
          1 +
          energy * 0.45
        ) *
        (
          1 +
          neuron.focusWeight * 0.25
        )
      )
    );

  if (
    !Number.isFinite(radius) ||
    radius <= 0
  ) {
    return;
  }

  if (
    energy > 0.05 &&
    opacity > 0.05
  ) {
    drawGlow(
      ctx,
      point.x,
      point.y,
      Math.min(
        radius *
        (
          2.4 +
          energy * 2.4
        ),
        58
      ),
      color,
      (
        0.024 +
        energy * 0.055
      ) *
      opacity
    );
  }

  const visualRadius =
    radius *
    (
      neuron.firing > 0.5
        ? 1.18
        : 1
    );

  ctx.beginPath();

  ctx.fillStyle =
    `rgba(${color},${(
      0.35 +
      energy * 0.45
    ) * opacity})`;

  ctx.arc(
    point.x,
    point.y,
    Math.max(
      0.5,
      visualRadius
    ),
    0,
    TAU
  );

  ctx.fill();

  if (
    energy > 0.08
  ) {
    ctx.beginPath();

    ctx.fillStyle =
      `rgba(${WHITE},${(
        0.18 +
        energy * 0.45
      ) * opacity})`;

    ctx.arc(
      point.x,
      point.y,
      Math.max(
        0.5,
        Math.min(
          2.5,
          radius * 0.24
        )
      ),
      0,
      TAU
    );

    ctx.fill();
  }

  if (
    neuron.firing > 0.15
  ) {
    const arm =
      Math.min(
        radius *
        (
          1.6 +
          neuron.firing * 2
        ),
        24
      );

    ctx.strokeStyle =
      `rgba(${WHITE},${clamp(
        neuron.firing *
        0.28 *
        opacity
      )})`;

    ctx.lineWidth = 0.55;

    ctx.beginPath();

    ctx.moveTo(
      point.x - arm,
      point.y
    );

    ctx.lineTo(
      point.x + arm,
      point.y
    );

    ctx.moveTo(
      point.x,
      point.y - arm
    );

    ctx.lineTo(
      point.x,
      point.y + arm
    );

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

  const gradient =
    ctx.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      radius
    );

  gradient.addColorStop(
    0,
    "rgba(0,229,255,0.012)"
  );

  gradient.addColorStop(
    0.55,
    "rgba(0,229,255,0.004)"
  );

  gradient.addColorStop(
    1,
    "rgba(0,229,255,0)"
  );

  ctx.fillStyle = gradient;

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    radius,
    0,
    TAU
  );

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
  const gradient =
    ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(
        width,
        height
      ) * 0.25,
      width * 0.5,
      height * 0.5,
      Math.max(
        width,
        height
      ) * 0.75
    );

  gradient.addColorStop(
    0,
    "rgba(0,0,0,0)"
  );

  gradient.addColorStop(
    0.72,
    "rgba(0,0,0,0.08)"
  );

  gradient.addColorStop(
    1,
    "rgba(0,0,0,0.42)"
  );

  ctx.save();

  ctx.fillStyle = gradient;

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  ctx.restore();
}
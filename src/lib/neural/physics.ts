import {
  Camera,
  Neuron,
  Particle,
  Pointer,
  Pulse,
  Signal,
  Synapse,
} from "./types";

import { screenDeltaToWorld } from "./camera";

const ENTER_MS = 380;
const EXIT_MS = 480;

const clamp = (v: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, v));

/* -------------------------------------------------------------------------- */
/* LIFECYCLE                                                                  */
/* -------------------------------------------------------------------------- */

export function updateNeuronLifecycle(n: Neuron, now: number) {
  if (n.state === "entering") {
    const t = clamp((now - n.stateSince) / ENTER_MS);
    const e = t * (2 - t);

    n.opacity = e;
    n.scale = e;

    if (t >= 1) {
      n.state = "active";
      n.stateSince = now;
    }

    return;
  }

  if (n.state === "active") {
    n.opacity += (1 - n.opacity) * 0.18;
    n.scale += (1 - n.scale) * 0.18;
    return;
  }

  if (n.state === "exiting") {
    const t = clamp((now - n.stateSince) / EXIT_MS);
    const e = 1 - t * t;

    n.opacity = e;
    n.scale = Math.max(0, e);
    n.energy *= 0.9;
    n.firing *= 0.85;

    if (t >= 1) {
      n.state = "hidden";
      n.stateSince = now;
      n.opacity = 0;
      n.scale = 0;
    }
  }
}

export function updateSynapseLifecycle(s: Synapse, now: number) {
  if (s.state === "entering") {
    const t = clamp((now - s.stateSince) / ENTER_MS);

    s.opacity = t * (2 - t);

    if (t >= 1) {
      s.state = "active";
      s.stateSince = now;
    }

    return;
  }

  if (s.state === "active") {
    s.opacity += (1 - s.opacity) * 0.18;
    return;
  }

  if (s.state === "exiting") {
    const t = clamp((now - s.stateSince) / EXIT_MS);

    s.opacity = 1 - t * t;
    s.energy *= 0.85;
    s.pulse *= 0.85;

    if (t >= 1) {
      s.state = "hidden";
      s.stateSince = now;
      s.opacity = 0;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* NODE MOTION                                                                */
/*                                                                            */
/* IMPORTANT: layout.ts is the source of truth.                              */
/*                                                                            */
/* Focus/orbit neurons are NOT continuously spring-simulated anymore.        */
/* When idle, x/y are locked exactly to targetX/targetY. This removes the    */
/* tiny perpetual velocity that was making the entire constellation wobble.  */
/* -------------------------------------------------------------------------- */

export function updateNeuronMotion(
  n: Neuron,
  _now: number,
  delta: number,
  converging: boolean,
  convergeElapsed: number
) {
  if (n.dragging) {
    return;
  }

  /*
   * Normal graph nodes:
   *
   * targetX/targetY come from layout.ts.
   * Keep the actual simulation position exactly there while idle.
   */
  if (n.isFocus || n.isOrbit) {
    n.x = n.targetX;
    n.y = n.targetY;
    n.vx = 0;
    n.vy = 0;
    n.trail.length = 0;
    return;
  }

  /*
   * Convergence is the only non-drag motion that is allowed to be physical.
   * It is used for cinematic transitions, not the resting constellation.
   */
  if (
    converging &&
    n.convergeX !== null &&
    n.convergeY !== null
  ) {
    if (convergeElapsed < n.convergeDelay) {
      return;
    }

    const dt = Math.min(Math.max(delta, 0), 32);
    const stiffness = 0.007;
    const damping = 0.76;

    n.vx =
      (n.vx + (n.convergeX - n.x) * stiffness * dt) *
      damping;

    n.vy =
      (n.vy + (n.convergeY - n.y) * stiffness * dt) *
      damping;

    n.x += n.vx * dt;
    n.y += n.vy * dt;

    if (Number.isFinite(n.x) && Number.isFinite(n.y)) {
      if (n.trail.length >= 10) {
        n.trail.shift();
      }

      n.trail.push({
        x: n.x,
        y: n.y,
      });
    }

    return;
  }

  /*
   * Semantic fallback.
   * No endless spring. Just converge once and stop.
   */
  n.x = n.targetX;
  n.y = n.targetY;
  n.vx = 0;
  n.vy = 0;
  n.trail.length = 0;
}

/* -------------------------------------------------------------------------- */
/* SYNAPSE / ROPE PHYSICS                                                     */
/*                                                                            */
/* Resting state: PERFECTLY STRAIGHT.                                         */
/*                                                                              */
/* The old implementation continuously spring-simulated sag even when        */
/* nobody was dragging anything. That created the annoying circular/rope     */
/* vibration. We now use physics only while a connected node is dragged.      */
/* -------------------------------------------------------------------------- */

export function updateSynapseSag(
  s: Synapse,
  from: Neuron,
  to: Neuron,
  delta: number
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(Math.hypot(dx, dy), 1);

  if (!Number.isFinite(length)) {
    return;
  }

  const midX = (from.x + to.x) * 0.5;
  const midY = (from.y + to.y) * 0.5;

  const dragging =
    from.dragging ||
    to.dragging;

  /*
   * IDLE:
   *
   * Hard-lock the control point to the midpoint.
   * This guarantees a single straight synapse with zero vibration.
   */
  if (!dragging) {
    const returnSpeed = 0.035;

    s.sagX += (midX - s.sagX) * returnSpeed;
    s.sagY += (midY - s.sagY) * returnSpeed;

    s.sagVX *= 0.9;
    s.sagVY *= 0.9;

    return;
  }

  /*
   * DRAGGING:
   *
   * Now the cable is allowed to bend. The bend is perpendicular to the
   * actual A -> B direction, so it can never create a weird circular loop.
   */
  const nx = -dy / length;
  const ny = dx / length;

  const velocityX = (from.vx + to.vx) * 0.5;
  const velocityY = (from.vy + to.vy) * 0.5;
  const velocityMagnitude = Math.hypot(
    velocityX,
    velocityY
  );

  const safeVelocity = Math.min(
    velocityMagnitude,
    100
  );

  const lag = Math.min(safeVelocity * 0.008, 10);

  let lagX = 0;
  let lagY = 0;

  if (velocityMagnitude > 0.001) {
    lagX =
      -(velocityX / velocityMagnitude) *
      lag;

    lagY =
      -(velocityY / velocityMagnitude) *
      lag;
  }

  const bendDirection =
    s.seed < 0.5
      ? -1
      : 1;

  const sag = Math.min(
    length * 0.10,
    70
  );

  const targetX =
    midX +
    nx * sag * bendDirection +
    lagX;

  const targetY =
    midY +
    ny * sag * bendDirection +
    lagY;

  if (
    !Number.isFinite(targetX) ||
    !Number.isFinite(targetY)
  ) {
    return;
  }

  /*
   * First initialization.
   */
  if (
    !Number.isFinite(s.sagX) ||
    !Number.isFinite(s.sagY)
  ) {
    s.sagX = midX;
    s.sagY = midY;
    s.sagVX = 0;
    s.sagVY = 0;
  }

  const dt = Math.min(
    Math.max(delta, 0),
    32
  );

  const stiffness = 0.0001;
  const damping = 0.999;

  s.sagVX +=
    (targetX - s.sagX) *
    stiffness *
    dt;

  s.sagVY +=
    (targetY - s.sagY) *
    stiffness *
    dt;

  s.sagVX *= Math.pow(
    damping,
    dt / 16.67
  );

  s.sagVY *= Math.pow(
    damping,
    dt / 16.67
  );

  s.sagX += s.sagVX * dt;
  s.sagY += s.sagVY * dt;

  /*
   * Hard geometric limit.
   */
  const maxOffset = Math.min(
    Math.max(length * 0.28, 30),
    95
  );

  const offsetX = s.sagX - midX;
  const offsetY = s.sagY - midY;
  const offsetDistance = Math.hypot(
    offsetX,
    offsetY
  );

  if (
    offsetDistance > maxOffset &&
    offsetDistance > 0.001
  ) {
    const scale =
      maxOffset /
      offsetDistance;

    s.sagX =
      midX +
      offsetX * scale;

    s.sagY =
      midY +
      offsetY * scale;

    s.sagVX *= 0.25;
    s.sagVY *= 0.25;
  }

  if (
    !Number.isFinite(s.sagX) ||
    !Number.isFinite(s.sagY)
  ) {
    s.sagX = midX;
    s.sagY = midY;
    s.sagVX = 0;
    s.sagVY = 0;
  }
}

/* -------------------------------------------------------------------------- */
/* DRAGGING                                                                   */
/* -------------------------------------------------------------------------- */

export function beginDrag(
  pointer: Pointer,
  neuron: Neuron,
  _screenX: number,
  _screenY: number
) {
  pointer.down = true;
  pointer.draggingId = neuron.id;

  neuron.dragging = true;

  pointer.dragDX = 0;
  pointer.dragDY = 0;
}

export function updateDrag(
  neuron: Neuron,
  camera: Camera,
  dxScreen: number,
  dyScreen: number
) {
  const {
    dx,
    dy,
  } = screenDeltaToWorld(
    dxScreen,
    dyScreen,
    neuron.z,
    camera
  );

  neuron.x += dx;
  neuron.y += dy;

  neuron.vx = dx;
  neuron.vy = dy;
}

export function endDrag(
  pointer: Pointer,
  neuron?: Neuron
) {
  pointer.down = false;
  pointer.draggingId = null;

  if (neuron) {
    neuron.dragging = false;
    neuron.vx = 0;
    neuron.vy = 0;
  }
}

/* -------------------------------------------------------------------------- */
/* NEURAL FIRING                                                              */
/* -------------------------------------------------------------------------- */

let signalCounter = 0;

export function fireNeuron(
  neuron: Neuron,
  neurons: Map<string, Neuron>,
  synapses: Map<string, Synapse>,
  signals: Signal[],
  pulses: Pulse[],
  now: number,
  energy = 1
) {
  if (
    neuron.state !== "active" ||
    neuron.refractoryUntil > now
  ) {
    return;
  }

  neuron.energy = Math.max(
    neuron.energy,
    energy
  );

  neuron.activity = Math.max(
    neuron.activity,
    energy
  );

  neuron.firing = Math.max(
    neuron.firing,
    energy
  );

  neuron.refractoryUntil =
    now +
    180 +
    Math.random() * 180;

  pulses.push({
    x: neuron.x,
    y: neuron.y,
    radius: 0,
    life: 0,
    strength: energy,
  });

  const connected = [
    ...synapses.values(),
  ].filter(
    (s) =>
      s.state === "active" &&
      (
        s.fromId === neuron.id ||
        s.toId === neuron.id
      )
  );

  if (!connected.length) {
    return;
  }

  const count = Math.min(
    connected.length,
    energy > 0.75 ? 3 : 2
  );

  for (let i = 0; i < count; i++) {
    const edge =
      connected[
      Math.floor(
        Math.random() *
        connected.length
      )
      ];

    if (!edge) {
      continue;
    }

    const direction: 1 | -1 =
      edge.fromId === neuron.id
        ? 1
        : -1;

    signals.push({
      id: signalCounter++,
      synapseId: edge.id,
      progress:
        direction === 1
          ? 0
          : 1,
      direction,
      energy:
        energy *
        (0.55 + Math.random() * 0.35),
      speed:
        0.0008 +
        Math.random() * 0.001,
      age: 0,
    });

    edge.energy = Math.max(
      edge.energy,
      energy
    );

    edge.pulse = Math.max(
      edge.pulse,
      energy
    );
  }
}

export function spontaneousFire(
  neurons: Map<string, Neuron>,
  synapses: Map<string, Synapse>,
  signals: Signal[],
  pulses: Pulse[],
  now: number,
  lastRef: { current: number },
  reducedMotion: boolean
) {
  if (
    reducedMotion ||
    now - lastRef.current < 900
  ) {
    return;
  }

  lastRef.current = now;

  const candidates = [
    ...neurons.values(),
  ].filter(
    (n) =>
      n.state === "active" &&
      !n.isFocus
  );

  if (!candidates.length) {
    return;
  }

  const n =
    candidates[
    Math.floor(
      Math.random() *
      candidates.length
    )
    ];

  if (n) {
    fireNeuron(
      n,
      neurons,
      synapses,
      signals,
      pulses,
      now,
      n.depth <= 1
        ? 0.75
        : 0.3 +
        Math.random() *
        0.45
    );
  }
}

export function updateSignals(
  signals: Signal[],
  synapses: Map<string, Synapse>,
  neurons: Map<string, Neuron>,
  pulses: Pulse[],
  now: number,
  delta: number
) {
  for (
    let i = signals.length - 1;
    i >= 0;
    i--
  ) {
    const signal = signals[i];

    if (!signal) {
      continue;
    }

    const edge =
      synapses.get(
        signal.synapseId
      );

    if (
      !edge ||
      edge.state === "hidden" ||
      edge.state === "exiting"
    ) {
      signals.splice(i, 1);
      continue;
    }

    signal.age += delta;

    signal.progress +=
      signal.speed *
      delta *
      signal.direction;

    const finished =
      signal.direction === 1
        ? signal.progress >= 1
        : signal.progress <= 0;

    if (
      finished ||
      signal.age > 3500
    ) {
      const target =
        neurons.get(
          signal.direction === 1
            ? edge.toId
            : edge.fromId
        );

      if (target) {
        fireNeuron(
          target,
          neurons,
          synapses,
          signals,
          pulses,
          now,
          signal.energy
        );
      }

      signals.splice(i, 1);
      continue;
    }

    signal.energy *= 0.999;
  }
}

export function updatePulses(
  pulses: Pulse[],
  delta: number
) {
  for (
    let i = pulses.length - 1;
    i >= 0;
    i--
  ) {
    const p = pulses[i];

    if (!p) {
      continue;
    }

    p.life += delta;
    p.radius += delta * 0.14;

    if (p.life > 900) {
      pulses.splice(i, 1);
    }
  }
}

export function decayNeuronActivity(
  n: Neuron
) {
  n.energy *= 0.975;
  n.activity *= 0.985;
  n.firing *= 0.91;
}

export function decaySynapseActivity(
  s: Synapse
) {
  s.energy *= 0.965;
  s.pulse *= 0.91;
}

/* -------------------------------------------------------------------------- */
/* AMBIENT PARTICLES                                                          */
/* -------------------------------------------------------------------------- */

export function createParticles(
  count: number,
  width: number,
  height: number
): Particle[] {
  return Array.from(
    { length: count },
    () => ({
      x:
        Math.random() *
        width,

      y:
        Math.random() *
        height,

      z:
        0.15 +
        Math.random() *
        0.85,

      vx:
        (Math.random() - 0.5) *
        0.08,

      vy:
        (Math.random() - 0.5) *
        0.08,

      size:
        0.35 +
        Math.random() *
        1.15,

      alpha:
        0.025 +
        Math.random() *
        0.08,

      seed:
        Math.random() *
        1000,
    })
  );
}

export function updateParticle(
  p: Particle,
  width: number,
  height: number,
  reducedMotion: boolean
) {
  if (!reducedMotion) {
    const dx =
      p.x -
      width * 0.5;

    const dy =
      p.y -
      height * 0.5;

    const distance =
      Math.max(
        Math.hypot(dx, dy),
        1
      );

    p.vx +=
      (-dy / distance) *
      0.001;

    p.vy +=
      (dx / distance) *
      0.001;

    p.vx *= 0.995;
    p.vy *= 0.995;

    p.x += p.vx;
    p.y += p.vy;
  }

  if (
    p.x < -50 ||
    p.x > width + 50 ||
    p.y < -50 ||
    p.y > height + 50
  ) {
    p.x =
      Math.random() *
      width;

    p.y =
      Math.random() *
      height;
  }
}
import { Camera, Neuron, Pointer, SimContext } from "./types";

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const damp = (value: number, factor: number) =>
  value * Math.pow(factor, 1 / 60);

export function createCamera(): Camera {
  return {
    x: 0,
    y: 0,
    zoom: 1,

    targetX: 0,
    targetY: 0,
    targetZoom: 1,

    vx: 0,
    vy: 0,
    vzoom: 0,

    roll: 0,
    targetRoll: 0,

    push: 0,
    targetPush: 0,
  };
}

/**
 * Focus the camera on a neuron/world point.
 *
 * The target changes immediately, while the physical camera catches up
 * through spring interpolation. This makes interaction feel instant without
 * producing a hard teleport.
 */
export function focusCamera(
  camera: Camera,
  worldX: number,
  worldY: number,
  centerX: number,
  centerY: number,
  zoom = 1.15
) {
  camera.targetX = worldX - centerX;
  camera.targetY = worldY - centerY;
  camera.targetZoom = clamp(zoom, 0.75, 2.2);

  camera.targetPush = Math.min(0.08, Math.max(0, zoom - 1) * 0.08);
  camera.targetRoll = 0;
}

/**
 * Focus directly on a neuron.
 *
 * Deeper nodes receive a slightly stronger camera push, making navigation
 * feel like travelling deeper into the neural hierarchy.
 */
export function focusNeuron(
  camera: Camera,
  neuron: Neuron,
  width: number,
  height: number
) {
  const depthZoom =
    neuron.isFocus
      ? 1.12
      : 1.05 + Math.min(neuron.depth, 5) * 0.035;

  focusCamera(
    camera,
    neuron.x,
    neuron.y,
    width / 2,
    height / 2,
    depthZoom
  );
}

/**
 * Return the neural camera to its neutral position.
 */
export function resetCameraFocus(camera: Camera) {
  camera.targetX = 0;
  camera.targetY = 0;
  camera.targetZoom = 1;
  camera.targetRoll = 0;
  camera.targetPush = 0;
}

/**
 * Small cinematic impulse used after major node activation.
 */
export function cameraImpact(
  camera: Camera,
  strength = 1
) {
  const s = clamp(strength, 0, 1);

  camera.targetPush = 0.045 * s;
  camera.vzoom += 0.004 * s;
  camera.targetRoll += 0.0025 * s;
}

/**
 * Smooth spring camera.
 *
 * The camera follows:
 *
 *   focus target
 *       +
 *   subtle mouse parallax
 *       +
 *   cinematic push
 *
 * rather than directly following the cursor.
 */
export function updateCamera(
  camera: Camera,
  pointer: Pointer,
  reducedMotion: boolean,
  time: number,
  delta: number
) {
  const dt = clamp(delta / 16.67, 0.35, 2.5);

  const stiffness = reducedMotion ? 0.16 : 0.11;
  const damping = reducedMotion ? 0.72 : 0.78;

  let parallaxX = 0;
  let parallaxY = 0;

  if (pointer.active && !reducedMotion) {
    const nx = clamp(
      pointer.x / Math.max(1, 1920),
      0,
      1
    ) - 0.5;

    const ny = clamp(
      pointer.y / Math.max(1, 1080),
      0,
      1
    ) - 0.5;

    parallaxX = nx * 34;
    parallaxY = ny * 24;
  }

  const targetX = camera.targetX + parallaxX;
  const targetY = camera.targetY + parallaxY;

  const dx = targetX - camera.x;
  const dy = targetY - camera.y;
  const dz =
    camera.targetZoom +
    camera.targetPush -
    camera.zoom;

  camera.vx += dx * stiffness * dt;
  camera.vy += dy * stiffness * dt;
  camera.vzoom += dz * stiffness * dt;

  camera.vx *= Math.pow(damping, dt);
  camera.vy *= Math.pow(damping, dt);
  camera.vzoom *= Math.pow(damping, dt);

  camera.x += camera.vx * dt;
  camera.y += camera.vy * dt;
  camera.zoom += camera.vzoom * dt;

  camera.zoom = clamp(camera.zoom, 0.72, 2.4);

  // Push decays naturally after activation.
  camera.targetPush = damp(
    camera.targetPush,
    reducedMotion ? 0.55 : 0.88
  );

  camera.push +=
    (camera.targetPush - camera.push) *
    Math.min(1, 0.12 * dt);

  // Roll is almost imperceptible. It exists to make large transitions feel
  // spatial rather than like a normal DOM zoom.
  if (!reducedMotion) {
    const idleRoll =
      Math.sin(time * 0.00018) * 0.0015;

    camera.targetRoll +=
      (idleRoll - camera.targetRoll) * 0.025 * dt;
  } else {
    camera.targetRoll = 0;
  }

  camera.roll +=
    (camera.targetRoll - camera.roll) *
    Math.min(1, 0.08 * dt);
}

/**
 * Project a world-space neural position onto the screen.
 *
 * `z` creates a convincing pseudo-3D depth layer:
 *
 * background → smaller / dimmer / slower
 * foreground → larger / brighter / more responsive
 */
export function project(
  x: number,
  y: number,
  z: number,
  seedWobbleX: number,
  seedWobbleY: number,
  ctx: SimContext
) {
  const {
    width,
    height,
    camera,
    pointer,
    reducedMotion,
  } = ctx;

  const depth = clamp(z, 0, 1);

  let wx = x;
  let wy = y;

  if (!reducedMotion) {
    wx += seedWobbleX * depth;
    wy += seedWobbleY * depth;
  }

  // Very subtle cursor parallax.
  if (pointer.active && !reducedMotion) {
    const dx = pointer.x - width / 2;
    const dy = pointer.y - height / 2;

    wx += dx * depth * 0.012;
    wy += dy * depth * 0.012;
  }

  // Camera translation.
  wx -= camera.x * (0.55 + depth * 0.45);
  wy -= camera.y * (0.55 + depth * 0.45);

  // Perspective.
  const perspective =
    camera.zoom *
    (0.76 + depth * 0.42);

  const cx = width / 2;
  const cy = height / 2;

  // Cinematic roll around the viewport center.
  const rx = wx - cx;
  const ry = wy - cy;

  const cos = Math.cos(camera.roll);
  const sin = Math.sin(camera.roll);

  const rolledX =
    rx * cos -
    ry * sin;

  const rolledY =
    rx * sin +
    ry * cos;

  const screenX =
    cx + rolledX * perspective;

  const screenY =
    cy + rolledY * perspective;

  return {
    x: screenX,
    y: screenY,

    scale:
      perspective *
      (0.72 + depth * 0.42),

    perspective,
    depth,
  };
}

/**
 * Project a persistent neuron using its individual pseudo-depth and
 * deterministic organic movement.
 */
export function projectNeuron(
  neuron: Neuron,
  ctx: SimContext
) {
  return project(
    neuron.x,
    neuron.y,
    neuron.z,
    0,
    0,
    ctx
  );
}

/**
 * Convert a screen-space drag delta back into world space.
 */
export function screenDeltaToWorld(
  dxScreen: number,
  dyScreen: number,
  z: number,
  camera: Camera
) {
  const depth = clamp(z, 0, 1);

  const perspective =
    camera.zoom *
    (0.76 + depth * 0.42);

  const safePerspective =
    Math.max(perspective, 0.0001);

  return {
    dx: dxScreen / safePerspective,
    dy: dyScreen / safePerspective,
  };
}
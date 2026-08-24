"use client";

import { useEffect, useRef } from "react";
import { sfx } from "@/lib/sound";

/* ================================================================
 * TYPES
 * ================================================================ */

type NodeState = "forming" | "travelling" | "thinking" | "connecting" | "firing" | "decaying";
type Tier = "core" | "primary" | "secondary" | "micro";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;

  anchorX: number;
  anchorY: number;

  depth: number;
  branch: number;
  index: number;

  r: number;
  seed: number;
  birth: number;

  targetVx: number;
  targetVy: number;
  changeTimer: number;
  changeInterval: number;
  maxDrift: number;

  pulsePhase: number;
  tier: Tier;

  state: NodeState;
  stateUntil: number;
  fireUntil: number;

  alive: boolean;
  deathAt: number | null;
  fadeOutUntil: number | null;

  zDepth: number;
  waveHitId: number;
  localFactor: number;
}

interface Edge {
  a: Node;
  b: Node;
  width: number;
  seed: number;
  curveAmount: number;
  birthOverride: number | null;
  growUntil: number | null;
  growStart: number | null;
  isSecondary: boolean;
  boomed: boolean;
}

interface Signal {
  edge: Edge;
  progress: number;
  speed: number;
  size: number;
  direction: 1 | -1;
}

interface Pulse {
  edge: Edge;
  fromNode: Node;
  progress: number;
  speed: number;
  energy: number;
  bright?: boolean;
}

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  seed: number;
}

interface TopologyEvent {
  at: number;
  kind: "split" | "connect";
  done: boolean;
}

interface ScheduledEvent {
  at: number;
  done: boolean;
}

interface Wave {
  startElapsed: number;
  speed: number;
  soundPlayed: boolean;
}

interface LocalStorm {
  x: number;
  y: number;
  radius: number;
  start: number;
  duration: number;
}

interface DeadZone {
  x: number;
  y: number;
  radius: number;
  start: number;
  duration: number;
}

interface Conduit {
  chain: Edge[];
  s: number;
  speed: number;
}

interface DeathBurst {
  x: number;
  y: number;
  start: number;
}

const COLORS = {
  cyan: "0,229,255",
  white: "255,255,255",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function colorTransition(whiteProgress: number) {
  const t = clamp(whiteProgress, 0, 1);
  const r = Math.round(255 * t);
  const g = Math.round(229 + 26 * t);
  return `${r},${g},255`;
}

function curvedPoint(a: Node, b: Node, curveAmount: number, t: number, bendX: number, bendY: number) {
  const mx = (a.x + b.x) / 2 + bendX;
  const my = (a.y + b.y) / 2 + bendY;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;

  const cx = mx + px * curveAmount;
  const cy = my + py * curveAmount;

  const it = 1 - t;
  const x = it * it * a.x + 2 * it * t * cx + t * t * b.x;
  const y = it * it * a.y + 2 * it * t * cy + t * t * b.y;
  return { x, y, cx, cy };
}

export default function ActivationSequence({
  reducedMotion,
  isMobile,
  onDone,
}: {
  reducedMotion: boolean;
  isMobile: boolean;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame = 0;
    let cancelled = false;

    /* ============================================================
     * CANVAS
     * ============================================================ */
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75);
    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    /* ============================================================
     * CORE POSITION
     * ============================================================ */
    let cx = W / 2;
    let cy = H / 2 - 52;

    /* ============================================================
     * TIMING
     * ============================================================ */
    const duration = reducedMotion ? 4000 : 10000;

    /* ============================================================
     * NETWORK SETTINGS
     * ============================================================ */
    const branchCount = isMobile ? 30 : 58;
    const nodesPerBranch = isMobile ? 8 : 13;
    const horizontalRadius = W * 0.63;
    const verticalRadius = H * 0.67;
    const branchLength = Math.min(W, H) * 0.3;

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const signals: Signal[] = [];
    const pulses: Pulse[] = [];
    const adjacency = new Map<Node, Edge[]>();

    const maxDynamicNodes = isMobile ? 36 : 110;
    let dynamicNodesSpawned = 0;
    const maxPulses = isMobile ? 18 : 42;

    function link(node: Node) {
      if (!adjacency.has(node)) adjacency.set(node, []);
    }

    const edgeKeys = new Set<string>();

    function getEdgeKey(a: Node, b: Node) {
      const ai = nodes.indexOf(a);
      const bi = nodes.indexOf(b);
      return ai < bi ? `${ai}:${bi}` : `${bi}:${ai}`;
    }

    function addEdge(a: Node, b: Node, width: number, opts?: Partial<Edge>): Edge | null {
      const key = getEdgeKey(a, b);
      if (edgeKeys.has(key)) {
        return null;
      }
      edgeKeys.add(key);

      const edge: Edge = {
        a,
        b,
        width,
        seed: Math.random(),
        curveAmount: (Math.random() - 0.5) * 26,
        birthOverride: null,
        growUntil: null,
        growStart: null,
        isSecondary: false,
        boomed: false,
        ...opts,
      };
      edges.push(edge);
      link(a);
      link(b);
      adjacency.get(a)!.push(edge);
      adjacency.get(b)!.push(edge);
      return edge;
    }

    function randomZDepth() {
      return 0.55 + Math.pow(Math.random(), 1.4) * 0.8;
    }

    /* ============================================================
     * CENTRAL CORE
     * ============================================================ */
    const core: Node = {
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      anchorX: cx,
      anchorY: cy,
      depth: 0,
      branch: -1,
      index: 0,
      r: 7,
      seed: Math.random(),
      birth: 0,
      targetVx: 0,
      targetVy: 0,
      changeTimer: 0,
      changeInterval: 999999,
      maxDrift: 0,
      pulsePhase: Math.random() * Math.PI * 2,
      tier: "core",
      state: "thinking",
      stateUntil: Infinity,
      fireUntil: 0,
      alive: true,
      deathAt: null,
      fadeOutUntil: null,
      zDepth: 1,
      waveHitId: -1,
      localFactor: 1,
    };
    nodes.push(core);
    link(core);

    const branchHeads: Node[] = [];
    const branchChains: Edge[][] = [];

    /* ============================================================
     * GENERATE NEURAL TOPOLOGY
     * ============================================================ */
    for (let branch = 0; branch < branchCount; branch++) {
      const clusterBias = Math.floor(Math.random() * 5) * ((Math.PI * 2) / 5);
      const angle =
        clusterBias * 0.35 +
        (branch / branchCount) * Math.PI * 2 * 0.65 +
        (Math.random() - 0.5) * 0.55;

      const length = branchLength * (0.6 + Math.random() * 0.45);
      const curvature = (Math.random() - 0.5) * 0.5;

      let parent = core;
      const chain: Edge[] = [];

      for (let i = 0; i < nodesPerBranch; i++) {
        const t = i / (nodesPerBranch - 1);
        const distance = 10 + Math.pow(t, 0.72) * length;
        const localAngle = angle + curvature * t * t;
        const perpendicular = Math.sin(t * Math.PI) * curvature * length * 0.2;

        const px = -Math.sin(angle);
        const py = Math.cos(angle);
        const normalized = distance / branchLength;

        const anchorX = cx + Math.cos(localAngle) * horizontalRadius * normalized + px * perpendicular;
        const anchorY = cy + Math.sin(localAngle) * verticalRadius * normalized + py * perpendicular;

        const maxDrift = 5 + t * 25;
        const isHead = i === nodesPerBranch - 1;
        const randomDirection = Math.random() * Math.PI * 2;
        const randomSpeed = 8 + Math.random() * 22;

        let tier: Tier = "micro";
        if (isHead) tier = "primary";
        else if (i <= 1) tier = "primary";
        else if (i % 3 === 0) tier = "secondary";

        const willDie = tier === "micro" && Math.random() < 0.16;

        const node: Node = {
          x: anchorX,
          y: anchorY,
          vx: 0,
          vy: 0,
          anchorX,
          anchorY,
          depth: i,
          branch,
          index: i,
          r: isHead ? 3.5 + Math.random() * 2.5 : 0.8 + Math.random() * 1.7,
          seed: Math.random(),
          birth: 0.025 + t * 0.62 + Math.random() * 0.04,
          targetVx: Math.cos(randomDirection) * randomSpeed,
          targetVy: Math.sin(randomDirection) * randomSpeed,
          changeTimer: Math.random() * 700,
          changeInterval: 350 + Math.random() * 900,
          maxDrift,
          pulsePhase: Math.random() * Math.PI * 2,
          tier,
          state: "forming",
          stateUntil: 0,
          fireUntil: 0,
          alive: true,
          deathAt: willDie ? 0.42 + Math.random() * 0.4 : null,
          fadeOutUntil: null,
          zDepth: isHead ? 0.9 + Math.random() * 0.45 : randomZDepth(),
          waveHitId: -1,
          localFactor: 1,
        };

        nodes.push(node);

        const edge = addEdge(
          parent,
          node,
          isHead ? 0.65 + Math.random() * 0.55 : 0.35 + Math.random() * 0.5
        );
        if (edge) chain.push(edge);

        parent = node;
      }

      branchHeads.push(parent);
      branchChains.push(chain);
    }

    /* ============================================================
     * SECONDARY LOCAL CONNECTIONS
     * ============================================================ */
    for (let i = 1; i < nodes.length; i++) {
      const node = nodes[i];
      const connectionAttempts = isMobile ? 1 : 2;

      for (let k = 0; k < connectionAttempts; k++) {
        if (Math.random() > 0.35) continue;

        let closest: Node | null = null;
        let closestDistance = Infinity;

        const start = Math.max(1, i - 60);
        const end = Math.min(nodes.length, i + 60);

        for (let j = start; j < end; j++) {
          const candidate = nodes[j];
          if (candidate === node) continue;
          const dx = node.anchorX - candidate.anchorX;
          const dy = node.anchorY - candidate.anchorY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > 15 && distance < 115 && distance < closestDistance) {
            closest = candidate;
            closestDistance = distance;
          }
        }

        if (closest) {
          addEdge(node, closest, 0.18 + Math.random() * 0.35, { isSecondary: true });
        }
      }
    }

    /* ============================================================
     * SCHEDULED TOPOLOGY EVENTS
     * ============================================================ */
    const topologyEvents: TopologyEvent[] = [];
    const eventCount = isMobile ? 4 : 7;
    for (let i = 0; i < eventCount; i++) {
      topologyEvents.push({
        at: 0.16 + (i / eventCount) * 0.6 + Math.random() * 0.05,
        kind: Math.random() < 0.6 ? "split" : "connect",
        done: false,
      });
    }

    function spawnSplit(progressNow: number) {
      if (dynamicNodesSpawned >= maxDynamicNodes) return;
      const candidates = nodes.filter((n) => n.tier !== "core" && n.depth >= 2 && n.alive);
      if (candidates.length === 0) return;
      const parent = candidates[(Math.random() * candidates.length) | 0];

      const branchOut = 2 + Math.floor(Math.random() * 3);
      const baseAngle = Math.random() * Math.PI * 2;

      let prev = parent;
      for (let i = 0; i < branchOut; i++) {
        if (dynamicNodesSpawned >= maxDynamicNodes) break;
        const angle = baseAngle + (i - branchOut / 2) * 0.5;
        const dist = 20 + Math.random() * 46;
        const anchorX = prev.anchorX + Math.cos(angle) * dist;
        const anchorY = prev.anchorY + Math.sin(angle) * dist;

        const child: Node = {
          x: parent.x,
          y: parent.y,
          vx: 0,
          vy: 0,
          anchorX,
          anchorY,
          depth: parent.depth + i + 1,
          branch: parent.branch,
          index: parent.index + i + 1,
          r: 0.9 + Math.random() * 1.4,
          seed: Math.random(),
          birth: progressNow + 0.01,
          targetVx: (Math.random() - 0.5) * 30,
          targetVy: (Math.random() - 0.5) * 30,
          changeTimer: Math.random() * 500,
          changeInterval: 300 + Math.random() * 700,
          maxDrift: 14,
          pulsePhase: Math.random() * Math.PI * 2,
          tier: i === branchOut - 1 ? "secondary" : "micro",
          state: "forming",
          stateUntil: 0,
          fireUntil: 0,
          alive: true,
          deathAt: null,
          fadeOutUntil: null,
          zDepth: randomZDepth(),
          waveHitId: -1,
          localFactor: 1,
        };
        nodes.push(child);
        addEdge(prev, child, 0.3 + Math.random() * 0.3, { birthOverride: progressNow });
        dynamicNodesSpawned++;
        prev = child;
      }

      sfx.token();
    }

    function spawnConnection(progressNow: number) {
      const alive = nodes.filter((n) => n.tier !== "core" && n.alive);
      if (alive.length < 2) return;
      const a = alive[(Math.random() * alive.length) | 0];

      let b: Node | null = null;
      let bestDist = -1;
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = alive[(Math.random() * alive.length) | 0];
        if (candidate === a) continue;
        const dx = candidate.anchorX - a.anchorX;
        const dy = candidate.anchorY - a.anchorY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 90 && d < 340 && d > bestDist) {
          bestDist = d;
          b = candidate;
        }
      }
      if (!b) return;

      addEdge(a, b, 0.5 + Math.random() * 0.4, {
        birthOverride: progressNow,
        isSecondary: true,
      });

      sfx.expand();
    }

    /* ============================================================
     * ENERGY SIGNALS
     * ============================================================ */
    const signalCount = isMobile ? 30 : 100;
    for (let i = 0; i < signalCount; i++) {
      const edge = edges[Math.floor(Math.random() * edges.length)];
      signals.push({
        edge,
        progress: Math.random(),
        speed: 0.002 + Math.random() * 0.004,
        size: 0.7 + Math.random() * 1.6,
        direction: Math.random() > 0.5 ? 1 : -1,
      });
    }

    /* ============================================================
     * AMBIENT PARTICLES
     * ============================================================ */
    const ambientParticles: AmbientParticle[] = [];
    const particleCount = isMobile ? 60 : 150;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.pow(Math.random(), 0.55) * Math.min(W, H) * 0.72;
      ambientParticles.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: 0.25 + Math.random() * 0.8,
        alpha: 0.04 + Math.random() * 0.15,
        seed: Math.random(),
      });
    }

    /* ============================================================
     * MOUSE
     * ============================================================ */
    const mouse = { x: -9999, y: -9999, active: false };
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    let mouseFrame = 0;
    let mouseNodeX = -9999;
    let mouseNodeY = -9999;
    let mouseNodeActive = false;

    function updateMouseCache() {
      mouseNodeX = mouse.x;
      mouseNodeY = mouse.y;
      mouseNodeActive = mouse.active && !reducedMotion;
    }

    /* ============================================================
     * ENERGY WAVES
     * ============================================================ */
    const waves: Wave[] = [];
    const waveEvents: ScheduledEvent[] = [];
    const waveEventCount = isMobile ? 3 : 5;
    for (let i = 0; i < waveEventCount; i++) {
      waveEvents.push({ at: 0.22 + (i / waveEventCount) * 0.62 + Math.random() * 0.04, done: false });
    }

    /* ============================================================
     * LOCAL NEURAL STORMS
     * ============================================================ */
    const localStorms: LocalStorm[] = [];
    let nextLocalStormAt = 1400 + Math.random() * 800;

    function spawnLocalStorm(elapsed: number) {
      if (localStorms.length >= 2) return;
      const anchor = nodes[1 + ((Math.random() * (nodes.length - 1)) | 0)];
      localStorms.push({
        x: anchor.anchorX,
        y: anchor.anchorY,
        radius: 90 + Math.random() * 70,
        start: elapsed,
        duration: 500 + Math.random() * 400,
      });
    }

    /* ============================================================
     * DEAD ZONES
     * ============================================================ */
    const deadZones: DeadZone[] = [];
    const deadZoneEvents: ScheduledEvent[] = [];
    const deadZoneEventCount = isMobile ? 1 : 2;
    for (let i = 0; i < deadZoneEventCount; i++) {
      deadZoneEvents.push({ at: 0.3 + (i / deadZoneEventCount) * 0.4 + Math.random() * 0.08, done: false });
    }

    function spawnDeadZone(elapsed: number) {
      const anchor = nodes[1 + ((Math.random() * (nodes.length - 1)) | 0)];
      deadZones.push({
        x: anchor.anchorX,
        y: anchor.anchorY,
        radius: 110 + Math.random() * 60,
        start: elapsed,
        duration: 1000 + Math.random() * 500,
      });
    }

    /* ============================================================
     * FINALE CONDUITS
     * ============================================================ */
    const conduits: Conduit[] = [];
    let conduitsSpawned = false;

    function spawnConduits() {
      const pool = branchChains.filter((c) => c.length > 0);
      const count = isMobile ? Math.min(10, pool.length) : Math.min(22, pool.length);
      for (let i = 0; i < count; i++) {
        const chain = pool[(Math.random() * pool.length) | 0];
        conduits.push({ chain, s: -Math.random() * 2, speed: 7 + Math.random() * 4 });
      }
    }

    /* ============================================================
     * DEATH BURSTS
     * ============================================================ */
    const deathBursts: DeathBurst[] = [];

    /* ============================================================
     * CAMERA IMPULSES
     * ============================================================ */
    const cameraKick = { x: 0, y: 0 };
    function kickCamera(mag: number) {
      const angle = Math.random() * Math.PI * 2;
      cameraKick.x += Math.cos(angle) * mag;
      cameraKick.y += Math.sin(angle) * mag;
    }

    /* ============================================================
     * CORE HEARTBEAT
     * ============================================================ */
    let nextHeartbeatAt = 900;
    function heartbeatInterval(progress: number) {
      return 300 + (1 - progress) * (1 - progress) * 1900;
    }

    /* ============================================================
     * GLOW (with cache)
     * ============================================================ */
    const glowCache = new Map<string, CanvasGradient>();

    // PASS 2: cap expensive radial-gradient compositing per frame.
    let glowCalls = 0;
    const maxGlowCalls = isMobile ? 180 : 360;

    function getGlowGradient(
      x: number,
      y: number,
      radius: number,
      color: string,
      alpha: number
    ) {
      const key = `${radius | 0}-${color}-${(alpha * 100) | 0}`;

      let gradient = glowCache.get(key);

      if (!gradient) {
        gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, `rgba(${color},${alpha})`);
        gradient.addColorStop(0.3, `rgba(${color},${alpha * 0.35})`);
        gradient.addColorStop(1, `rgba(${color},0)`);
        glowCache.set(key, gradient);
      }

      return gradient;
    }

    function drawGlow(x: number, y: number, radius: number, color: string, alpha: number) {
      if (radius <= 0 || alpha < 0.015) return;
      if (glowCalls++ >= maxGlowCalls) return;

      const gradient = getGlowGradient(x, y, radius, color, alpha);

      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* ============================================================
     * SOUND GATES
     * ============================================================ */
    let lastPulseSoundAt = -Infinity;
    let lastHeartbeatSoundAt = -Infinity;
    let syncSoundPlayed = false;

    /* ============================================================
     * NODE MOVEMENT + BEHAVIOURAL STATE
     * ============================================================ */
    function updateNodes(
      elapsed: number,
      progress: number,
      storm: number,
      overload: number,
      dt: number,
      waveRadii: Float32Array,
      waveBands: Float32Array
    ) {
      core.x = cx;
      core.y = cy;

      const frameScale = Math.min(dt, 32) / 16.667;

      for (let i = 1; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node.alive) continue;

        if (node.deathAt !== null && node.fadeOutUntil === null && progress >= node.deathAt) {
          node.fadeOutUntil = elapsed + 550;
          node.state = "decaying";

          deathBursts.push({ x: node.x, y: node.y, start: elapsed });

          const neighborEdges = adjacency.get(node) || [];
          if (neighborEdges.length > 0) {
            const parentEdge = neighborEdges.reduce((best, e) => {
              const other = e.a === node ? e.b : e.a;
              const bestOther = best.a === node ? best.b : best.a;
              return other.birth < bestOther.birth ? e : best;
            });
            const parentNode = parentEdge.a === node ? parentEdge.b : parentEdge.a;
            parentNode.fireUntil = elapsed + 200;
          }

          if (Math.random() < 0.3 && dynamicNodesSpawned < maxDynamicNodes) {
            spawnSplit(progress);
          }
        }
        if (node.fadeOutUntil !== null && elapsed >= node.fadeOutUntil) {
          node.alive = false;
          continue;
        }

        if (elapsed >= node.stateUntil && node.state !== "decaying") {
          const roll = Math.random();
          if (roll < 0.12) {
            node.state = "thinking";
            node.stateUntil = elapsed + 260 + Math.random() * 420;
          } else if (roll < 0.2) {
            node.state = "connecting";
            node.stateUntil = elapsed + 180 + Math.random() * 220;
          } else {
            node.state = "travelling";
            node.stateUntil = elapsed + 400 + Math.random() * 900;
          }
        }

        node.changeTimer -= dt;
        if (node.changeTimer <= 0) {
          const direction = Math.random() * Math.PI * 2;
          const speed = 12 + Math.random() * 28;
          node.targetVx = Math.cos(direction) * speed;
          node.targetVy = Math.sin(direction) * speed;
          node.changeInterval = 300 + Math.random() * 850;
          node.changeTimer = node.changeInterval;
        }

        const stateMultiplier = node.state === "thinking" ? 0.25 : node.state === "connecting" ? 1.3 : 1;
        const movementMultiplier = (1 + storm * 0.55 + overload * 1.2) * stateMultiplier * node.zDepth;

        const desiredVx = node.targetVx * movementMultiplier;
        const desiredVy = node.targetVy * movementMultiplier;

        node.vx += (desiredVx - node.vx) * 0.035;
        node.vy += (desiredVy - node.vy) * 0.035;

        const dx = node.anchorX - node.x;
        const dy = node.anchorY - node.y;
        const distanceSq = dx * dx + dy * dy;
        const maxDriftSq = node.maxDrift * node.maxDrift;
        const distance = distanceSq > maxDriftSq ? Math.sqrt(distanceSq) : node.maxDrift;
        const spring = distanceSq > maxDriftSq ? 0.03 + (distance - node.maxDrift) * 0.002 : 0.008;
        node.vx += dx * spring;
        node.vy += dy * spring;

        if (mouseNodeActive) {
          const mdx = node.x - mouseNodeX;
          const mdy = node.y - mouseNodeY;
          const mouseDistSq = mdx * mdx + mdy * mdy;

          if (mouseDistSq < 22500 && mouseDistSq > 0.0001) {
            const mdist = Math.sqrt(mouseDistSq);
            const force = (1 - mdist / 150) * 1.6;
            node.vx += (mdx / mdist) * force;
            node.vy += (mdy / mdist) * force;
          }

          if (mouseDistSq < 1764) {
            node.fireUntil = Math.max(node.fireUntil, elapsed + 140);
          }
        }

        node.vx *= 0.985;
        node.vy *= 0.985;
        node.x += node.vx * 0.016 * frameScale;
        node.y += node.vy * 0.016 * frameScale;

        node.x += Math.sin(elapsed * 0.001 + node.pulsePhase) * 0.18;
        node.y += Math.cos(elapsed * 0.0012 + node.pulsePhase * 1.7) * 0.18;

        if (overload > 0) {
          const ox = node.x - cx;
          const oy = node.y - cy;
          const od = Math.sqrt(ox * ox + oy * oy) || 1;
          node.x += (ox / od) * overload * 2.5;
          node.y += (oy / od) * overload * 2.5;
        }

        if (waves.length > 0) {
          const ndx = node.x - cx;
          const ndy = node.y - cy;
          const ndist = Math.sqrt(ndx * ndx + ndy * ndy);

          for (let w = 0; w < waves.length; w++) {
            const waveRadius = waveRadii[w];
            const band = waveBands[w];

            if (node.waveHitId !== w && ndist <= waveRadius && ndist > waveRadius - band) {
              node.waveHitId = w;
              node.fireUntil = Math.max(node.fireUntil, elapsed + 220);

              const od = ndist || 1;
              node.vx += (ndx / od) * 26;
              node.vy += (ndy / od) * 26;

              if (Math.random() < 0.22 && pulses.length < maxPulses) {
                const neighborEdges = adjacency.get(node) || [];
                if (neighborEdges.length > 0) {
                  const next = neighborEdges[(Math.random() * neighborEdges.length) | 0];
                  pulses.push({
                    edge: next,
                    fromNode: node,
                    progress: next.a === node ? 0 : 1,
                    speed: 0.05 + Math.random() * 0.03,
                    energy: 0.6,
                    bright: true,
                  });
                }
              }
            }
          }
        }

        let factor = 1;
        for (let s = 0; s < localStorms.length; s++) {
          const storm2 = localStorms[s];
          if (elapsed > storm2.start + storm2.duration) continue;
          const ddx = node.x - storm2.x;
          const ddy = node.y - storm2.y;
          if (ddx * ddx + ddy * ddy < storm2.radius * storm2.radius) {
            factor *= 1.8;
            node.vx += (Math.random() - 0.5) * 6;
            node.vy += (Math.random() - 0.5) * 6;
          }
        }
        for (let z = 0; z < deadZones.length; z++) {
          const zone = deadZones[z];
          const zoneElapsed = elapsed - zone.start;
          if (zoneElapsed < 0 || zoneElapsed > zone.duration) continue;
          const ddx = node.x - zone.x;
          const ddy = node.y - zone.y;
          if (ddx * ddx + ddy * ddy < zone.radius * zone.radius) {
            const wakeWindow = 260;
            if (zoneElapsed > zone.duration - wakeWindow) {
              const wakeT = (zoneElapsed - (zone.duration - wakeWindow)) / wakeWindow;
              factor *= 0.15 + wakeT * 1.65;
            } else {
              factor *= 0.15;
            }
          }
        }
        node.localFactor = factor;
      }
    }

    /* ============================================================
     * PULSE PROPAGATION
     * ============================================================ */
    let pulseSpawnTimer = 0;

    function maybeSpawnPulse(elapsed: number, dt: number, storm: number, overload: number) {
      pulseSpawnTimer -= dt;
      const activity = storm * 0.5 + overload * 1.5;
      if (activity <= 0) return;

      const interval = 260 - activity * 180;
      if (pulseSpawnTimer > 0) return;
      pulseSpawnTimer = Math.max(35, interval);

      if (pulses.length >= maxPulses) return;

      const originPool = Math.random() < 0.5 ? [core] : branchHeads;
      const origin = originPool[(Math.random() * originPool.length) | 0];
      const originEdges = adjacency.get(origin);
      if (!originEdges || originEdges.length === 0) return;
      const edge = originEdges[(Math.random() * originEdges.length) | 0];

      pulses.push({
        edge,
        fromNode: origin,
        progress: edge.a === origin ? 0 : 1,
        speed: 0.045 + Math.random() * 0.035 + overload * 0.08,
        energy: 1,
      });
    }

    function updatePulses(elapsed: number) {
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        const forward = pulse.fromNode === pulse.edge.a;
        pulse.progress += forward ? pulse.speed : -pulse.speed;

        const arrived = forward ? pulse.progress >= 1 : pulse.progress <= 0;
        if (arrived) {
          const target = forward ? pulse.edge.b : pulse.edge.a;
          target.fireUntil = elapsed + 180;
          target.state = "firing";

          if (pulse.bright && elapsed - lastPulseSoundAt > 550 && Math.random() < 0.4) {
            lastPulseSoundAt = elapsed;
            sfx.hover();
          }

          const energy = pulse.energy * 0.7;
          pulses.splice(i, 1);

          if (energy > 0.16 && pulses.length < maxPulses) {
            const neighborEdges = (adjacency.get(target) || []).filter((e) => e !== pulse.edge);
            const branchesOut = neighborEdges.length > 2 ? 2 : 1;
            for (let k = 0; k < branchesOut && k < neighborEdges.length; k++) {
              const next = neighborEdges[(Math.random() * neighborEdges.length) | 0];
              pulses.push({
                edge: next,
                fromNode: target,
                progress: next.a === target ? 0 : 1,
                speed: pulse.speed * 0.96,
                energy,
                bright: pulse.bright,
              });
            }
          }
        }
      }
    }

    /* ============================================================
     * DRAW HELPERS
     * ============================================================ */
    function bendFor(edge: Edge) {
      if (!mouseNodeActive) return { bx: 0, by: 0 };
      const mx = (edge.a.x + edge.b.x) / 2;
      const my = (edge.a.y + edge.b.y) / 2;
      const dx = mouseNodeX - mx;
      const dy = mouseNodeY - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const influence = Math.max(0, 1 - dist / 220) * 14;
      return { bx: (dx / (dist || 1)) * influence, by: (dy / (dist || 1)) * influence };
    }

    function drawSignal(signal: Signal, color: string) {
      const { bx, by } = bendFor(signal.edge);
      const { x, y } = curvedPoint(signal.edge.a, signal.edge.b, signal.edge.curveAmount, signal.progress, bx, by);
      drawGlow(x, y, 8, color, 0.3);
      ctx.beginPath();
      ctx.fillStyle = `rgba(${color},0.95)`;
      ctx.arc(x, y, signal.size, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawPulse(pulse: Pulse, color: string) {
      const { bx, by } = bendFor(pulse.edge);
      const { x, y } = curvedPoint(pulse.edge.a, pulse.edge.b, pulse.edge.curveAmount, clamp(pulse.progress, 0, 1), bx, by);
      const pulseColor = pulse.bright ? COLORS.white : color;
      const boost = pulse.bright ? 1.5 : 1;
      drawGlow(x, y, (14 * pulse.energy + 4) * boost, pulseColor, 0.45 * pulse.energy * boost);
      ctx.beginPath();
      ctx.fillStyle = `rgba(${COLORS.white},${0.75 * pulse.energy + 0.15})`;
      ctx.arc(x, y, (1.4 + pulse.energy * 1.6) * boost, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ============================================================
     * MAIN ANIMATION
     * ============================================================ */
    let start: number | null = null;
    let lastTs: number | null = null;
    let flashed = false;

    function frame(ts: number) {
      if (cancelled) return;
      if (start === null) start = ts;
      if (lastTs === null) lastTs = ts;
      const dt = Math.min(ts - lastTs, 32);
      lastTs = ts;

      const elapsed = ts - start;
      glowCalls = 0;
      const progress = clamp(elapsed / duration, 0, 1);

      const ignition = clamp(progress / 0.12, 0, 1);
      const expansion = clamp((progress - 0.08) / 0.65, 0, 1);
      const storm = easeInOutCubic(clamp((progress - 0.58) / 0.28, 0, 1));
      const overload = clamp((progress - 0.86) / 0.14, 0, 1);

      const syncPhase = clamp((progress - 0.86) / 0.04, 0, 1);
      const coreEnterPhase = clamp((progress - 0.9) / 0.02, 0, 1);
      const coreFirePhase = clamp((progress - 0.92) / 0.02, 0, 1);
      const allFirePhase = clamp((progress - 0.94) / 0.02, 0, 1);
      const whiteTransition = easeInOutCubic(clamp((progress - 0.9) / 0.1, 0, 1));

      const activeColor = colorTransition(whiteTransition);

      if (syncPhase > 0 && !syncSoundPlayed) {
        syncSoundPlayed = true;
        sfx.action();
      }
      if (!conduitsSpawned && progress >= 0.9) {
        conduitsSpawned = true;
        spawnConduits();
      }

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#020309";
      ctx.fillRect(0, 0, W, H);

      const breathe = reducedMotion ? 0 : Math.sin(elapsed * 0.0006) * 0.014;
      const pullBack = 0.84 + easeInOutCubic(clamp(progress / 0.55, 0, 1)) * 0.16;
      const shake = overload > 0 && !reducedMotion ? overload * overload * 3.2 : 0;
      const cameraScale = pullBack + breathe;

      const parallaxStrength = reducedMotion ? 0 : 10;
      const parX = mouse.active ? clamp((mouse.x - cx) / W, -0.5, 0.5) * parallaxStrength : 0;
      const parY = mouse.active ? clamp((mouse.y - cy) / H, -0.5, 0.5) * parallaxStrength : 0;

      cameraKick.x *= 0.88;
      cameraKick.y *= 0.88;
      const shakeX = shake ? (Math.random() - 0.5) * shake : 0;
      const shakeY = shake ? (Math.random() - 0.5) * shake : 0;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(cameraScale, cameraScale);
      ctx.translate(-cx + parX + cameraKick.x + shakeX, -cy + parY + cameraKick.y + shakeY);

      for (const event of topologyEvents) {
        if (!event.done && progress >= event.at) {
          event.done = true;
          if (event.kind === "split") spawnSplit(progress);
          else spawnConnection(progress);
          kickCamera(0.6);
        }
      }
      for (const event of waveEvents) {
        if (!event.done && progress >= event.at) {
          event.done = true;
          waves.push({ startElapsed: elapsed, speed: 0.62 + Math.random() * 0.18, soundPlayed: false });
        }
      }
      for (const event of deadZoneEvents) {
        if (!event.done && progress >= event.at) {
          event.done = true;
          spawnDeadZone(elapsed);
        }
      }

      if (elapsed >= nextLocalStormAt && progress > 0.1 && progress < 0.95) {
        spawnLocalStorm(elapsed);
        nextLocalStormAt = elapsed + 1100 + Math.random() * 900;
      }
      for (let i = localStorms.length - 1; i >= 0; i--) {
        if (elapsed > localStorms[i].start + localStorms[i].duration) localStorms.splice(i, 1);
      }
      for (let i = deadZones.length - 1; i >= 0; i--) {
        if (elapsed > deadZones[i].start + deadZones[i].duration) deadZones.splice(i, 1);
      }

      for (let i = waves.length - 1; i >= 0; i--) {
        const wave = waves[i];
        if (!wave.soundPlayed) {
          wave.soundPlayed = true;
          sfx.lock();
        }
        const radius = (elapsed - wave.startElapsed) * wave.speed;
        if (radius > Math.max(W, H) * 0.9) waves.splice(i, 1);
      }

      if (elapsed >= nextHeartbeatAt) {
        core.fireUntil = elapsed + 160;
        waves.push({ startElapsed: elapsed, speed: 0.9, soundPlayed: true });
        kickCamera(0.35);
        if (elapsed - lastHeartbeatSoundAt > 260) {
          lastHeartbeatSoundAt = elapsed;
          sfx.lock();
        }
        nextHeartbeatAt = elapsed + heartbeatInterval(progress);
      }

      if ((mouseFrame++ & 1) === 0) {
        updateMouseCache();
      }

      // Precompute wave geometry once per frame instead of once per node.
      const waveRadii = new Float32Array(waves.length);
      const waveBands = new Float32Array(waves.length);
      for (let w = 0; w < waves.length; w++) {
        waveRadii[w] = (elapsed - waves[w].startElapsed) * waves[w].speed;
        waveBands[w] = waves[w].speed * 20;
      }

      updateNodes(elapsed, progress, storm, overload, dt, waveRadii, waveBands);
      maybeSpawnPulse(elapsed, dt, storm, overload);
      updatePulses(elapsed);

      const particleStep = isMobile ? 1 : 2;
      for (let i = 0; i < ambientParticles.length; i += particleStep) {
        const particle = ambientParticles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;

        const dx = particle.x - cx;
        const dy = particle.y - cy;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        particle.x += (-dy / distance) * 0.025;
        particle.y += (dx / distance) * 0.025;

        if (overload > 0) {
          particle.x += (dx / distance) * overload * 0.9;
          particle.y += (dy / distance) * overload * 0.9;
        }
        for (let s = 0; s < localStorms.length; s++) {
          const storm2 = localStorms[s];
          const sdx = particle.x - storm2.x;
          const sdy = particle.y - storm2.y;
          if (sdx * sdx + sdy * sdy < storm2.radius * storm2.radius) {
            particle.x += (-sdy / (storm2.radius || 1)) * 0.35;
            particle.y += (sdx / (storm2.radius || 1)) * 0.35;
          }
        }

        const flicker = 0.75 + 0.25 * Math.sin(elapsed * 0.002 + particle.seed * 10);
        ctx.beginPath();
        ctx.fillStyle = `rgba(${activeColor},${particle.alpha * flicker})`;
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      const shockwaveCount = overload > 0 ? 2 : 1;
      for (let i = 0; i < shockwaveCount; i++) {
        const waveProgress = clamp(progress * 1.28 - i * 0.29, 0, 1);
        if (waveProgress <= 0) continue;
        const radius = waveProgress * Math.min(W, H) * 0.75;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${activeColor},${(1 - waveProgress) * 0.025})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      for (let i = 0; i < waves.length; i++) {
        const wave = waves[i];
        const radius = (elapsed - wave.startElapsed) * wave.speed;
        if (radius <= 0) continue;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        const fade = clamp(1 - radius / (Math.max(W, H) * 0.9), 0, 1);
        ctx.strokeStyle = `rgba(${COLORS.white},${fade * 0.09})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      const syncFlicker = syncPhase > 0 ? 0.5 + 0.5 * Math.sin(elapsed * 0.02) : 0;

      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const birth = edge.birthOverride ?? Math.max(edge.a.birth, edge.b.birth);
        const visible = clamp((progress - birth) / 0.14, 0, 1);
        if (visible <= 0) continue;
        if (!edge.a.alive || !edge.b.alive) continue;

        if (edge.birthOverride !== null && visible >= 1 && !edge.boomed) {
          edge.boomed = true;
          pulses.push({
            edge,
            fromNode: edge.a,
            progress: 0,
            speed: 0.09,
            energy: 1.3,
            bright: true,
          });
        }

        const dx = edge.b.x - edge.a.x;
        const dy = edge.b.y - edge.a.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const distanceFade = clamp(1 - distance / 160, 0.2, 1);

        const pulse = 0.7 + 0.3 * Math.sin(elapsed * 0.003 + edge.seed * 20);
        const localFactor = (edge.a.localFactor + edge.b.localFactor) / 2;

        const alpha =
          visible *
          distanceFade *
          localFactor *
          (0.07 +
            pulse * (0.13 + storm * 0.22 + overload * 0.4) +
            syncFlicker * syncPhase * 0.5);

        const { bx, by } = bendFor(edge);
        const c0x = edge.a.x;
        const c0y = edge.a.y;
        const c1x = edge.b.x;
        const c1y = edge.b.y;
        const cMid = curvedPoint(edge.a, edge.b, edge.curveAmount, 0.5, bx, by);

        const growEnd = visible < 1 ? visible : 1;
        const lineWidth = edge.width * (localFactor > 1 ? 1 + (localFactor - 1) * 0.6 : 1);

        if (edge.width > 0.6) {
          ctx.beginPath();
          ctx.moveTo(c0x, c0y);
          ctx.quadraticCurveTo(cMid.cx, cMid.cy, c1x, c1y);
          ctx.strokeStyle = `rgba(${activeColor},${alpha * 0.2})`;
          ctx.lineWidth = lineWidth * 3;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(c0x, c0y);
        if (growEnd < 1) {
          const grown = curvedPoint(edge.a, edge.b, edge.curveAmount, growEnd, bx, by);
          ctx.quadraticCurveTo(cMid.cx, cMid.cy, grown.x, grown.y);
        } else {
          ctx.quadraticCurveTo(cMid.cx, cMid.cy, c1x, c1y);
        }
        ctx.strokeStyle = `rgba(${activeColor},${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        if (edge.birthOverride !== null && growEnd < 1) {
          const spark = curvedPoint(edge.a, edge.b, edge.curveAmount, growEnd, bx, by);
          drawGlow(spark.x, spark.y, 6, COLORS.white, 0.5);
        }
      }

      const signalStep = isMobile ? 1 : 2;
      for (let i = 0; i < signals.length; i += signalStep) {
        const signal = signals[i];
        if (!signal.edge.a.alive || !signal.edge.b.alive) continue;
        const activation = clamp((progress - signal.edge.a.birth) / 0.25, 0, 1);
        if (activation <= 0) continue;

        signal.progress += signal.speed * (0.4 + expansion * 0.8 + storm * 1.5 + overload * 4);
        if (signal.progress > 1) {
          signal.progress = 0;
          if (Math.random() < 0.15) signal.direction = signal.direction === 1 ? -1 : 1;
        }
        drawSignal(signal, activeColor);
      }

      for (let i = 0; i < pulses.length; i++) {
        drawPulse(pulses[i], activeColor);
      }

      for (let i = conduits.length - 1; i >= 0; i--) {
        const conduit = conduits[i];
        conduit.s += conduit.speed * (dt / 1000);
        if (conduit.s < 0) continue;
        if (conduit.s >= conduit.chain.length) {
          conduits.splice(i, 1);
          continue;
        }
        const edgeIndex = conduit.chain.length - 1 - Math.floor(conduit.s);
        const localT = 1 - (conduit.s - Math.floor(conduit.s));
        const edge = conduit.chain[Math.max(0, edgeIndex)];
        const point = curvedPoint(edge.a, edge.b, edge.curveAmount, clamp(localT, 0, 1), 0, 0);
        drawGlow(point.x, point.y, 16, COLORS.white, 0.5);
        ctx.beginPath();
        ctx.fillStyle = `rgba(${COLORS.white},0.9)`;
        ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = deathBursts.length - 1; i >= 0; i--) {
        const burst = deathBursts[i];
        const t = (elapsed - burst.start) / 320;
        if (t >= 1) {
          deathBursts.splice(i, 1);
          continue;
        }
        const radius = 2 + t * 16;
        ctx.beginPath();
        ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${COLORS.white},${(1 - t) * 0.35})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      let minMouseNodeDist = Infinity;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node.alive) continue;

        const appear = clamp((progress - node.birth) / 0.15, 0, 1);
        if (appear <= 0) continue;

        if (mouse.active) {
          const mdx = node.x - mouse.x;
          const mdy = node.y - mouse.y;
          const md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < minMouseNodeDist) minMouseNodeDist = md;
        }

        let deathFade = 1;
        if (node.fadeOutUntil !== null) {
          const remaining = clamp((node.fadeOutUntil - elapsed) / 550, 0, 1);
          deathFade = remaining;
        }

        const firing = node.fireUntil > elapsed;
        const thinking = node.state === "thinking";

        const pulse =
          (thinking
            ? 0.9 + 0.1 * Math.sin(elapsed * 0.0015 + node.pulsePhase)
            : 0.78 + 0.22 * Math.sin(elapsed * 0.004 + node.pulsePhase)) * (firing ? 1.6 : 1);

        const isPrimary = node.tier === "primary";
        const isSecondary = node.tier === "secondary";
        const tierScale = (isPrimary ? 1 : isSecondary ? 0.62 : 0.4) * node.zDepth;

        const proximityBoost =
          mouseNodeActive
            ? (() => {
                const pdx = node.x - mouseNodeX;
                const pdy = node.y - mouseNodeY;
                return clamp(1 - Math.sqrt(pdx * pdx + pdy * pdy) / 180, 0, 1) * 0.35;
              })()
            : 0;

        const radius =
          node.r *
          tierScale *
          (0.45 + appear * (0.9 + storm * 0.6 + overload * 1.25 + allFirePhase * 1.4)) *
          deathFade *
          node.localFactor;

        const color = activeColor;
        const brightness = appear * pulse * deathFade * node.localFactor + proximityBoost;

        if (isPrimary) {
          drawGlow(node.x, node.y, radius * (4 + storm * 3 + overload * 4 + (firing ? 3 : 0)), color, 0.22 * brightness);
        } else {
          drawGlow(node.x, node.y, radius * (firing ? 5 : 3.2), color, (firing ? 0.2 : 0.1) * brightness);
        }

        ctx.beginPath();
        ctx.fillStyle = `rgba(${color},${(isPrimary ? 0.13 : 0.06) * brightness})`;
        ctx.arc(node.x, node.y, radius * (isPrimary ? 2.8 : 2.1), 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = `rgba(${color},${(0.62 + appear * 0.36 * pulse) * deathFade * node.localFactor})`;
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = `rgba(${COLORS.white},${(isPrimary ? 0.65 : 0.38) * brightness})`;
        ctx.arc(node.x, node.y, Math.max(0.55, radius * 0.28), 0, Math.PI * 2);
        ctx.fill();

        if (firing) {
          const sparkLen = radius * 3.2;
          ctx.strokeStyle = `rgba(${COLORS.white},${0.5 * deathFade})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(node.x - sparkLen, node.y);
          ctx.lineTo(node.x + sparkLen, node.y);
          ctx.moveTo(node.x, node.y - sparkLen);
          ctx.lineTo(node.x, node.y + sparkLen);
          ctx.stroke();
        }
      }

      if (mouseNodeActive && minMouseNodeDist < 160) {
        const sinkAlpha = clamp(1 - minMouseNodeDist / 160, 0, 1);
        drawGlow(mouseNodeX, mouseNodeY, 30 + sinkAlpha * 20, COLORS.white, sinkAlpha * 0.12);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${COLORS.white},${sinkAlpha * 0.3})`;
        ctx.lineWidth = 1;
        ctx.arc(mouseNodeX, mouseNodeY, 8 + sinkAlpha * 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      const heartbeatT = clamp(1 - (nextHeartbeatAt - elapsed) / heartbeatInterval(progress), 0, 1);
      const heartbeatPulse = 1 - Math.pow(1 - heartbeatT, 3) * 0.4;
      const corePulse = 0.8 + 0.2 * Math.sin(elapsed * 0.012) * heartbeatPulse;

      drawGlow(
        cx,
        cy,
        32 + ignition * 32 + overload * 80 + coreEnterPhase * 40 + coreFirePhase * 90,
        activeColor,
        0.07 + overload * 0.12 + whiteTransition * 0.08 + coreFirePhase * 0.2
      );

      const coreFiring = core.fireUntil > elapsed;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${COLORS.white},${0.65 + 0.35 * corePulse})`;
      ctx.arc(cx, cy, 3 + ignition * 7 + overload * 11 + coreFirePhase * 6 + (coreFiring ? 2 : 0), 0, Math.PI * 2);
      ctx.fill();

      if (coreFirePhase > 0) {
        const spokes = 24;
        for (let i = 0; i < spokes; i++) {
          const angle = (i / spokes) * Math.PI * 2;
          const len = 40 + coreFirePhase * Math.min(W, H) * 0.22;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
          ctx.strokeStyle = `rgba(${COLORS.white},${coreFirePhase * 0.12})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      if (allFirePhase > 0) {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (!node.alive) continue;
          const appear = clamp((progress - node.birth) / 0.15, 0, 1);
          if (appear <= 0) continue;
          drawGlow(node.x, node.y, 10 + allFirePhase * 22, COLORS.white, allFirePhase * 0.35);
        }
      }

      if (overload > 0) {
        const streakCount = isMobile ? 30 : 70;
        const streakColor = activeColor;
        for (let i = 0; i < streakCount; i++) {
          const angle = (i / streakCount) * Math.PI * 2;
          const inner = 15 + ((Math.sin(elapsed * 0.012 + i) + 1) / 2) * 18;
          const outer = inner + 45 + ((Math.sin(i * 2.73) + 1) / 2) * Math.min(W, H) * 0.3;

          const x1 = cx + Math.cos(angle) * inner;
          const y1 = cy + Math.sin(angle) * inner;
          const x2 = cx + Math.cos(angle) * outer;
          const y2 = cy + Math.sin(angle) * outer;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(${streakColor},${overload * (0.04 + 0.13 * ((Math.sin(elapsed * 0.01 + i) + 1) / 2))})`;
          ctx.lineWidth = 0.35 + ((Math.sin(i * 4.3) + 1) / 2) * 1.1;
          ctx.stroke();
        }

        drawGlow(cx, cy, 120 + overload * 180, COLORS.white, 0.07 + overload * 0.24);
      }

      ctx.restore();

      // PASS 3: keep rendering through the handoff instead of freezing
      // on the final frame. The terminal state gently breathes while
      // the transition waits for the next screen.
      if (progress < 1 || (!flashed && elapsed < duration + 500)) {
        animationFrame = requestAnimationFrame(frame);
      } else if (!flashed) {
        flashed = true;
        sfx.flash();

        setTimeout(() => {
          if (!cancelled) onDone();
        }, 500);
      }
    }

    /* ============================================================
     * RESIZE (debounced)
     * ============================================================ */
    let resizeFrame = 0;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2;
      cy = H / 2 - 52;
      glowCache.clear();
    };

    const onResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };

    window.addEventListener("resize", onResize);

    animationFrame = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(resizeFrame);
    };
  }, [isMobile, reducedMotion, onDone]);

  return (
    <div className="fixed inset-0 z-[850] overflow-hidden bg-[#020309]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle at center, transparent 16%, rgba(0,0,0,0.42) 100%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.25) 3px)",
        }}
      />
    </div>
  );
}
"use client";

import { useEffect, useRef } from "react";

interface PeripheralNeuralFieldProps {
    reducedMotion?: boolean;
    aboutActive?: boolean;
    /** 0..1 — briefly boosts activity when the main network fires/converges. */
    intensity?: number;
}

interface PeripheralNode {
    x: number;
    y: number;
    side: "left" | "right";
    radius: number;
    opacity: number;
    phase: number;
    seed: number;
    depth: number;
    hub: boolean;
    hue: number; // 0 = pure cyan, 1 = pure violet
}

interface PeripheralEdge {
    a: number;
    b: number;
    opacity: number;
    seed: number;
    longRange?: boolean;
}

const CYAN: [number, number, number] = [0, 229, 255];
const VIOLET: [number, number, number] = [138, 43, 255];

const FIELD = {
    rowSpacing: 112,
    rowSpacingVariation: 0.55, // how irregular row gaps are (0 = uniform)

    sideOffsetMin: 58,
    sideOffsetMax: 112,

    nodeOpacityMin: 0.198,
    nodeOpacityVariation: 0.121,

    edgeOpacityMin: 0.176,
    edgeOpacityVariation: 0.099,

    crossLinkOpacity: 0.132,
    longRangeOpacity: 0.088,

    signalOpacity: 0.5,

    movementX: 2.2,
    movementY: 2.8,

    nodeRadiusMin: 1.2,
    nodeRadiusVariation: 1.25,
    hubRadius: 2.5,

    signalFrequency: 9,

    aboutEdgeFade: 0.55,
    aboutSignalFade: 0.65,

    // How much a spike in `intensity` boosts activity.
    intensitySignalBoost: 1.6,
    intensityOpacityBoost: 0.5,
};

function seeded(seed: number) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
}

function smoothstep(edge0: number, edge1: number, value: number) {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function verticalFade(y: number, height: number) {
    const topFade = smoothstep(35, 150, y);
    const bottomFade = 1 - smoothstep(height - 150, height - 35, y);
    return Math.min(topFade, bottomFade);
}

function mixColor(hue: number): string {
    const t = Math.max(0, Math.min(1, hue));
    const r = CYAN[0] + (VIOLET[0] - CYAN[0]) * t;
    const g = CYAN[1] + (VIOLET[1] - CYAN[1]) * t;
    const b = CYAN[2] + (VIOLET[2] - CYAN[2]) * t;
    return `${r | 0},${g | 0},${b | 0}`;
}

/** Irregular row Y positions instead of uniformly-ticked spacing. */
function buildRowYs(rows: number, height: number, sideIndex: number): number[] {
    const ys: number[] = [];
    let cursor = 0;

    for (let i = 0; i < rows; i++) {
        ys.push(cursor);
        const wobble =
            1 +
            (seeded(i * 29.3 + sideIndex * 7.1) - 0.5) *
            FIELD.rowSpacingVariation;
        cursor += FIELD.rowSpacing * wobble;
    }

    const span = Math.max(1, cursor);
    const top = 55;
    const usable = Math.max(1, height - 110);

    return ys.map((y) => top + (y / span) * usable);
}

function buildField(width: number, height: number) {
    const nodes: PeripheralNode[] = [];
    const edges: PeripheralEdge[] = [];

    const rows = Math.max(7, Math.floor(height / FIELD.rowSpacing));

    const sideOffset = Math.min(
        FIELD.sideOffsetMax,
        Math.max(FIELD.sideOffsetMin, width * 0.075)
    );

    for (const side of ["left", "right"] as const) {
        const sideIndex = side === "left" ? 0 : 1;
        const rowYs = buildRowYs(rows, height, sideIndex);

        for (let i = 0; i < rows; i++) {
            const depth = seeded(i * 51.7 + sideIndex * 91.3);

            // Nodes fray further inward (toward center) as depth increases —
            // reads as dendrites reaching in, rather than two flat rails.
            const inwardReach = depth * (18 + seeded(i * 61.3) * 34);

            const xJitter =
                (seeded(i * 41.3 + sideIndex * 11.2) - 0.5) * 56;

            const breathingOffset =
                (seeded(i * 71.9 + sideIndex * 4.3) - 0.5) * 22;

            const x =
                side === "left"
                    ? sideOffset + xJitter + breathingOffset + inwardReach
                    : width - sideOffset + xJitter - breathingOffset - inwardReach;

            const y = rowYs[i];

            const hub = seeded(i * 117.3 + sideIndex * 44.8) > 0.83;

            const baseRadius =
                FIELD.nodeRadiusMin +
                seeded(i * 8.1 + sideIndex) * FIELD.nodeRadiusVariation;

            const radius = hub
                ? FIELD.hubRadius
                : baseRadius * (0.82 + depth * 0.18);

            const depthMultiplier = 0.72 + depth * 0.28;
            const fade = verticalFade(y, height);

            const opacity =
                (FIELD.nodeOpacityMin +
                    seeded(i * 4.7 + sideIndex * 5) *
                    FIELD.nodeOpacityVariation) *
                depthMultiplier *
                fade;

            // Mostly cyan on the left / violet on the right, but with real
            // overlap instead of a hard binary split — some cross-pollination
            // makes the two halves read as one field, not two mirrors.
            const hueSeed = seeded(i * 97.1 + sideIndex * 3.7);
            const hue =
                side === "left"
                    ? hueSeed * 0.4
                    : 1 - hueSeed * 0.4;

            nodes.push({
                x,
                y,
                side,
                radius,
                opacity,
                phase: seeded(i * 13.2 + sideIndex * 21.8) * Math.PI * 2,
                seed: seeded(i * 33.7 + sideIndex * 73.1),
                depth,
                hub,
                hue,
            });
        }
    }

    for (let i = 0; i < rows - 1; i++) {
        edges.push({
            a: i,
            b: i + 1,
            opacity:
                FIELD.edgeOpacityMin +
                seeded(i * 19.3) * FIELD.edgeOpacityVariation,
            seed: seeded(i * 41.7),
        });

        const rightStart = rows;

        edges.push({
            a: rightStart + i,
            b: rightStart + i + 1,
            opacity:
                FIELD.edgeOpacityMin +
                seeded(i * 23.7 + 10) * FIELD.edgeOpacityVariation,
            seed: seeded(i * 52.3 + 10),
        });
    }

    for (let i = 1; i < rows - 1; i++) {
        if (seeded(i * 77.1) > 0.32) {
            edges.push({
                a: i,
                b: i + 1,
                opacity: FIELD.crossLinkOpacity,
                seed: seeded(i * 81.2),
            });
        }

        if (seeded(i * 91.4) > 0.32) {
            edges.push({
                a: rows + i,
                b: rows + i + 1,
                opacity: FIELD.crossLinkOpacity,
                seed: seeded(i * 91.9),
            });
        }
    }

    for (let i = 0; i < rows - 2; i++) {
        if (seeded(i * 143.2) > 0.58) {
            edges.push({
                a: i,
                b: i + 2,
                opacity: FIELD.longRangeOpacity,
                seed: seeded(i * 163.4),
                longRange: true,
            });
        }

        if (seeded(i * 173.7) > 0.62) {
            edges.push({
                a: rows + i,
                b: rows + i + 2,
                opacity: FIELD.longRangeOpacity,
                seed: seeded(i * 183.9),
                longRange: true,
            });
        }
    }

    return { nodes, edges };
}

export default function PeripheralNeuralField({
    reducedMotion = false,
    aboutActive = false,
    intensity = 0,
}: PeripheralNeuralFieldProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Live values the draw loop reads each frame WITHOUT re-running the
    // (expensive, field-rebuilding) setup effect below. Previously
    // `aboutActive`/`reducedMotion` sat in the effect's dependency array,
    // which tore down and rebuilt the entire randomized field — including a
    // visible jump in node positions — every time About was toggled.
    const reducedMotionRef = useRef(reducedMotion);
    const aboutActiveRef = useRef(aboutActive);
    const intensityRef = useRef(intensity);
    const smoothedIntensityRef = useRef(0);

    useEffect(() => {
        reducedMotionRef.current = reducedMotion;
    }, [reducedMotion]);

    useEffect(() => {
        aboutActiveRef.current = aboutActive;
    }, [aboutActive]);

    useEffect(() => {
        intensityRef.current = intensity;
    }, [intensity]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrame = 0;
        let width = window.innerWidth;
        let height = window.innerHeight;
        let field = buildField(width, height);

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);

            width = window.innerWidth;
            height = window.innerHeight;

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            field = buildField(width, height);
        };

        resize();
        window.addEventListener("resize", resize);

        const draw = (time: number) => {
            const reduced = reducedMotionRef.current;
            const about = aboutActiveRef.current;

            // Exponentially smoothed so intensity spikes feel like a swell
            // rather than a hard cut.
            smoothedIntensityRef.current +=
                (intensityRef.current - smoothedIntensityRef.current) * 0.08;
            const boost = smoothedIntensityRef.current;

            ctx.clearRect(0, 0, width, height);

            const movement = reduced ? 0 : time * 0.000025;

            const edgeFade = about ? FIELD.aboutEdgeFade : 1;
            const signalFade = about ? FIELD.aboutSignalFade : 1;

            const opacityBoost = 1 + boost * FIELD.intensityOpacityBoost;
            const effectiveSignalFrequency = Math.max(
                3,
                Math.round(
                    FIELD.signalFrequency /
                    (1 + boost * FIELD.intensitySignalBoost)
                )
            );

            /* ---- Edges: soft additive glow pass, then a crisp core pass ---- */

            for (let i = 0; i < field.edges.length; i++) {
                const edge = field.edges[i];
                const a = field.nodes[edge.a];
                const b = field.nodes[edge.b];
                if (!a || !b) continue;

                const waveA = reduced ? 0 : Math.sin(movement * 3 + a.phase) * FIELD.movementY;
                const waveB = reduced ? 0 : Math.sin(movement * 3 + b.phase) * FIELD.movementY;
                const driftA = reduced ? 0 : Math.cos(movement * 1.7 + a.phase * 1.3) * FIELD.movementX;
                const driftB = reduced ? 0 : Math.cos(movement * 1.7 + b.phase * 1.3) * FIELD.movementX;

                const ax = a.x + driftA;
                const ay = a.y + waveA;
                const bx = b.x + driftB;
                const by = b.y + waveB;

                const mx = (ax + bx) / 2;
                const my = (ay + by) / 2;

                const baseSag = a.side === "left" ? 8 : -8;
                const sag = baseSag * (0.7 + edge.seed * 0.7);
                const controlX = mx + sag;
                const controlY = my + Math.sin(movement * 2 + edge.seed * 10) * 1.5;

                const rgb = mixColor((a.hue + b.hue) / 2);

                const flicker = reduced
                    ? 1
                    : 0.88 + Math.sin(movement * 2.4 + edge.seed * 17) * 0.12;

                const midpointFade = verticalFade(my, height);
                const finalOpacity =
                    edge.opacity * flicker * midpointFade * edgeFade * opacityBoost;

                if (finalOpacity <= 0.004) continue;

                const path = () => {
                    ctx.beginPath();
                    ctx.moveTo(ax, ay);
                    ctx.quadraticCurveTo(controlX, controlY, bx, by);
                };

                // Additive glow halo — no shadowBlur, much cheaper, and
                // overlapping edges genuinely brighten where they cross.
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                path();
                ctx.strokeStyle = `rgba(${rgb},${finalOpacity * 0.55})`;
                ctx.lineWidth = edge.longRange ? 2.2 : 2.8;
                ctx.stroke();
                ctx.restore();

                // Crisp core line on top.
                path();
                ctx.strokeStyle = `rgba(${rgb},${finalOpacity})`;
                ctx.lineWidth = edge.longRange ? 0.5 : 0.68;
                ctx.stroke();
            }

            /* ---- Nodes: radial-gradient halo (already cheap) + solid core ---- */

            for (const node of field.nodes) {
                const wave = reduced ? 0 : Math.sin(movement * 2 + node.phase) * FIELD.movementY;
                const drift = reduced ? 0 : Math.cos(movement * 1.3 + node.phase * 1.17) * FIELD.movementX;

                const x = node.x + drift;
                const y = node.y + wave;

                const fade = verticalFade(y, height);
                const depthBrightness = 0.75 + node.depth * 0.25;
                const alpha = node.opacity * fade * depthBrightness * opacityBoost;

                if (alpha <= 0.004) continue;

                const rgb = mixColor(node.hue);
                const haloRadius = node.radius * (node.hub ? 9 : 7);

                const gradient = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
                gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
                gradient.addColorStop(0.28, `rgba(${rgb},${alpha * 0.55})`);
                gradient.addColorStop(0.55, `rgba(${rgb},${alpha * 0.16})`);
                gradient.addColorStop(1, `rgba(${rgb},0)`);

                ctx.beginPath();
                ctx.fillStyle = gradient;
                ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
                ctx.fill();

                // Solid core — the gradient already provides the glow
                // falloff, so no shadowBlur needed here at all.
                ctx.beginPath();
                ctx.fillStyle = `rgba(${rgb},${alpha * (node.hub ? 1.7 : 1.25)})`;
                ctx.arc(x, y, node.radius, 0, Math.PI * 2);
                ctx.fill();
            }

            /* ---- Moving signals ---- */

            if (!reduced) {
                const cycle = time * 0.00012;

                for (let i = 0; i < field.edges.length; i++) {
                    const edge = field.edges[i];

                    if ((i + Math.floor(cycle)) % effectiveSignalFrequency !== 0) {
                        continue;
                    }

                    const a = field.nodes[edge.a];
                    const b = field.nodes[edge.b];
                    if (!a || !b) continue;

                    const progress = (cycle * 0.7 + i * 0.37) % 1;

                    const x0 = a.x + Math.cos(movement * 1.3 + a.phase * 1.17) * FIELD.movementX;
                    const y0 = a.y + Math.sin(movement * 2 + a.phase) * FIELD.movementY;
                    const x1 = b.x + Math.cos(movement * 1.3 + b.phase * 1.17) * FIELD.movementX;
                    const y1 = b.y + Math.sin(movement * 2 + b.phase) * FIELD.movementY;

                    const controlX = (x0 + x1) / 2 + (a.side === "left" ? 8 : -8);
                    const controlY = (y0 + y1) / 2;

                    const t = progress;
                    const inv = 1 - t;
                    const x = inv * inv * x0 + 2 * inv * t * controlX + t * t * x1;
                    const y = inv * inv * y0 + 2 * inv * t * controlY + t * t * y1;

                    const rgb = mixColor((a.hue + b.hue) / 2);
                    const glowAlpha = FIELD.signalOpacity * signalFade * (1 + boost * 0.4);

                    ctx.save();
                    ctx.globalCompositeOperation = "lighter";
                    const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
                    g.addColorStop(0, `rgba(${rgb},${glowAlpha})`);
                    g.addColorStop(1, `rgba(${rgb},0)`);
                    ctx.beginPath();
                    ctx.fillStyle = g;
                    ctx.arc(x, y, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();

                    ctx.beginPath();
                    ctx.fillStyle = `rgba(${rgb},${glowAlpha})`;
                    ctx.arc(x, y, 1.25, 0, Math.PI * 2);
                    ctx.fill();

                    for (let trail = 1; trail <= 2; trail++) {
                        const trailT = progress - trail * 0.045;
                        if (trailT < 0) continue;

                        const trailInv = 1 - trailT;
                        const trailX =
                            trailInv * trailInv * x0 +
                            2 * trailInv * trailT * controlX +
                            trailT * trailT * x1;
                        const trailY =
                            trailInv * trailInv * y0 +
                            2 * trailInv * trailT * controlY +
                            trailT * trailT * y1;

                        ctx.beginPath();
                        ctx.fillStyle = `rgba(${rgb},${(0.2 / trail) * signalFade})`;
                        ctx.arc(trailX, trailY, 0.75, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            animationFrame = requestAnimationFrame(draw);
        };

        animationFrame = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animationFrame);
            window.removeEventListener("resize", resize);
        };
        // Setup runs once — live prop values flow through the refs above,
        // so toggling About/reduced-motion/intensity never rebuilds the field.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[120] h-full w-full"
        />
    );
}
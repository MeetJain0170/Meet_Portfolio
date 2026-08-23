"use client";

import { useEffect, useRef } from "react";

interface PeripheralNeuralFieldProps {
    reducedMotion?: boolean;
    aboutActive?: boolean;
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
}

interface PeripheralEdge {
    a: number;
    b: number;
    opacity: number;
    seed: number;
    longRange?: boolean;
}

const CYAN = "0,229,255";
const VIOLET = "138,43,255";

/* =========================================================
   EASY VISUAL CONTROLS
   ========================================================= */

const FIELD = {
    rowSpacing: 112,
    sideOffsetMin: 58,
    sideOffsetMax: 112,

    // Nodes
    nodeOpacityMin: 0.198,
    nodeOpacityVariation: 0.121,

    // Main neural connections
    edgeOpacityMin: 0.176,
    edgeOpacityVariation: 0.099,

    crossLinkOpacity: 0.132,
    longRangeOpacity: 0.088,

    edgeGlowOpacity: 0.176,
    longRangeGlowOpacity: 0.099,

    // Moving signals
    signalOpacity: 0.5,
    signalGlowOpacity: 0.55,

    // Motion
    movementX: 2.2,
    movementY: 2.8,

    // Node sizes
    nodeRadiusMin: 1.2,
    nodeRadiusVariation: 1.25,
    hubRadius: 2.5,

    signalFrequency: 9,

    // About section
    aboutEdgeFade: 0.55,
    aboutSignalFade: 0.65,
};

/* =========================================================
   UTILITIES
   ========================================================= */

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
    const bottomFade =
        1 - smoothstep(height - 150, height - 35, y);

    return Math.min(topFade, bottomFade);
}

/* =========================================================
   FIELD GENERATION
   ========================================================= */

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

        for (let i = 0; i < rows; i++) {
            const normalized = i / Math.max(1, rows - 1);

            const baseY =
                55 + normalized * Math.max(1, height - 110);

            const jitter =
                (seeded(i * 17.17 + sideIndex * 31.7) - 0.5) * 64;

            const xJitter =
                (seeded(i * 41.3 + sideIndex * 11.2) - 0.5) * 38;

            const breathingOffset =
                (seeded(i * 71.9 + sideIndex * 4.3) - 0.5) * 18;

            const x =
                side === "left"
                    ? sideOffset + xJitter + breathingOffset
                    : width - sideOffset + xJitter - breathingOffset;

            const y = baseY + jitter;

            const depth = seeded(i * 51.7 + sideIndex * 91.3);

            const hub =
                seeded(i * 117.3 + sideIndex * 44.8) > 0.83;

            const baseRadius =
                FIELD.nodeRadiusMin +
                seeded(i * 8.1 + sideIndex) *
                FIELD.nodeRadiusVariation;

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

            nodes.push({
                x,
                y,
                side,
                radius,
                opacity,
                phase:
                    seeded(i * 13.2 + sideIndex * 21.8) *
                    Math.PI *
                    2,
                seed: seeded(i * 33.7 + sideIndex * 73.1),
                depth,
                hub,
            });
        }
    }

    /* Main vertical connections */
    for (let i = 0; i < rows - 1; i++) {
        edges.push({
            a: i,
            b: i + 1,
            opacity:
                FIELD.edgeOpacityMin +
                seeded(i * 19.3) *
                FIELD.edgeOpacityVariation,
            seed: seeded(i * 41.7),
        });

        const rightStart = rows;

        edges.push({
            a: rightStart + i,
            b: rightStart + i + 1,
            opacity:
                FIELD.edgeOpacityMin +
                seeded(i * 23.7 + 10) *
                FIELD.edgeOpacityVariation,
            seed: seeded(i * 52.3 + 10),
        });
    }

    /* Short secondary links */
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

    /* Longer neural links */
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

/* =========================================================
   COMPONENT
   ========================================================= */

export default function PeripheralNeuralField({
    reducedMotion = false,
    aboutActive = false,
}: PeripheralNeuralFieldProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrame = 0;

        let width = window.innerWidth;
        let height = window.innerHeight;

        let field = buildField(width, height);

        /* =======================================================
           RESIZE
           ======================================================= */

        const resize = () => {
            const dpr = Math.min(
                window.devicePixelRatio || 1,
                2
            );

            width = window.innerWidth;
            height = window.innerHeight;

            canvas.width = width * dpr;
            canvas.height = height * dpr;

            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            ctx.setTransform(
                dpr,
                0,
                0,
                dpr,
                0,
                0
            );

            field = buildField(width, height);
        };

        resize();

        window.addEventListener("resize", resize);

        /* =======================================================
           DRAW
           ======================================================= */

        const draw = (time: number) => {
            ctx.clearRect(0, 0, width, height);

            const movement = reducedMotion
                ? 0
                : time * 0.000025;

            /*
             * THIS controls how much the peripheral network
             * fades when About is selected.
             */
            const edgeFade = aboutActive
                ? FIELD.aboutEdgeFade
                : 1;

            const signalFade = aboutActive
                ? FIELD.aboutSignalFade
                : 1;

            /* =====================================================
               EDGES
               ===================================================== */

            for (
                let edgeIndex = 0;
                edgeIndex < field.edges.length;
                edgeIndex++
            ) {
                const edge = field.edges[edgeIndex];

                const a = field.nodes[edge.a];
                const b = field.nodes[edge.b];

                if (!a || !b) continue;

                const waveA = reducedMotion
                    ? 0
                    : Math.sin(
                        movement * 3 + a.phase
                    ) * FIELD.movementY;

                const waveB = reducedMotion
                    ? 0
                    : Math.sin(
                        movement * 3 + b.phase
                    ) * FIELD.movementY;

                const driftA = reducedMotion
                    ? 0
                    : Math.cos(
                        movement * 1.7 +
                        a.phase * 1.3
                    ) * FIELD.movementX;

                const driftB = reducedMotion
                    ? 0
                    : Math.cos(
                        movement * 1.7 +
                        b.phase * 1.3
                    ) * FIELD.movementX;

                const ax = a.x + driftA;
                const ay = a.y + waveA;

                const bx = b.x + driftB;
                const by = b.y + waveB;

                const mx = (ax + bx) / 2;
                const my = (ay + by) / 2;

                const baseSag =
                    a.side === "left"
                        ? 8
                        : -8;

                const sag =
                    baseSag *
                    (0.7 + edge.seed * 0.7);

                const controlX = mx + sag;

                const controlY =
                    my +
                    Math.sin(
                        movement * 2 +
                        edge.seed * 10
                    ) * 1.5;

                const rgb =
                    a.side === "left"
                        ? CYAN
                        : VIOLET;

                const flicker = reducedMotion
                    ? 1
                    : 0.88 +
                    Math.sin(
                        movement * 2.4 +
                        edge.seed * 17
                    ) * 0.12;

                const midpointFade =
                    verticalFade(my, height);

                const finalOpacity =
                    edge.opacity *
                    flicker *
                    midpointFade *
                    edgeFade;

                ctx.beginPath();

                ctx.moveTo(ax, ay);

                ctx.quadraticCurveTo(
                    controlX,
                    controlY,
                    bx,
                    by
                );

                ctx.strokeStyle =
                    `rgba(${rgb},${finalOpacity})`;

                ctx.lineWidth =
                    edge.longRange
                        ? 0.55
                        : 0.72;

                ctx.shadowColor =
                    `rgba(${rgb},${(edge.longRange
                        ? FIELD.longRangeGlowOpacity
                        : FIELD.edgeGlowOpacity) *
                    edgeFade
                    })`;

                ctx.shadowBlur =
                    edge.longRange
                        ? 3
                        : 4;

                ctx.stroke();
            }

            /* =====================================================
               NODES
               ===================================================== */

            for (const node of field.nodes) {
                const rgb =
                    node.side === "left"
                        ? CYAN
                        : VIOLET;

                const wave = reducedMotion
                    ? 0
                    : Math.sin(
                        movement * 2 +
                        node.phase
                    ) * FIELD.movementY;

                const drift = reducedMotion
                    ? 0
                    : Math.cos(
                        movement * 1.3 +
                        node.phase * 1.17
                    ) * FIELD.movementX;

                const x = node.x + drift;
                const y = node.y + wave;

                const fade =
                    verticalFade(y, height);

                const depthBrightness =
                    0.75 +
                    node.depth * 0.25;

                /*
                 * Nodes are NOT faded in About.
                 * Only the network connections are.
                 */
                const alpha =
                    node.opacity *
                    fade *
                    depthBrightness;

                const gradient =
                    ctx.createRadialGradient(
                        x,
                        y,
                        0,
                        x,
                        y,
                        node.radius *
                        (node.hub ? 9 : 7)
                    );

                gradient.addColorStop(
                    0,
                    `rgba(${rgb},${alpha})`
                );

                gradient.addColorStop(
                    0.28,
                    `rgba(${rgb},${alpha * 0.55})`
                );

                gradient.addColorStop(
                    0.55,
                    `rgba(${rgb},${alpha * 0.16})`
                );

                gradient.addColorStop(
                    1,
                    `rgba(${rgb},0)`
                );

                ctx.beginPath();

                ctx.fillStyle = gradient;

                ctx.arc(
                    x,
                    y,
                    node.radius *
                    (node.hub ? 9 : 7),
                    0,
                    Math.PI * 2
                );

                ctx.fill();

                ctx.beginPath();

                ctx.fillStyle =
                    `rgba(${rgb},${alpha *
                    (node.hub ? 1.7 : 1.25)
                    })`;

                ctx.shadowColor =
                    `rgba(${rgb},${node.hub
                        ? 0.38
                        : 0.22
                    })`;

                ctx.shadowBlur =
                    node.hub
                        ? 7
                        : 4;

                ctx.arc(
                    x,
                    y,
                    node.radius,
                    0,
                    Math.PI * 2
                );

                ctx.fill();
            }

            /* =====================================================
               MOVING SIGNALS
               ===================================================== */

            if (!reducedMotion) {
                const cycle =
                    time * 0.00012;

                for (
                    let i = 0;
                    i < field.edges.length;
                    i++
                ) {
                    const edge = field.edges[i];

                    if (
                        (i +
                            Math.floor(cycle)) %
                        FIELD.signalFrequency !==
                        0
                    ) {
                        continue;
                    }

                    const a = field.nodes[edge.a];
                    const b = field.nodes[edge.b];

                    if (!a || !b) continue;

                    const progress =
                        (cycle * 0.7 +
                            i * 0.37) %
                        1;

                    const x0 =
                        a.x +
                        Math.cos(
                            movement * 1.3 +
                            a.phase * 1.17
                        ) * FIELD.movementX;

                    const y0 =
                        a.y +
                        Math.sin(
                            movement * 2 +
                            a.phase
                        ) * FIELD.movementY;

                    const x1 =
                        b.x +
                        Math.cos(
                            movement * 1.3 +
                            b.phase * 1.17
                        ) * FIELD.movementX;

                    const y1 =
                        b.y +
                        Math.sin(
                            movement * 2 +
                            b.phase
                        ) * FIELD.movementY;

                    const controlX =
                        (x0 + x1) / 2 +
                        (a.side === "left"
                            ? 8
                            : -8);

                    const controlY =
                        (y0 + y1) / 2;

                    const t = progress;
                    const inv = 1 - t;

                    const x =
                        inv * inv * x0 +
                        2 * inv * t *
                        controlX +
                        t * t * x1;

                    const y =
                        inv * inv * y0 +
                        2 * inv * t *
                        controlY +
                        t * t * y1;

                    const rgb =
                        a.side === "left"
                            ? CYAN
                            : VIOLET;

                    ctx.beginPath();

                    ctx.fillStyle =
                        `rgba(${rgb},${FIELD.signalOpacity *
                        signalFade
                        })`;

                    ctx.shadowColor =
                        `rgba(${rgb},${FIELD.signalGlowOpacity *
                        signalFade
                        })`;

                    ctx.shadowBlur = 9;

                    ctx.arc(
                        x,
                        y,
                        1.25,
                        0,
                        Math.PI * 2
                    );

                    ctx.fill();

                    /* Signal trail */

                    for (
                        let trail = 1;
                        trail <= 2;
                        trail++
                    ) {
                        const trailT =
                            progress -
                            trail * 0.045;

                        if (trailT < 0) continue;

                        const trailInv =
                            1 - trailT;

                        const trailX =
                            trailInv *
                            trailInv *
                            x0 +
                            2 *
                            trailInv *
                            trailT *
                            controlX +
                            trailT *
                            trailT *
                            x1;

                        const trailY =
                            trailInv *
                            trailInv *
                            y0 +
                            2 *
                            trailInv *
                            trailT *
                            controlY +
                            trailT *
                            trailT *
                            y1;

                        ctx.beginPath();

                        ctx.fillStyle =
                            `rgba(${rgb},${(0.2 / trail) *
                            signalFade
                            })`;

                        ctx.shadowBlur = 4;

                        ctx.arc(
                            trailX,
                            trailY,
                            0.75,
                            0,
                            Math.PI * 2
                        );

                        ctx.fill();
                    }
                }
            }

            animationFrame =
                requestAnimationFrame(draw);
        };

        animationFrame =
            requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(
                animationFrame
            );

            window.removeEventListener(
                "resize",
                resize
            );
        };
    }, [
        reducedMotion,
        aboutActive,
    ]);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[120] h-full w-full"
        />
    );
}
"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { NodePosition } from "@/lib/layout";
import { Camera, Neuron, Particle, Pointer, Pulse, Signal, Synapse } from "@/lib/neural/types";
import { createCamera, focusCamera, resetCameraFocus, updateCamera } from "@/lib/neural/camera";
import { reconcile } from "@/lib/neural/reconcile";
import {
    beginDrag, createParticles, decayNeuronActivity, decaySynapseActivity,
    endDrag, spontaneousFire, updateDrag, updateNeuronLifecycle,
    updateNeuronMotion, updateParticle, updatePulses, updateSignals,
    updateSynapseLifecycle, updateSynapseSag,
} from "@/lib/neural/physics";
import { clearTransientActivity } from "@/lib/neural/transitions";
import {
    drawBackground, drawCore, drawNeuron, drawParticles, drawPointerField,
    drawPulses, drawSignals, drawSynapse,
} from "@/lib/neural/render";

const DRAG_THRESHOLD = 6;
const GC_DELAY = 700;
const MAX_SIGNALS_DESKTOP = 90;
const MAX_SIGNALS_MOBILE = 35;
const NODE_SYNC_EPSILON = 0.03;

export interface NeuralSimulationProps {
    positions: Map<string, NodePosition>;
    reducedMotion: boolean;
    isMobile: boolean;
    activePath: string[];
    hoveredId: string | null;
    focusId: string | null;
}

export interface NodeDragApi {
    startNodeDrag: (id: string, clientX: number, clientY: number) => void;
    consumeDragSuppressedClick: () => boolean;
    /**
     * Registers (or unregisters, with `el === null`) the DOM element that
     * visually represents a neuron. The simulation loop imperatively keeps
     * this element's `transform` in sync with the neuron's physics
     * position every frame, so dragging (or any physics-driven motion)
     * moves the actual visible node instead of just the canvas rope.
     * This intentionally bypasses React state/rerenders.
     */
    registerNodeElement: (id: string, el: HTMLElement | null) => void;
}

export function useNeuralSimulation(
    props: NeuralSimulationProps
): {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    dragApi: NodeDragApi;
} {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const propsRef = useRef(props);

    const dragApiRef = useRef<NodeDragApi>({
        startNodeDrag: () => { },
        consumeDragSuppressedClick: () => false,
        registerNodeElement: () => { },
    });

    useEffect(() => {
        propsRef.current = props;
    }, [props]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d", {
            alpha: true,
            desynchronized: true,
        });
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;
        let dpr = 1;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            dpr = Math.min(
                window.devicePixelRatio || 1,
                propsRef.current.isMobile ? 1.25 : 1.75
            );

            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        resize();
        window.addEventListener("resize", resize);

        const neurons = new Map<string, Neuron>();
        const synapses = new Map<string, Synapse>();
        const signals: Signal[] = [];
        const pulses: Pulse[] = [];

        /*
         * DOM node registry: id -> visible GraphNode element.
         * Kept out of React entirely. Written every frame with the
         * neuron's current offset from its resting layout position.
         */
        const nodeElements = new Map<string, HTMLElement>();

        const particles = createParticles(
            propsRef.current.isMobile ? 45 : 110,
            width,
            height
        );

        const camera: Camera = createCamera();

        const pointer: Pointer = {
            x: width / 2,
            y: height / 2,
            targetX: width / 2,
            targetY: height / 2,
            active: false,
            down: false,
            draggingId: null,
            dragDX: 0,
            dragDY: 0,
        };

        let destroyed = false;
        let frame = 0;
        let lastTime = performance.now();
        let lastFocusId: string | null = null;
        let lastSpontaneous = { current: performance.now() };

        /* ---------------------------------------------------------- */
        /* Pointer                                                     */
        /* ---------------------------------------------------------- */

        const onPointerMove = (e: MouseEvent) => {
            pointer.targetX = e.clientX;
            pointer.targetY = e.clientY;
            pointer.active = true;
        };

        const onPointerLeave = () => {
            pointer.active = false;
        };

        window.addEventListener("mousemove", onPointerMove);
        window.addEventListener("mouseleave", onPointerLeave);

        /* ---------------------------------------------------------- */
        /* Dragging                                                    */
        /* ---------------------------------------------------------- */

        let dragCandidateId: string | null = null;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragLastX = 0;
        let dragLastY = 0;
        let dragActive = false;
        let suppressClick = false;

        const onDragMove = (e: PointerEvent) => {
            if (!dragCandidateId) return;

            if (!dragActive) {
                const distance = Math.hypot(
                    e.clientX - dragStartX,
                    e.clientY - dragStartY
                );

                if (distance < DRAG_THRESHOLD) return;

                dragActive = true;

                const neuron = neurons.get(dragCandidateId);
                if (neuron) {
                    beginDrag(pointer, neuron, e.clientX, e.clientY);
                }
            }

            const neuron = neurons.get(dragCandidateId);

            if (neuron) {
                updateDrag(
                    neuron,
                    camera,
                    e.clientX - dragLastX,
                    e.clientY - dragLastY
                );
            }

            dragLastX = e.clientX;
            dragLastY = e.clientY;
        };

        const onDragEnd = () => {
            if (dragCandidateId) {
                const neuron = neurons.get(dragCandidateId);
                if (neuron) endDrag(pointer, neuron);
            }

            suppressClick = dragActive;
            dragCandidateId = null;
            dragActive = false;

            window.removeEventListener("pointermove", onDragMove);
            window.removeEventListener("pointerup", onDragEnd);
        };

        dragApiRef.current = {
            startNodeDrag(id, clientX, clientY) {
                if (dragCandidateId) return;

                dragCandidateId = id;
                dragStartX = clientX;
                dragStartY = clientY;
                dragLastX = clientX;
                dragLastY = clientY;
                dragActive = false;

                window.addEventListener("pointermove", onDragMove);
                window.addEventListener("pointerup", onDragEnd);
            },

            consumeDragSuppressedClick() {
                const value = suppressClick;
                suppressClick = false;
                return value;
            },

            registerNodeElement(id, el) {
                if (el) {
                    nodeElements.set(id, el);
                } else {
                    nodeElements.delete(id);
                }
            },
        };

        /* ---------------------------------------------------------- */
        /* Simulation context                                          */
        /* ---------------------------------------------------------- */

        const simContext = (time: number, delta: number) => ({
            width,
            height,
            time,
            delta,
            camera,
            pointer,
            reducedMotion: propsRef.current.reducedMotion,
            isMobile: propsRef.current.isMobile,
        });

        /* ---------------------------------------------------------- */
        /* Garbage collection                                         */
        /* ---------------------------------------------------------- */

        const garbageCollect = (time: number) => {
            neurons.forEach((neuron, id) => {
                if (
                    neuron.state === "hidden" &&
                    time - neuron.stateSince > GC_DELAY
                ) {
                    neurons.delete(id);
                }
            });

            synapses.forEach((synapse, id) => {
                if (
                    synapse.state === "hidden" &&
                    time - synapse.stateSince > GC_DELAY
                ) {
                    synapses.delete(id);
                }
            });
        };

        /* ---------------------------------------------------------- */
        /* DOM sync                                                     */
        /* ---------------------------------------------------------- */

        /*
         * Keep every registered DOM node's transform in sync with its
         * simulation neuron's offset from its resting layout position.
         * This is what makes dragging (and any other physics motion)
         * visibly move the actual GraphNode instead of only the canvas
         * rope. Base transform (translate(-50%,-50%)) is applied once by
         * GraphNode itself on mount and is never touched by React again,
         * so there is no conflict between React and this imperative write.
         */
        const syncNodeElements = () => {
            nodeElements.forEach((el, id) => {
                const neuron = neurons.get(id);
                if (!neuron) return;

                const offsetX = neuron.x - neuron.targetX;
                const offsetY = neuron.y - neuron.targetY;

                if (
                    Math.abs(offsetX) < NODE_SYNC_EPSILON &&
                    Math.abs(offsetY) < NODE_SYNC_EPSILON
                ) {
                    if (el.dataset.synced !== "1") {
                        el.style.transform = "translate(-50%, -50%)";
                        el.dataset.synced = "1";
                    }
                    return;
                }

                el.style.transform =
                    `translate(-50%, -50%) translate(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px)`;
                el.dataset.synced = "0";
            });
        };

        /* ---------------------------------------------------------- */
        /* Main loop                                                    */
        /* ---------------------------------------------------------- */

        const loop = (time: number) => {
            if (destroyed) return;

            const delta = Math.min(
                Math.max(time - lastTime, 1),
                32
            );

            lastTime = time;

            const {
                positions,
                activePath,
                hoveredId,
                focusId,
                reducedMotion,
                isMobile,
            } = propsRef.current;

            /* Smooth pointer */
            pointer.x +=
                (pointer.targetX - pointer.x) *
                (reducedMotion ? 0.35 : 0.14);

            pointer.y +=
                (pointer.targetY - pointer.y) *
                (reducedMotion ? 0.35 : 0.14);

            /* -------------------------------------------------------- */
            /* Graph reconciliation                                      */
            /* -------------------------------------------------------- */

            reconcile(
                neurons,
                synapses,
                positions,
                time,
                false
            );

            /* -------------------------------------------------------- */
            /* Focus camera                                              */
            /* -------------------------------------------------------- */

            if (focusId !== lastFocusId) {
                lastFocusId = focusId;

                if (!focusId || focusId === "meet") {
                    resetCameraFocus(camera);
                } else {
                    const neuron = neurons.get(focusId);
                    const position = positions.get(focusId);

                    if (neuron && position) {
                        /*
                         * A detail constellation (project-style: hub ring +
                         * leaf ring) needs to fit more content on screen than
                         * a plain single-ring focus at the same path depth.
                         * Detect it structurally: does anything two levels
                         * deeper than the focus exist in the current
                         * positions map?
                         */
                        const hasGrandchildren = Array.from(
                            positions.values()
                        ).some((p) => p.depth === position.depth + 2);

                        const zoom = hasGrandchildren
                            ? position.depth <= 1
                                ? 1.08
                                : position.depth === 2
                                    ? 1.14
                                    : 1.2
                            : position.depth === 1
                                ? 1.18
                                : position.depth === 2
                                    ? 1.34
                                    : position.depth === 3
                                        ? 1.46
                                        : 1.58;

                        focusCamera(
                            camera,
                            neuron.x,
                            neuron.y,
                            width / 2,
                            height / 2,
                            zoom
                        );

                        camera.push = 0.035;

                        clearTransientActivity(
                            signals,
                            pulses
                        );

                        neuron.energy = Math.max(
                            neuron.energy,
                            0.65
                        );

                        neuron.activity = 1;
                        neuron.firing = 1;
                    }
                }
            }

            updateCamera(
                camera,
                pointer,
                reducedMotion,
                time,
                delta
            );

            /* -------------------------------------------------------- */
            /* Neural focus weights                                      */
            /* -------------------------------------------------------- */

            const activeSet = new Set(activePath);
            const focusActive =
                activeSet.size > 1 ||
                Boolean(focusId) ||
                Boolean(hoveredId);

            neurons.forEach((neuron) => {
                neuron.onActivePath =
                    activeSet.has(neuron.id);

                neuron.hovered =
                    neuron.id === hoveredId;

                const isFocus =
                    neuron.id === focusId;

                const target =
                    isFocus ? 1 :
                        neuron.onActivePath ? 0.9 :
                            neuron.hovered ? 0.85 :
                                focusActive ? 0.08 :
                                    0.65;

                neuron.focusWeight +=
                    (target - neuron.focusWeight) *
                    (reducedMotion ? 0.4 : 0.16);

                if (isFocus) {
                    neuron.energy = Math.max(
                        neuron.energy,
                        0.45
                    );
                }
            });

            /* -------------------------------------------------------- */
            /* Neuron physics                                            */
            /* -------------------------------------------------------- */

            neurons.forEach((neuron) => {
                updateNeuronLifecycle(
                    neuron,
                    time
                );

                updateNeuronMotion(
                    neuron,
                    time,
                    delta,
                    false,
                    0
                );

                decayNeuronActivity(
                    neuron
                );
            });

            /*
             * Sync DOM nodes right after neuron motion so both the DOM
             * node and this frame's canvas rope draw from the same
             * physics positions.
             */
            syncNodeElements();

            /* -------------------------------------------------------- */
            /* Rope synapses                                             */
            /* -------------------------------------------------------- */

            synapses.forEach((edge) => {
                updateSynapseLifecycle(
                    edge,
                    time
                );

                const from =
                    neurons.get(edge.fromId);

                const to =
                    neurons.get(edge.toId);

                if (!from || !to) return;

                updateSynapseSag(
                    edge,
                    from,
                    to,
                    delta
                );

                decaySynapseActivity(
                    edge
                );
            });

            /* -------------------------------------------------------- */
            /* Neural activity                                           */
            /* -------------------------------------------------------- */

            if (!reducedMotion) {
                spontaneousFire(
                    neurons,
                    synapses,
                    signals,
                    pulses,
                    time,
                    lastSpontaneous,
                    reducedMotion
                );

                const maxSignals =
                    isMobile
                        ? MAX_SIGNALS_MOBILE
                        : MAX_SIGNALS_DESKTOP;

                if (signals.length > maxSignals) {
                    signals.splice(
                        0,
                        signals.length - maxSignals
                    );
                }
            }

            updateSignals(
                signals,
                synapses,
                neurons,
                pulses,
                time,
                delta
            );

            updatePulses(
                pulses,
                delta
            );

            /* -------------------------------------------------------- */
            /* Ambient particles                                         */
            /* -------------------------------------------------------- */

            for (const particle of particles) {
                updateParticle(
                    particle,
                    width,
                    height,
                    reducedMotion
                );
            }

            garbageCollect(time);

            /* -------------------------------------------------------- */
            /* Rendering                                                  */
            /* -------------------------------------------------------- */

            const sim = simContext(
                time,
                delta
            );

            drawBackground(
                ctx,
                width,
                height
            );

            drawParticles(
                ctx,
                particles,
                time
            );

            synapses.forEach((edge) => {
                const from =
                    neurons.get(edge.fromId);

                const to =
                    neurons.get(edge.toId);

                if (!from || !to) return;

                drawSynapse(
                    ctx,
                    edge,
                    from,
                    to,
                    sim
                );
            });

            drawSignals(
                ctx,
                signals,
                synapses,
                neurons,
                sim
            );

            drawPulses(
                ctx,
                pulses
            );

            // Neuron bodies are rendered exclusively by GraphNode.tsx.
            // Canvas is responsible only for synapses/signals/pulses/particles.

            if (
                pointer.active &&
                !reducedMotion
            ) {
                drawPointerField(
                    ctx,
                    pointer.x,
                    pointer.y
                );
            }

            frame =
                requestAnimationFrame(loop);
        };

        frame =
            requestAnimationFrame(loop);

        return () => {
            destroyed = true;

            cancelAnimationFrame(frame);

            window.removeEventListener("resize", resize);
            window.removeEventListener("mousemove", onPointerMove);
            window.removeEventListener("mouseleave", onPointerLeave);
            window.removeEventListener("pointermove", onDragMove);
            window.removeEventListener("pointerup", onDragEnd);

            neurons.clear();
            synapses.clear();
            signals.length = 0;
            pulses.length = 0;
            particles.length = 0;
            nodeElements.clear();
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const dragApi = useMemo<NodeDragApi>(
        () => ({
            startNodeDrag: (id, x, y) =>
                dragApiRef.current.startNodeDrag(id, x, y),

            consumeDragSuppressedClick: () =>
                dragApiRef.current.consumeDragSuppressedClick(),

            registerNodeElement: (id, el) =>
                dragApiRef.current.registerNodeElement(id, el),
        }),
        []
    );

    return {
        canvasRef,
        dragApi,
    };
}
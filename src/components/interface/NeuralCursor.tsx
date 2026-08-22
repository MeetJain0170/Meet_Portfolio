"use client";

import { useEffect, useState } from "react";

export default function NeuralCursor() {
  const [position, setPosition] = useState({
    x: -100,
    y: -100,
  });

  const [visible, setVisible] = useState(false);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    // Don't use custom cursor on touch devices.
    if (window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    const move = (event: MouseEvent) => {
      setPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setVisible(true);

      const target = event.target as HTMLElement | null;

      if (!target) {
        setInteractive(false);
        return;
      }

      const isInteractive =
        target.closest(
          "button, a, [role='button'], input, textarea, select"
        ) !== null;

      setInteractive(isInteractive);
    };

    const leave = () => {
      setVisible(false);
    };

    const enter = () => {
      setVisible(true);
    };

    window.addEventListener("mousemove", move);
    document.addEventListener("mouseleave", leave);
    document.addEventListener("mouseenter", enter);

    return () => {
      window.removeEventListener("mousemove", move);
      document.removeEventListener("mouseleave", leave);
      document.removeEventListener("mouseenter", enter);
    };
  }, []);

  return (
    <div
      className={`neural-cursor ${
        visible ? "neural-cursor-visible" : ""
      } ${interactive ? "neural-cursor-interactive" : ""}`}
      style={{
        left: position.x,
        top: position.y,
      }}
      aria-hidden="true"
    >
      {/* Core */}
      <span className="neural-cursor-core" />

      {/* Targeting brackets */}
      <span className="neural-cursor-bracket neural-cursor-bracket-tl" />
      <span className="neural-cursor-bracket neural-cursor-bracket-tr" />
      <span className="neural-cursor-bracket neural-cursor-bracket-bl" />
      <span className="neural-cursor-bracket neural-cursor-bracket-br" />

      {/* Secondary targeting point */}
      <span className="neural-cursor-orbit" />

      {/* Very subtle crosshair */}
      <span className="neural-cursor-line neural-cursor-line-x" />
      <span className="neural-cursor-line neural-cursor-line-y" />
    </div>
  );
}
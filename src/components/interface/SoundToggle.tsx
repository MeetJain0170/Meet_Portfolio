"use client";

import { useState } from "react";
import {
  isSoundEnabled,
  setSoundEnabled,
  unlockAudio,
  sfx,
} from "@/lib/sound";

export default function SoundToggle() {
  const [on, setOn] = useState(isSoundEnabled());

  const toggleSound = async () => {
    const next = !on;

    if (next) {
      await unlockAudio();
      setSoundEnabled(true);
      setOn(true);
      sfx.action();
    } else {
      setSoundEnabled(false);
      setOn(false);
    }
  };

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggleSound}
      className="
        border
        border-white/20
        bg-black/20
        px-3
        py-2
        font-mono
        text-[10px]
        tracking-[1.5px]
        text-white/75
        transition-all
        duration-200
        hover:border-cyan/60
        hover:bg-cyan/5
        hover:text-cyan
      "
      style={{
        boxShadow: on
          ? "0 0 12px rgba(0,229,255,0.08)"
          : "none",
      }}
    >
      SOUND:{" "}
      <span
        className={
          on
            ? "text-cyan"
            : "text-white/55"
        }
      >
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}
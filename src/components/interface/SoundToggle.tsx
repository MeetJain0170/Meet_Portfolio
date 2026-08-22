"use client";

import { useState } from "react";
import { isSoundEnabled, setSoundEnabled, unlockAudio, sfx } from "@/lib/sound";

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
      className="border border-white/10 px-3 py-2 font-mono text-[10px] tracking-[1.5px] text-dim transition-colors hover:border-cyan hover:text-cyan"
    >
      SOUND: {on ? "ON" : "OFF"}
    </button>
  );
}
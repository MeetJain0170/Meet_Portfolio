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
      aria-label={on ? "Mute sound" : "Unmute sound"}
      onClick={toggleSound}
      className="group flex items-center gap-2.5 rounded-none px-3 py-2 outline-none transition-all duration-200 focus-visible:ring-1 focus-visible:ring-cyan/70"
    >
      {/* Waveform bars — idle ambient motion while enabled. This is
          decorative, not literally driven by playback energy yet; wiring
          it to real audio events needs a small export from lib/sound.ts. */}
      <span
        aria-hidden="true"
        className="flex h-3.5 items-end gap-[2.5px]"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 2,
              height: on ? undefined : 3,
              background: on
                ? "rgba(0,229,255,0.9)"
                : "rgba(255,255,255,0.35)",
              boxShadow: on ? "0 0 6px rgba(0,229,255,0.6)" : "none",
              borderRadius: 1,
              animation: on
                ? `sound-bar 1.1s ease-in-out ${i * 0.15}s infinite`
                : "none",
            }}
          />
        ))}
      </span>

      <span
        className="font-mono text-[9px] tracking-[1.5px] transition-colors duration-200"
        style={{
          color: on ? "rgba(0,229,255,0.95)" : "rgba(255,255,255,0.55)",
        }}
      >
        {on ? "SOUND ON" : "SOUND OFF"}
      </span>

      <style>{`
        @keyframes sound-bar {
          0%, 100% { height: 4px; }
          50% { height: 14px; }
        }
      `}</style>
    </button>
  );
}
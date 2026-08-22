"use client";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let unlocked = false;

const audio = {
  typing: "/sounds/tech-ui-typing.wav",
  boot: "/sounds/system-bootup.wav",
  whiteflash: "/sounds/whiteflash.wav",
};

const players = new Map<keyof typeof audio, HTMLAudioElement>();
let lastHoverTime = 0;

function getAudio(name: keyof typeof audio) {
  let sound = players.get(name);

  if (!sound) {
    sound = new Audio(audio[name]);
    sound.preload = "auto";
    sound.setAttribute("playsinline", "");
    players.set(name, sound);
  }

  return sound;
}

export function ensureAudio() {
  if (typeof window === "undefined") return null;

  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!Ctor) return null;

    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
  }

  return ctx;
}

export async function unlockAudio() {
  if (typeof window === "undefined") return;

  const c = ensureAudio();
  if (!c) return;

  try {
    if (c.state === "suspended") {
      await c.resume();
    }

    unlocked = c.state === "running";
  } catch {
    unlocked = false;
  }
}

export function installAudioUnlock() {
  if (typeof window === "undefined") return;

  const unlock = () => {
    void unlockAudio();
  };

  window.addEventListener("pointerdown", unlock, {
    once: true,
    passive: true,
  });

  window.addEventListener("keydown", unlock, {
    once: true,
  });

  window.addEventListener("touchstart", unlock, {
    once: true,
    passive: true,
  });
}

export function setSoundEnabled(value: boolean) {
  enabled = value;

  if (value) {
    void unlockAudio();
  } else {
    for (const sound of players.values()) {
      sound.pause();
    }
  }
}

export function isSoundEnabled() {
  return enabled;
}

/* ================================================================
 * FILE AUDIO
 * ================================================================ */

function playFile(name: keyof typeof audio, volume = 0.5) {
  if (!enabled || !unlocked || typeof window === "undefined") return;

  const sound = getAudio(name);

  sound.pause();
  sound.currentTime = 0;
  sound.volume = Math.max(0, Math.min(volume, 1));

  void sound.play().catch(() => {});
}

/* ================================================================
 * BOOT TYPING
 * ================================================================ */

function typing() {
  if (!enabled || typeof window === "undefined") return;

  const sound = getAudio("typing");

  sound.pause();
  sound.currentTime = 0;
  sound.volume = 0.32;
  sound.playbackRate = 1;

  void sound.play().catch(() => {});

  window.setTimeout(() => {
    sound.pause();
    sound.currentTime = 0;
  }, 3000);
}

/* ================================================================
 * BOOT
 * ================================================================ */

function boot() {
  playFile("boot", 0.48);
}

/* ================================================================
 * SYNTHETIC SOUND ENGINE
 * ================================================================ */

function blip(
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine"
) {
  if (!enabled) return;

  const c = ensureAudio();
  if (!c || !master) return;

  if (c.state === "suspended") {
    void c.resume();
  }

  const now = c.currentTime;
  const oscillator = c.createOscillator();
  const gain = c.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(volume, 0.0001),
    now + 0.012
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + duration
  );

  oscillator.connect(gain);
  gain.connect(master);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

/* ================================================================
 * BOOT PROCESSING
 * ================================================================ */

function processing() {
  blip(520, 0.065, 0.012, "sine");
}

function systemOnline() {
  blip(440, 0.1, 0.025, "sine");

  window.setTimeout(() => {
    blip(660, 0.12, 0.03, "sine");
  }, 80);

  window.setTimeout(() => {
    blip(880, 0.16, 0.035, "sine");
  }, 170);
}

/* ================================================================
 * GRAPH HOVER
 * ================================================================ */

function hover() {
  const now = performance.now();

  if (now - lastHoverTime < 80) return;

  lastHoverTime = now;

  blip(720, 0.07, 0.018, "sine");
}

/* ================================================================
 * NODE EXPAND
 * ================================================================ */

function expand() {
  blip(420, 0.12, 0.025, "triangle");

  window.setTimeout(() => {
    blip(720, 0.12, 0.018, "sine");
  }, 45);
}

/* ================================================================
 * NODE LOCK
 * ================================================================ */

function lock() {
  blip(280, 0.16, 0.035, "triangle");

  window.setTimeout(() => {
    blip(560, 0.12, 0.02, "sine");
  }, 55);
}

/* ================================================================
 * ACTION
 * ================================================================ */

function action() {
  blip(880, 0.1, 0.03, "square");

  window.setTimeout(() => {
    blip(1320, 0.08, 0.018, "sine");
  }, 35);
}

/* ================================================================
 * TOKEN
 * ================================================================ */

function token() {
  blip(1040, 0.045, 0.014, "sine");
}

/* ================================================================
 * ACTIVATION START
 * ================================================================ */

function activationStart() {
  playFile("boot", 0.48);
}

/* ================================================================
 * ACTIVATION RISE
 * ================================================================ */

function activationRise() {
  if (!enabled) return;

  const c = ensureAudio();
  if (!c || !master) return;

  if (c.state === "suspended") {
    void c.resume();
  }

  const now = c.currentTime;

  const oscillator = c.createOscillator();
  const gain = c.createGain();

  oscillator.type = "sawtooth";

  oscillator.frequency.setValueAtTime(
    90,
    now
  );

  oscillator.frequency.exponentialRampToValueAtTime(
    900,
    now + 2.8
  );

  gain.gain.setValueAtTime(
    0.0001,
    now
  );

  gain.gain.exponentialRampToValueAtTime(
    0.028,
    now + 0.45
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 2.8
  );

  oscillator.connect(gain);
  gain.connect(master);

  oscillator.start(now);
  oscillator.stop(now + 2.85);
}

/* ================================================================
 * FLASH
 * ================================================================ */

function flash() {
  playFile("whiteflash", 0.45);
}

/* ================================================================
 * PUBLIC API
 * ================================================================ */

export const sfx = {
  typing,
  boot,
  processing,
  systemOnline,
  hover,
  expand,
  lock,
  action,
  token,
  activationStart,
  activationRise,
  flash,
};
"use client";

import { useEffect, useMemo, useState } from "react";
import { profile } from "@/data/profile";

const STATUS_LINES = [
  "RETRIEVING IDENTITY...",
  "LOADING MEMORY CLUSTERS...",
  "RECONSTRUCTING PROFILE...",
  "SYNCHRONIZING EXPERIENCE...",
  "IDENTITY RESTORED.",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function scatter(index: number) {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  const fraction = value - Math.floor(value);

  const angle = fraction * Math.PI * 2;
  const distance = 140 + (index % 7) * 34;

  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
  };
}

/**
 * Supports either:
 *
 * aboutSentence: "some text"
 *
 * OR
 *
 * aboutSentence: [
 *   "line one",
 *   "line two",
 * ]
 *
 * So you can change the profile structure later without
 * having to rewrite this component.
 */
function normalizeSentence(
  sentence: string | string[] | undefined
): string[] {
  if (!sentence) return [];

  if (Array.isArray(sentence)) {
    return sentence.filter((line) => line.trim().length > 0);
  }

  return sentence.trim().length > 0 ? [sentence.trim()] : [];
}

/* -------------------------------------------------------------------------- */
/* Animated item                                                              */
/* -------------------------------------------------------------------------- */

function AnimatedItem({
  children,
  index,
  delayBase,
  mounted,
  className = "",
}: {
  children: React.ReactNode;
  index: number;
  delayBase: number;
  mounted: boolean;
  className?: string;
}) {
  const { dx, dy } = scatter(index + delayBase);

  return (
    <span
      className={className}
      style={{
        opacity: mounted ? 1 : 0,

        transform: mounted
          ? "translate3d(0,0,0)"
          : `translate3d(${dx}px, ${dy}px, 0)`,

        textShadow: mounted
          ? "0 0 10px rgba(0,229,255,.35)"
          : "none",

        transition:
          "transform .7s cubic-bezier(.16,.84,.44,1), " +
          "opacity .5s ease",

        transitionDelay: `${(delayBase + index) * 45}ms`,

        willChange: "transform, opacity",
      }}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* About sentence                                                             */
/* -------------------------------------------------------------------------- */

function AboutSentence({
  lines,
  mounted,
}: {
  lines: string[];
  mounted: boolean;
}) {
  if (!lines.length) return null;

  return (
    <div
      className="
        w-full
        max-w-[900px]
        px-4
        text-center
      "
    >
      {lines.map((line, lineIndex) => (
        <div
          key={`${line}-${lineIndex}`}
          className="
            mb-1
            flex
            flex-wrap
            items-center
            justify-center
            gap-x-2
            gap-y-1
            last:mb-0
          "
        >
          {line.split(/\s+/).map((word, wordIndex) => {
            const globalIndex =
              lines
                .slice(0, lineIndex)
                .reduce(
                  (count, previousLine) =>
                    count + previousLine.split(/\s+/).length,
                  0
                ) + wordIndex;

            const { dx, dy } = scatter(globalIndex);

            return (
              <span
                key={`${word}-${wordIndex}`}
                aria-hidden="true"
                className="
                  inline-block
                  font-mono
                  text-[13px]
                  font-medium
                  uppercase
                  leading-[1.8]
                  tracking-[1.25px]
                  text-white/90
                  md:text-[15px]
                "
                style={{
                  transform: mounted
                    ? "translate3d(0,0,0)"
                    : `translate3d(${dx}px, ${dy}px, 0)`,

                  opacity: mounted ? 1 : 0,

                  textShadow: mounted
                    ? "0 0 10px rgba(0,229,255,.35)"
                    : "none",

                  transition:
                    "transform .7s cubic-bezier(.16,.84,.44,1), " +
                    "opacity .5s ease",

                  transitionDelay: `${globalIndex * 35}ms`,

                  willChange: "transform, opacity",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Technology grid                                                            */
/* -------------------------------------------------------------------------- */

function SkillGrid({
  mounted,
  delayBase,
}: {
  mounted: boolean;
  delayBase: number;
}) {
  const skills = Array.isArray(profile.interestLayer)
    ? profile.interestLayer
    : [];

  if (!skills.length) return null;

  return (
    <div
      className="
        grid
        w-full
        gap-x-6
        gap-y-4
      "
      style={{
        /*
         * IMPORTANT:
         *
         * No hard-coded "grid-cols-4".
         *
         * The browser automatically determines how many columns fit.
         *
         * If you add:
         *   6 skills  -> balanced automatically
         *   8 skills  -> balanced automatically
         *   10 skills -> balanced automatically
         *   15 skills -> still works
         */
        gridTemplateColumns:
          "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
      }}
    >
      {skills.map((skill, index) => {
        const { dx, dy } = scatter(index + delayBase);

        return (
          <span
            key={skill.id}
            className="
              flex
              min-w-0
              items-center
              justify-center
              gap-2
              overflow-hidden
              font-mono
              text-[11px]
              font-medium
              uppercase
              tracking-[1.25px]
              text-cyan
              md:text-[12px]
            "
            style={{
              opacity: mounted ? 1 : 0,

              transform: mounted
                ? "translate3d(0,0,0)"
                : `translate3d(${dx}px, ${dy}px, 0)`,

              textShadow: mounted
                ? "0 0 10px rgba(0,229,255,.35)"
                : "none",

              transition:
                "transform .7s cubic-bezier(.16,.84,.44,1), " +
                "opacity .5s ease",

              transitionDelay: `${(delayBase + index) * 45}ms`,

              willChange: "transform, opacity",
            }}
          >
            {/* Icon / fallback */}
            <span
              aria-hidden="true"
              className="
                flex
                h-7
                w-7
                shrink-0
                items-center
                justify-center
                rounded
                border
                border-cyan/20
                bg-cyan/5
                font-mono
                text-[9px]
                text-cyan
              "
            >
              {(skill.icon || skill.label || "?")
                .slice(0, 2)
                .toUpperCase()}
            </span>

            {/* Technology name */}
            <span
              className="
                min-w-0
                truncate
              "
              title={skill.label}
            >
              {skill.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                            */
/* -------------------------------------------------------------------------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        mb-5
        text-center
        font-mono
        text-[11px]
        font-medium
        uppercase
        tracking-[3px]
        text-white/30
        md:text-[12px]
      "
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export default function AboutTokens({
  x,
  y,
}: {
  x: number;
  y: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);

  /*
   * Normalize the profile here.
   *
   * This means profile.ts can use either:
   *
   * aboutSentence: "..."
   *
   * or:
   *
   * aboutSentence: ["...", "..."]
   */
  const sentenceLines = useMemo(
    () => normalizeSentence(profile.aboutSentence),
    []
  );

  /*
   * Calculate a stable animation offset from the amount
   * of content rather than hard-coding a number.
   */
  const sentenceWordCount = useMemo(
    () =>
      sentenceLines.reduce(
        (count, line) => count + line.split(/\s+/).length,
        0
      ),
    [sentenceLines]
  );

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setMounted(true);
    });

    const interval = setInterval(() => {
      setStatusIdx((current) =>
        Math.min(current + 1, STATUS_LINES.length - 1)
      );
    }, 420);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="
        pointer-events-none
        absolute
        z-20

        flex
        w-[min(1000px,92vw)]
        -translate-x-1/2
        -translate-y-[35px]

        flex-col
        items-center

        gap-4

        text-center
      "
      style={{
        left: x,
        top: y,
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* STATUS                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div
        aria-hidden="true"
        className="
          font-mono
          text-[10px]
          tracking-[3px]
          text-violet
          transition-opacity
          duration-300
        "
        style={{
          opacity: mounted ? 1 : 0,
        }}
      >
        {STATUS_LINES[statusIdx]}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ABOUT                                                               */}
      {/* ------------------------------------------------------------------ */}

      <AboutSentence
        lines={sentenceLines}
        mounted={mounted}
      />

      {/* ------------------------------------------------------------------ */}
      {/* CORE TECHNOLOGIES                                                  */}
      {/* ------------------------------------------------------------------ */}

      {profile.interestLayer?.length > 0 && (
        <div
          className="
            mt-4
            w-full
            max-w-[820px]
            px-2
          "
        >
          <SectionTitle>
            CORE TECHNOLOGIES
          </SectionTitle>

          <SkillGrid
            mounted={mounted}
            delayBase={sentenceWordCount + 4}
          />
        </div>
      )}
    </div>
  );
}
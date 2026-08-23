"use client";

import { GraphNodeDef } from "@/lib/graph";
import SoundToggle from "./SoundToggle";
import PeripheralNeuralField from "./PeripheralNeuralField";

export default function SystemHUD({
  breadcrumb,
  onReturn,
  aboutActive,
}: {
  breadcrumb: GraphNodeDef[];
  onReturn: () => void;
  aboutActive: boolean;
}) {
  const nested = breadcrumb.length > 1;

  const activeCluster =
    breadcrumb[breadcrumb.length - 1]?.label ?? "MEET";

  /*
   * =========================================================
   * HUD VISIBILITY CONTROL
   * =========================================================
   *
   * Change THESE values to control the entire HUD.
   *
   * text       = main HUD text
   * mutedText  = secondary HUD text
   * subtleText = tiny / decorative text
   * panel      = box background
   * panelBorder= box border
   */

  const HUD = {
    text: "rgba(255,255,255,0.95)",
    mutedText: "rgba(255,255,255,0.75)",
    subtleText: "rgba(255,255,255,0.55)",

    panel: "rgba(0,0,0,0.65)",
    panelBorder: "rgba(255,255,255,0.28)",

    cyanBorder: "rgba(0,229,255,0.45)",
    violetBorder: "rgba(138,43,255,0.45)",
  };

  return (
    <>
      <PeripheralNeuralField 
        aboutActive={aboutActive}
      />

      {/* =========================================================
          AMBIENT HUD ATMOSPHERE
          ========================================================= */}

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      >
        {/* Cyan atmospheric glow */}
        <div
          className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full"
          style={{
            background: `radial-gradient(
              circle,
              rgba(0,229,255,0.085) 0%,
              rgba(0,229,255,0.03) 35%,
              transparent 70%
            )`,
          }}
        />

        {/* Violet atmospheric glow */}
        <div
          className="absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full"
          style={{
            background: `radial-gradient(
              circle,
              rgba(138,43,255,0.09) 0%,
              rgba(138,43,255,0.03) 38%,
              transparent 72%
            )`,
          }}
        />

        {/* Technical grid */}
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.055,
            backgroundImage: `
              linear-gradient(
                rgba(0,229,255,0.45) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(0,229,255,0.45) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "64px 64px",
          }}
        />

        {/* Horizontal scanlines */}
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.035,
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(255,255,255,0.5) 4px)",
          }}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at center, transparent 35%, rgba(4,5,10,0.08) 75%, rgba(4,5,10,0.35) 100%)",
          }}
        />
      </div>

      {/* =========================================================
          TOP LEFT — SYSTEM ID
          ========================================================= */}

      <div className="fixed left-5 top-5 z-[200] select-none md:left-7 md:top-7">
        <div
          className="relative px-4 py-3 backdrop-blur-[5px]"
          style={{
            background: HUD.panel,
            border: `1px solid ${HUD.cyanBorder}`,
            boxShadow: `
              inset 0 0 24px rgba(0,229,255,0.035),
              0 0 30px rgba(0,229,255,0.055)
            `,
          }}
        >
          {/* Corner accents */}
          <span
            className="absolute -left-px -top-px h-2 w-2"
            style={{
              borderLeft: "1px solid rgba(0,229,255,0.9)",
              borderTop: "1px solid rgba(0,229,255,0.9)",
            }}
          />

          <span
            className="absolute -right-px -top-px h-2 w-2"
            style={{
              borderRight: "1px solid rgba(0,229,255,0.4)",
              borderTop: "1px solid rgba(0,229,255,0.4)",
            }}
          />

          <span
            className="absolute -bottom-px -left-px h-2 w-2"
            style={{
              borderBottom: "1px solid rgba(0,229,255,0.4)",
              borderLeft: "1px solid rgba(0,229,255,0.4)",
            }}
          />

          <div
            className="font-mono text-[10px] tracking-[2.5px]"
            style={{
              color: HUD.text,
            }}
          >
            MEET{" "}
            <span style={{ color: HUD.subtleText }}>
              //
            </span>{" "}
            <b
              className="font-medium"
              style={{
                color: "rgba(0,229,255,0.95)",
              }}
            >
              NEURAL CORE
            </b>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: "#00e5ff",
                boxShadow:
                  "0 0 9px rgba(0,229,255,1)",
              }}
            />

            <span
              className="font-mono text-[8px] tracking-[2px]"
              style={{
                color: HUD.mutedText,
              }}
            >
              SYSTEM INTERFACE
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================
          TOP RIGHT — SYSTEM STATUS
          ========================================================= */}

      <div className="fixed right-5 top-5 z-[200] hidden select-none md:right-7 md:top-7 md:block">
        <div
          className="px-4 py-3 backdrop-blur-[5px]"
          style={{
            background: HUD.panel,
            border: `1px solid ${HUD.panelBorder}`,
            boxShadow:
              "inset 0 0 24px rgba(255,255,255,0.025)",
          }}
        >
          <div
            className="mb-2 font-mono text-[8px] tracking-[2.5px]"
            style={{
              color: HUD.subtleText,
            }}
          >
            SYSTEM STATUS
          </div>

          <div className="flex gap-5 font-mono text-[9px] tracking-[1.5px]">
            <span style={{ color: HUD.mutedText }}>
              SIGNAL:{" "}
              <b style={{ color: "rgba(0,229,255,0.95)" }}>
                98.2%
              </b>
            </span>

            <span style={{ color: HUD.mutedText }}>
              NETWORK:{" "}
              <b style={{ color: "rgba(110,231,183,0.9)" }}>
                ONLINE
              </b>
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================
          BOTTOM LEFT — NODE INFORMATION
          ========================================================= */}

      <div className="fixed bottom-5 left-5 z-[200] hidden select-none md:bottom-7 md:left-7 md:block">
        <div
          className="px-4 py-3 backdrop-blur-[5px]"
          style={{
            background: HUD.panel,
            border: `1px solid ${HUD.violetBorder}`,
            boxShadow: `
              inset 0 0 25px rgba(138,43,255,0.035),
              0 0 30px rgba(138,43,255,0.055)
            `,
          }}
        >
          <div
            className="mb-2 font-mono text-[8px] tracking-[2.5px]"
            style={{
              color: HUD.subtleText,
            }}
          >
            NEURAL TELEMETRY
          </div>

          <div className="flex gap-5 font-mono text-[9px] tracking-[1.5px]">
            <span style={{ color: HUD.mutedText }}>
              NODE_ID:{" "}
              <b style={{ color: "rgba(167,139,250,0.95)" }}>
                0x04A7
              </b>
            </span>

            <span style={{ color: HUD.mutedText }}>
              ACTIVE:{" "}
              <b style={{ color: "rgba(167,139,250,0.95)" }}>
                {activeCluster}
              </b>
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================
          SOUND
          ========================================================= */}

      <div className="fixed bottom-5 right-5 z-[200] md:bottom-7 md:right-7">
        <div
          className="p-2 backdrop-blur-[5px]"
          style={{
            background: HUD.panel,
            border: `1px solid ${HUD.panelBorder}`,
            boxShadow:
              "0 0 25px rgba(0,229,255,0.20)",
          }}
        >
          <SoundToggle />
        </div>
      </div>

      {/* =========================================================
          RETURN TO CORE
          ========================================================= */}

      <button
        type="button"
        onClick={onReturn}
        className="fixed left-1/2 top-5 z-[200] -translate-x-1/2 select-none px-5 py-2.5 font-mono text-[9px] tracking-[2.5px] backdrop-blur-md transition-all duration-300 md:top-7"
        style={{
          opacity: nested ? 1 : 0,
          pointerEvents: nested
            ? "auto"
            : "none",

          background: HUD.panel,

          border: `1px solid ${nested
              ? "rgba(0,229,255,0.4)"
              : "rgba(0,229,255,0.15)"
            }`,

          color: nested
            ? HUD.text
            : HUD.subtleText,

          boxShadow: nested
            ? `
              0 0 25px rgba(0,229,255,0.065),
              inset 0 0 15px rgba(0,229,255,0.035)
            `
            : "none",
        }}
      >
        <span
          className="mr-2"
          style={{
            color: "rgba(0,229,255,0.9)",
          }}
        >
          ←
        </span>

        RETURN TO CORE

        <span
          className="ml-3"
          style={{
            color: HUD.subtleText,
          }}
        >
          (ESC)
        </span>
      </button>

      {/* =========================================================
          SCREEN EDGE HUD MARKERS
          ========================================================= */}

      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-1/2 z-[150] h-16 w-1 -translate-y-1/2"
        style={{
          borderLeft: "1px solid rgba(0,229,255,0.32)",
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-0 top-1/2 z-[150] h-16 w-1 -translate-y-1/2"
        style={{
          borderRight:
            "1px solid rgba(138,43,255,0.32)",
        }}
      />

      {/* Bottom center system marker */}

      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-5 left-1/2 z-[150] hidden -translate-x-1/2 font-mono text-[7px] tracking-[4px] md:block"
        style={{
          color: HUD.subtleText,
        }}
      >
        NEURAL SYSTEM // ACTIVE
      </div>
    </>
  );
}
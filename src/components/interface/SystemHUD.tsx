"use client";
import { GraphNodeDef } from "@/lib/graph";
import SoundToggle from "./SoundToggle";

export default function SystemHUD({
  breadcrumb,
  onReturn,
}: {
  breadcrumb: GraphNodeDef[];
  onReturn: () => void;
}) {
  const nested = breadcrumb.length > 1;
  return (
    <>
      <div className="fixed left-5 top-5 z-[200] select-none font-mono text-[11px] tracking-[2px] text-dim">
        MEET <span aria-hidden="true">//</span> <b className="font-medium text-cyan">NEURAL CORE</b>
      </div>

      <div className="fixed right-5 top-5 z-[200] hidden select-none font-mono text-[10px] tracking-[2px] text-dim md:flex md:gap-4">
        <span>
          SIGNAL: <b className="text-white/80">98.2%</b>
        </span>
        <span>
          NETWORK: <b className="text-white/80">ONLINE</b>
        </span>
      </div>

      <div className="fixed bottom-5 left-5 z-[200] hidden select-none font-mono text-[10px] tracking-[1.5px] text-dim md:flex md:gap-4">
        <span>
          NODE_ID: <b className="text-violet">0x04A7</b>
        </span>
        <span>
          ACTIVE CLUSTER: <b className="text-violet">{breadcrumb[breadcrumb.length - 1]?.label ?? "MEET"}</b>
        </span>
      </div>

      <div className="fixed bottom-5 right-5 z-[200]">
        <SoundToggle />
      </div>

      <button
        type="button"
        onClick={onReturn}
        className="fixed left-1/2 top-5 z-[200] -translate-x-1/2 border border-white/10 bg-panel/70 px-4 py-2 font-mono text-[10px] tracking-[2px] text-dim backdrop-blur-sm transition-opacity duration-300 hover:text-cyan"
        style={{ opacity: nested ? 1 : 0, pointerEvents: nested ? "auto" : "none" }}
      >
        ← RETURN TO CORE <span className="ml-2 opacity-60">(ESC)</span>
      </button>
    </>
  );
}

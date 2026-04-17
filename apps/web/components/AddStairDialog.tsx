import { useState } from "react";
import { ftIn } from "@shared/engine";
import type { StairInputMode } from "@/types/project";

export function AddStairDialog({
  nextStairNumber,
  onConfirm,
  onCancel,
}: {
  nextStairNumber: number;
  onConfirm: (config: {
    name: string;
    numFlights: number;
    mode: StairInputMode;
    totalRisers?: number;
    stairWidth: number;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(`Stair ${nextStairNumber}`);
  const [numFlights, setNumFlights] = useState(3);
  const [mode, setMode] = useState<StairInputMode>("per-flight");
  const [totalRisers, setTotalRisers] = useState(45);

  const defaultWidth = ftIn(3, 6);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[rgb(12,18,32)] p-6 shadow-2xl">
        <div className="text-lg font-semibold text-white">Add Stair</div>
        <div className="mt-1 text-sm text-white/50">
          Configure the stair and its flights
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-white/65">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
            />
          </div>

          <div>
            <label className="block text-sm text-white/65">
              Number of flights
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={numFlights}
              onChange={(e) =>
                setNumFlights(Math.max(1, Number(e.target.value)))
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
            />
          </div>

          <div>
            <label className="block text-sm text-white/65">
              Input mode
            </label>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm text-white/72">
                <input
                  type="radio"
                  checked={mode === "per-flight"}
                  onChange={() => setMode("per-flight")}
                  className="accent-cyan-300"
                />
                Per-flight
              </label>
              <label className="flex items-center gap-2 text-sm text-white/72">
                <input
                  type="radio"
                  checked={mode === "averaged"}
                  onChange={() => setMode("averaged")}
                  className="accent-cyan-300"
                />
                Averaged
              </label>
            </div>
            <div className="mt-1 text-xs text-white/40">
              {mode === "averaged"
                ? "Enter total risers — they'll be distributed evenly across flights."
                : "Fill in each flight's treads and risers individually."}
            </div>
          </div>

          {mode === "averaged" && (
            <div>
              <label className="block text-sm text-white/65">
                Total risers (all flights)
              </label>
              <input
                type="number"
                min={1}
                value={totalRisers}
                onChange={(e) =>
                  setTotalRisers(Math.max(1, Number(e.target.value)))
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
              />
              <div className="mt-1 text-xs text-white/40">
                ≈ {Math.floor(totalRisers / numFlights)} risers per
                flight
                {totalRisers % numFlights > 0 &&
                  ` (${totalRisers % numFlights} flights get +1)`}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                name: name.trim() || `Stair ${nextStairNumber}`,
                numFlights,
                mode,
                totalRisers:
                  mode === "averaged" ? totalRisers : undefined,
                stairWidth: defaultWidth,
              })
            }
            className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-4 py-2.5 text-sm text-cyan-100 transition hover:bg-cyan-300/20"
          >
            Create Stair
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { formatFeetInches } from "@shared/engine";
import type { FlightRecord, StairRecord } from "@/types/project";
import type { OpenMode } from "@/components/dockview/DockviewWorkbench";
import { buttonClass, cx } from "@/components/ui/uiStyles";

export function StairEditor({
  stair,
  onRenameStair,
  onAddFlight,
  onOpenFlight,
  onDeleteStair,
  onDeleteFlight,
  onDuplicateFlight,
}: {
  stair: StairRecord;
  onRenameStair: (name: string) => void;
  onAddFlight: () => void;
  onOpenFlight: (flightId: string, mode?: OpenMode) => void;
  onDeleteStair: () => void;
  onDeleteFlight: (flightId: string) => void;
  onDuplicateFlight: (flightId: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(stair.name);

  useEffect(() => {
    if (!editingName) setNameDraft(stair.name);
  }, [stair.name, editingName]);

  function commitRename() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== stair.name) onRenameStair(trimmed);
    setEditingName(false);
  }

  const flightCount = stair.flights.length;
  const summaryBits = [
    stair.inputMode === "averaged" ? "Averaged mode" : "Per-flight mode",
    stair.totalRisers ? `${stair.totalRisers} total risers` : null,
    typeof stair.defaultStairWidth === "number"
      ? `${formatFeetInches(stair.defaultStairWidth)} default width`
      : null,
    `${flightCount} flight${flightCount === 1 ? "" : "s"}`,
  ].filter(Boolean) as string[];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <div className="space-y-6 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {editingName ? (
                <input
                  type="text"
                  value={nameDraft}
                  autoFocus
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    else if (e.key === "Escape") {
                      setNameDraft(stair.name);
                      setEditingName(false);
                    }
                  }}
                  className="w-full rounded-md border border-cyan-300/40 bg-slate-950/70 px-3 py-2 text-xl font-semibold text-white outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  title="Click to rename"
                  className="text-left text-xl font-semibold text-white/96 transition hover:text-white"
                >
                  {stair.name}
                </button>
              )}
              <div className="mt-2 text-sm text-white/58">
                {summaryBits.join(" · ")}
              </div>
            </div>
            <button
              type="button"
              onClick={onDeleteStair}
              className={`${buttonClass.destructive} shrink-0`}
            >
              Delete Stair
            </button>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                Flights
              </div>
              <button
                type="button"
                onClick={onAddFlight}
                className={buttonClass.secondary}
              >
                + Add Flight
              </button>
            </div>

            {flightCount === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/56">
                No flights yet. Click “Add Flight” to create one.
              </div>
            ) : (
              <div className="space-y-1.5">
                {stair.flights.map((flight) => (
                  <FlightRow
                    key={flight.id}
                    flight={flight}
                    onOpen={(mode) => onOpenFlight(flight.id, mode)}
                    onDuplicate={() => onDuplicateFlight(flight.id)}
                    onDelete={() => onDeleteFlight(flight.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function FlightRow({
  flight,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  flight: FlightRecord;
  onOpen: (mode?: OpenMode) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cx(
        "group flex items-center gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition",
        "hover:border-white/14 hover:bg-white/[0.05]",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen()}
        className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left"
      >
        <span className="font-medium text-white/88">Flight {flight.order}</span>
        <FlightChips flight={flight} />
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        className="rounded px-2 py-1 text-xs text-white/52 transition hover:bg-white/[0.06] hover:text-white/88"
      >
        Duplicate
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded px-2 py-1 text-xs text-red-300/70 transition hover:bg-red-500/[0.08] hover:text-red-200"
      >
        Delete
      </button>
    </div>
  );
}

const TREAD_TYPE_LABEL: Record<string, string> = {
  pan: "Pan",
  "checker-plate": "Checker",
  grating: "Grating",
};

function FlightChips({ flight }: { flight: FlightRecord }) {
  const v = flight.stairValues;
  const chips: string[] = [];
  if (v.numTreads != null) chips.push(`${v.numTreads}T`);
  if (v.numRisers != null) chips.push(`${v.numRisers}R`);
  if (typeof v.stairWidth === "number")
    chips.push(`${formatFeetInches(v.stairWidth)} W`);
  if (typeof v.riserHeight === "number")
    chips.push(`${formatFeetInches(v.riserHeight)} RH`);
  if (typeof v.treadDepth === "number")
    chips.push(`${formatFeetInches(v.treadDepth)} TD`);
  if (typeof v.stringerSize === "string") chips.push(v.stringerSize);
  if (typeof v.treadType === "string" && TREAD_TYPE_LABEL[v.treadType])
    chips.push(TREAD_TYPE_LABEL[v.treadType]);
  if (flight.landing) chips.push("Landing");
  if (flight.rails.length > 0)
    chips.push(
      `${flight.rails.length} Rail${flight.rails.length === 1 ? "" : "s"}`,
    );

  if (chips.length === 0) {
    return <span className="text-xs italic text-white/40">no data yet</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {chips.map((c) => (
        <span
          key={c}
          className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-white/70"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import { useDockviewActions } from "@/components/dockview/DockviewActionsContext";
import { cx } from "@/components/ui/uiStyles";

export function WelcomeDashboard() {
  const project = useWorkbenchStore((s) => s.project);
  const actions = useDockviewActions();
  const [search, setSearch] = useState("");

  const totals = useMemo(() => {
    let flights = 0;
    let treads = 0;
    let risers = 0;
    let rails = 0;
    for (const stair of project.stairs) {
      flights += stair.flights.length;
      for (const flight of stair.flights) {
        const v = flight.stairValues;
        if (typeof v.numTreads === "number") treads += v.numTreads;
        if (typeof v.numRisers === "number") risers += v.numRisers;
        rails += flight.rails.length;
      }
    }
    return {
      stairs: project.stairs.length,
      flights,
      treads,
      risers,
      rails,
      ladders: project.ladders.length,
      landings: project.landingTemplates.length,
    };
  }, [project]);

  const recentFlights = useMemo(() => {
    return project.stairs
      .flatMap((stair) => stair.flights.map((flight) => ({ stair, flight })))
      .sort(
        (a, b) =>
          Date.parse(b.flight.updatedAt) - Date.parse(a.flight.updatedAt),
      )
      .slice(0, 8);
  }, [project.stairs]);

  const q = search.trim().toLowerCase();
  const filteredStairs = useMemo(() => {
    if (!q) return project.stairs;
    return project.stairs.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.flights.some((f) => `flight ${f.order}`.includes(q)),
    );
  }, [project.stairs, q]);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="mx-auto w-full max-w-4xl space-y-6 px-8 py-8">
        <header className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Project
          </div>
          <h1 className="text-2xl font-semibold text-white">{project.name}</h1>
          <div className="text-sm text-white/52">
            Overview of stairs, rails, ladders, and landings in this workbench.
          </div>
        </header>

        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stairs and flights…"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 hover:border-white/18 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
          />
        </div>

        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Totals
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <TotalCard label="Stairs" value={totals.stairs} />
            <TotalCard label="Flights" value={totals.flights} />
            <TotalCard label="Treads" value={totals.treads} />
            <TotalCard label="Risers" value={totals.risers} />
            <TotalCard label="Rails" value={totals.rails} />
            <TotalCard label="Ladders" value={totals.ladders} />
            <TotalCard label="Landings" value={totals.landings} />
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Recent activity
            </div>
            {recentFlights.length === 0 ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-white/52">
                No flights yet.
              </div>
            ) : (
              <div className="space-y-1">
                {recentFlights.map(({ stair, flight }) => (
                  <button
                    key={flight.id}
                    type="button"
                    onClick={() => actions.openFlight(stair.id, flight.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-sm text-white/82 transition hover:border-white/14 hover:bg-white/[0.05] hover:text-white"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-white/55">{stair.name}</span>
                      <span className="text-white/30"> / </span>
                      <span>Flight {flight.order}</span>
                    </span>
                    <span className="shrink-0 text-xs text-white/40">
                      {formatRelativeTime(flight.updatedAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Jump to stair
            </div>
            {filteredStairs.length === 0 ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-white/52">
                {q ? "No matches." : "No stairs yet."}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredStairs.map((stair) => (
                  <button
                    key={stair.id}
                    type="button"
                    onClick={() => actions.openStair(stair.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-sm text-white/82 transition hover:border-white/14 hover:bg-white/[0.05] hover:text-white"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {stair.name}
                    </span>
                    <span className="shrink-0 text-xs text-white/45">
                      {stair.flights.length} flight
                      {stair.flights.length === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TotalCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className={cx(
        "rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-white/92">
        {value}
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, (Date.now() - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = diffSec / 60;
  if (diffMin < 60) return `${Math.round(diffMin)}m ago`;
  const diffHr = diffMin / 60;
  if (diffHr < 24) return `${Math.round(diffHr)}h ago`;
  const diffDay = diffHr / 24;
  if (diffDay < 7) return `${Math.round(diffDay)}d ago`;
  return new Date(then).toLocaleDateString();
}

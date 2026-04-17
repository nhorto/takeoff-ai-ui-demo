import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import type { AddActions, PanelOpener } from "@/components/sidebar/types";

export function WelcomeSection({
  addActions,
  panelOpener,
}: {
  addActions: AddActions;
  panelOpener: PanelOpener;
}) {
  const stairs = useWorkbenchStore((s) => s.project.stairs);

  const recentFlights = stairs
    .flatMap((stair) => stair.flights.map((flight) => ({ stair, flight })))
    .sort((a, b) => Date.parse(b.flight.updatedAt) - Date.parse(a.flight.updatedAt))
    .slice(0, 5);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
          Quick actions
        </div>
        <div className="mt-2 grid gap-1.5">
          <QuickButton label="+ New Stair" onClick={addActions.onAddStair} />
          <QuickButton label="+ New Rail" onClick={addActions.onAddRail} />
          <QuickButton label="+ New Ladder" onClick={addActions.onAddLadder} />
          <QuickButton label="+ New Landing" onClick={addActions.onAddLanding} />
        </div>
      </div>

      {recentFlights.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
            Recent flights
          </div>
          <div className="mt-2 space-y-0.5">
            {recentFlights.map(({ stair, flight }) => (
              <button
                key={flight.id}
                type="button"
                onClick={() => panelOpener.openFlight(stair, flight)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-white/72 transition hover:bg-white/[0.06] hover:text-white"
              >
                <span className="text-white/35">◦</span>
                <span className="truncate">
                  {stair.name} / Flight {flight.order}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-white/75 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
    >
      {label}
    </button>
  );
}

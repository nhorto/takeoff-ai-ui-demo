import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import type { AddActions, PanelOpener } from "@/components/sidebar/types";
import { buttonClass, cx } from "@/components/ui/uiStyles";

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
      <div className="rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
          Workspace
        </div>
        <div className="mt-2 text-sm font-medium text-white/88">
          Demo project
        </div>
        <div className="mt-1 text-sm text-white/58">
          Quick actions and recent flights for the current workbench.
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Quick actions
          </div>
          <div className="mt-2 grid gap-2">
            <QuickButton label="+ New Stair" onClick={addActions.onAddStair} />
            <QuickButton label="+ New Rail" onClick={addActions.onAddRail} />
            <QuickButton label="+ New Ladder" onClick={addActions.onAddLadder} />
            <QuickButton label="+ New Landing" onClick={addActions.onAddLanding} />
          </div>
        </div>

        {recentFlights.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Recent flights
            </div>
            <div className="mt-2 space-y-1">
              {recentFlights.map(({ stair, flight }) => (
                <button
                  key={flight.id}
                  type="button"
                  onClick={() => panelOpener.openFlight(stair, flight)}
                  className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm text-white/78 transition hover:border-white/8 hover:bg-white/[0.05] hover:text-white"
                >
                  <span className="text-white/42">◦</span>
                  <span className="truncate">
                    {stair.name} / Flight {flight.order}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
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
      className={cx(buttonClass.secondary, "w-full justify-start")}
    >
      {label}
    </button>
  );
}

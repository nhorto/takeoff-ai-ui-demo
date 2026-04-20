import type { FlightRecord, StairRecord } from "@/types/project";
import { buttonClass, cx } from "@/components/ui/uiStyles";

export function WelcomeView({
  stairs,
  onAddStair,
  onSelectFlight,
}: {
  stairs: StairRecord[];
  onAddStair: () => void;
  onSelectFlight: (stair: StairRecord, flight: FlightRecord) => void;
}) {
  const recentFlights = stairs
    .flatMap((stair) => stair.flights.map((flight) => ({ stair, flight })))
    .sort(
      (a, b) =>
        Date.parse(b.flight.updatedAt) - Date.parse(a.flight.updatedAt),
    )
    .slice(0, 5);

  return (
    <div className="flex-1 px-6 py-6">
      <div className="mx-auto max-w-2xl pt-10">
        <div className="text-center text-sm text-white/64">
          Your stair assemblies
        </div>

        <div className="mt-10">
          <div className="text-sm font-medium text-white/66">Quick actions</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <QuickAction label="New stair" onClick={onAddStair} />
            <QuickAction label="Import from PowerFab" muted />
          </div>
        </div>

        {recentFlights.length > 0 && (
          <div className="mt-10">
            <div className="text-sm font-medium text-white/66">Recent flights</div>
            <div className="mt-4 space-y-2">
              {recentFlights.map(({ stair, flight }) => (
                <button
                  key={flight.id}
                  type="button"
                  onClick={() => onSelectFlight(stair, flight)}
                  className="flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-left text-sm text-white/82 transition hover:border-white/8 hover:bg-white/[0.05] hover:text-white"
                >
                  <span className="text-white/42">◦</span>
                  <span>
                    {stair.name} / Flight {flight.order}
                    <span className="ml-2 text-white/45">
                      (edited {relativeEditedLabel(flight.updatedAt)})
                    </span>
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

function QuickAction({
  label,
  onClick,
  muted = false,
}: {
  label: string;
  onClick?: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cx(`flex items-center gap-3 px-4 py-3 text-left`, muted ? buttonClass.secondary : buttonClass.primary, muted && "justify-start text-white/55")}
    >
      <span className={muted ? "text-white/45" : "text-cyan-100"}>⊞</span>
      <span>{label}</span>
    </button>
  );
}

function relativeEditedLabel(iso: string): string {
  const minutes = Math.max(
    1,
    Math.round((Date.now() - Date.parse(iso)) / 60000),
  );
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

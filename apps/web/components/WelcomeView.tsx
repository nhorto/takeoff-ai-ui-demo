import type { FlightRecord, StairRecord } from "@/types/project";

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
        <div className="text-center text-sm text-white/58">
          Your stair assemblies
        </div>

        <div className="mt-10">
          <div className="text-sm text-white/52">Quick actions</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <QuickAction label="New stair" onClick={onAddStair} />
            <QuickAction label="Import from PowerFab" muted />
          </div>
        </div>

        {recentFlights.length > 0 && (
          <div className="mt-10">
            <div className="text-sm text-white/52">Recent flights</div>
            <div className="mt-4 space-y-2">
              {recentFlights.map(({ stair, flight }) => (
                <button
                  key={flight.id}
                  type="button"
                  onClick={() => onSelectFlight(stair, flight)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <span className="text-white/35">◦</span>
                  <span>
                    {stair.name} / Flight {flight.order}
                    <span className="ml-2 text-white/38">
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
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
        muted
          ? "border-white/10 bg-white/[0.03] text-white/48"
          : "border-white/10 bg-white/[0.03] text-white/76 hover:border-white/20 hover:bg-white/[0.06]"
      } disabled:cursor-default`}
    >
      <span>⊞</span>
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

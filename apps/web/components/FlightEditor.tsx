import type { EvaluateResult, Item, VariableValue } from "@shared/engine";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { GeometryTab } from "@/components/FlightTabs/GeometryTab";
import { StringersTab } from "@/components/FlightTabs/StringersTab";
import { TreadsTab } from "@/components/FlightTabs/TreadsTab";
import { LandingTab } from "@/components/FlightTabs/LandingTab";
import { RailTab } from "@/components/FlightTabs/RailTab";
import { MaterialsPanel } from "@/components/MaterialsPanel";
import type { FlightRecord, StairRecord } from "@/types/project";
import { buttonClass } from "@/components/ui/uiStyles";

export interface EvaluationSlot {
  source: string;
  result: EvaluateResult | null;
  error: string | null;
}

export function FlightEditor({
  stair,
  flight,
  items,
  errors,
  onStairValueChange,
  onDeleteFlight,
}: {
  stair: StairRecord;
  flight: FlightRecord;
  items: Item[];
  errors: { source: string; message: string }[];
  onStairValueChange: (key: string, value: VariableValue) => void;
  onDeleteFlight: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <div className="space-y-5 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-semibold text-white/96">
                {stair.name}
                <span className="ml-2 text-base font-normal text-white/62">
                  / Flight {flight.order}
                </span>
              </div>
              <div className="mt-2 text-sm text-white/64">
                {stair.inputMode === "averaged"
                  ? "Averaged mode"
                  : "Per-flight mode"}
                {stair.totalRisers
                  ? ` · ${stair.totalRisers} total risers`
                  : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={onDeleteFlight}
              className={`${buttonClass.destructive} shrink-0`}
            >
              Delete Flight
            </button>
          </div>

          <Tabs defaultValue="geometry" className="space-y-5">
            <TabsList>
              <TabsTrigger value="geometry">Geometry</TabsTrigger>
              <TabsTrigger value="stringers">Stringers</TabsTrigger>
              <TabsTrigger value="treads">Treads</TabsTrigger>
              <TabsTrigger value="landing">
                Landing
                {flight.landing ? (
                  <span className="ml-1.5 text-[10px] text-cyan-300/80">●</span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="rail">
                Rail
                {flight.rails.length > 0 ? (
                  <span className="ml-1.5 text-[10px] text-cyan-300/80">
                    {flight.rails.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="geometry">
              <GeometryTab
                values={flight.stairValues}
                onChange={onStairValueChange}
              />
            </TabsContent>
            <TabsContent value="stringers">
              <StringersTab
                values={flight.stairValues}
                onChange={onStairValueChange}
              />
            </TabsContent>
            <TabsContent value="treads">
              <TreadsTab
                values={flight.stairValues}
                onChange={onStairValueChange}
              />
            </TabsContent>
            <TabsContent value="landing">
              <LandingTab stairId={stair.id} flight={flight} />
            </TabsContent>
            <TabsContent value="rail">
              <RailTab stairId={stair.id} flight={flight} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <MaterialsPanel items={items} errors={errors} />
    </div>
  );
}

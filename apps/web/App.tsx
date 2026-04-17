import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddStairDialog } from "@/components/AddStairDialog";
import { AddRailDialog } from "@/components/AddRailDialog";
import { AddLadderDialog } from "@/components/AddLadderDialog";
import { AddLandingDialog } from "@/components/AddLandingDialog";
import {
  DockviewWorkbench,
  type DockviewWorkbenchHandle,
} from "@/components/dockview/DockviewWorkbench";
import { WorkbenchSidebar } from "@/components/sidebar/WorkbenchSidebar";
import type { PanelOpener } from "@/components/sidebar/types";
import { useWorkbenchStore, type AddStairConfig } from "@/hooks/useWorkbenchStore";
import { resetState } from "@/lib/storage";
import { pickPdfFile } from "@/lib/pdfFileManager";
import type { FlightRecord, RailType, StairRecord } from "@/types/project";

export default function App() {
  const dockviewRef = useRef<DockviewWorkbenchHandle>(null);
  const [addStairOpen, setAddStairOpen] = useState(false);
  const [addRailOpen, setAddRailOpen] = useState(false);
  const [addLadderOpen, setAddLadderOpen] = useState(false);
  const [addLandingOpen, setAddLandingOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");

  const project = useWorkbenchStore((s) => s.project);
  const aiPanelOpen = useWorkbenchStore((s) => s.ui.aiPanelOpen);
  const toggleAiPanel = useWorkbenchStore((s) => s.toggleAiPanel);
  const storeAddStair = useWorkbenchStore((s) => s.addStair);
  const addRailTemplate = useWorkbenchStore((s) => s.addRailTemplate);
  const addLadder = useWorkbenchStore((s) => s.addLadder);
  const addLandingTemplate = useWorkbenchStore((s) => s.addLandingTemplate);
  const reset = useWorkbenchStore((s) => s.reset);

  const totalFlights = project.stairs.reduce(
    (sum, s) => sum + s.flights.length,
    0,
  );

  const ensureFlightTab = useCallback(
    (stair: StairRecord, flight: FlightRecord) => {
      const title = `${stair.name} / Flight ${flight.order}`;
      dockviewRef.current?.openFlightTab(stair.id, flight.id, title);
    },
    [],
  );

  const handleAddStair = useCallback(
    (config: AddStairConfig) => {
      const { stair, firstFlight } = storeAddStair(config);
      ensureFlightTab(stair, firstFlight);
      setAddStairOpen(false);
    },
    [ensureFlightTab, storeAddStair],
  );

  function handleAddRail(config: { name: string; type: RailType }) {
    const template = addRailTemplate(config.name, config.type);
    dockviewRef.current?.openRailTemplateTab(template.id, template.name);
    setAddRailOpen(false);
  }

  function handleAddLadder(config: { name: string }) {
    const ladder = addLadder(config.name);
    dockviewRef.current?.openLadderTab(ladder.id, ladder.name);
    setAddLadderOpen(false);
  }

  function handleAddLanding(config: { name: string }) {
    const template = addLandingTemplate(config.name);
    dockviewRef.current?.openLandingTemplateTab(template.id, template.name);
    setAddLandingOpen(false);
  }

  async function handleOpenPdf() {
    const file = await pickPdfFile();
    if (!file) return;
    await dockviewRef.current?.openPdfFile(file);
  }

  function handleReset() {
    if (!window.confirm("Reset the workbench demo back to its starting state?"))
      return;
    reset();
    resetState();
    setAiInput("");
    window.location.reload();
  }

  const onAddStair = useCallback(() => setAddStairOpen(true), []);
  const onAddRail = useCallback(() => setAddRailOpen(true), []);
  const onAddLadder = useCallback(() => setAddLadderOpen(true), []);
  const onAddLanding = useCallback(() => setAddLandingOpen(true), []);

  const onOpenFlight = useCallback(
    (stairId: string, flightId: string) => {
      const stair = useWorkbenchStore
        .getState()
        .project.stairs.find((s) => s.id === stairId);
      const flight = stair?.flights.find((f) => f.id === flightId);
      if (stair && flight) ensureFlightTab(stair, flight);
    },
    [ensureFlightTab],
  );

  const panelOpener = useMemo<PanelOpener>(
    () => ({
      openFlight: ensureFlightTab,
      openRailTemplate: (templateId: string) => {
        const template = useWorkbenchStore
          .getState()
          .project.railTemplates.find((t) => t.id === templateId);
        if (template)
          dockviewRef.current?.openRailTemplateTab(template.id, template.name);
      },
      openLadder: (ladderId: string) => {
        const ladder = useWorkbenchStore
          .getState()
          .project.ladders.find((l) => l.id === ladderId);
        if (ladder) dockviewRef.current?.openLadderTab(ladder.id, ladder.name);
      },
      openLandingTemplate: (templateId: string) => {
        const template = useWorkbenchStore
          .getState()
          .project.landingTemplates.find((t) => t.id === templateId);
        if (template)
          dockviewRef.current?.openLandingTemplateTab(
            template.id,
            template.name,
          );
      },
    }),
    [ensureFlightTab],
  );

  const addActions = useMemo(
    () => ({
      onAddStair,
      onAddRail,
      onAddLadder,
      onAddLanding,
    }),
    [onAddStair, onAddRail, onAddLadder, onAddLanding],
  );

  // Push stair/flight changes into open dockview tabs: retitle on rename or
  // reorder, close tabs whose underlying flight was deleted.
  useEffect(() => {
    return useWorkbenchStore.subscribe(
      (state) => state.project.stairs,
      (stairs, prevStairs) => {
        const api = dockviewRef.current;
        if (!api) return;

        const currentFlightIds = new Set<string>();
        for (const s of stairs) for (const f of s.flights) currentFlightIds.add(f.id);

        const removedFlightIds: string[] = [];
        const prevByStair = new Map(prevStairs.map((s) => [s.id, s]));

        for (const prev of prevStairs) {
          for (const prevFlight of prev.flights) {
            if (!currentFlightIds.has(prevFlight.id)) {
              removedFlightIds.push(prevFlight.id);
            }
          }
        }
        if (removedFlightIds.length > 0) api.closeFlightTabs(removedFlightIds);

        for (const stair of stairs) {
          const prev = prevByStair.get(stair.id);
          for (const flight of stair.flights) {
            const prevFlight = prev?.flights.find((f) => f.id === flight.id);
            const nameChanged = prev && prev.name !== stair.name;
            const orderChanged = prevFlight && prevFlight.order !== flight.order;
            if (nameChanged || orderChanged) {
              api.updateFlightTabTitle(
                flight.id,
                `${stair.name} / Flight ${flight.order}`,
              );
            }
          }
        }
      },
    );
  }, []);

  return (
    <div className="flex min-h-screen flex-col px-4 py-4 text-white md:px-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col">
        <div className="flex flex-1 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,30,0.98),rgba(8,13,24,0.98))] shadow-glow">
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="font-semibold tracking-[0.16em] text-white">
                TakeoffAI
              </div>
              <div className="text-white/35">▸</div>
              <div className="text-white/72">{project.name}</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenPdf}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                Open PDF
              </button>
              <button
                type="button"
                onClick={toggleAiPanel}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                {aiPanelOpen ? "Hide AI" : "Show AI"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                Reset
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                ⚙
              </button>
            </div>
          </header>

          <div
            className={`grid min-h-0 flex-1 ${
              aiPanelOpen
                ? "xl:grid-cols-[280px_minmax(0,1fr)_260px]"
                : "xl:grid-cols-[280px_minmax(0,1fr)]"
            }`}
          >
            <WorkbenchSidebar addActions={addActions} panelOpener={panelOpener} />

            <section className="flex min-w-0 flex-col">
              <div className="min-h-0 flex-1">
                <DockviewWorkbench
                  ref={dockviewRef}
                  onAddStair={onAddStair}
                  onOpenFlight={onOpenFlight}
                />
              </div>

              <footer className="border-t border-white/10 bg-slate-950/55 px-5 py-2.5 text-xs text-white/48">
                {project.stairs.length} stairs · {totalFlights} flights
                <span className="float-right">saved ✓</span>
              </footer>
            </section>

            {aiPanelOpen && (
              <aside className="border-t border-white/10 bg-white/[0.02] xl:border-l xl:border-t-0">
                <div className="px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                    AI Assistant
                  </div>
                </div>
                <div className="flex h-full flex-col px-4 pb-4">
                  <div className="space-y-4 text-sm leading-6 text-white/66">
                    <p>Hi. Tell me what you want to add or change.</p>
                    <p>You can describe it in plain English.</p>
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-4 text-xs text-white/40">
                    Future: edit flights in plain English, explain
                    missing inputs, and assist without leaving the
                    workbench.
                  </div>

                  <div className="mt-auto pt-6">
                    <div className="rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white/70">
                      <input
                        type="text"
                        value={aiInput}
                        onChange={(event) => setAiInput(event.target.value)}
                        placeholder="Type here…"
                        className="w-full bg-transparent outline-none placeholder:text-white/28"
                      />
                    </div>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>

      {addStairOpen && (
        <AddStairDialog
          nextStairNumber={project.stairs.length + 1}
          onConfirm={handleAddStair}
          onCancel={() => setAddStairOpen(false)}
        />
      )}
      {addRailOpen && (
        <AddRailDialog
          nextIndex={project.railTemplates.length + 1}
          onConfirm={handleAddRail}
          onCancel={() => setAddRailOpen(false)}
        />
      )}
      {addLadderOpen && (
        <AddLadderDialog
          nextIndex={project.ladders.length + 1}
          onConfirm={handleAddLadder}
          onCancel={() => setAddLadderOpen(false)}
        />
      )}
      {addLandingOpen && (
        <AddLandingDialog
          nextIndex={project.landingTemplates.length + 1}
          onConfirm={handleAddLanding}
          onCancel={() => setAddLandingOpen(false)}
        />
      )}
    </div>
  );
}

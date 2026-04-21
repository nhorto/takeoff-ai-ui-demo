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
import type { OpenMode, PanelOpener } from "@/components/sidebar/types";
import { useWorkbenchStore, type AddStairConfig } from "@/hooks/useWorkbenchStore";
import { resetState } from "@/lib/storage";
import { pickPdfFile } from "@/lib/pdfFileManager";
import type { FlightRecord, RailType, StairRecord } from "@/types/project";

export default function App() {
  const dockviewRef = useRef<DockviewWorkbenchHandle>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 900,
  );
  const [userToggledSidebar, setUserToggledSidebar] = useState(false);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 899px)");
    const apply = () => {
      if (userToggledSidebar) return;
      setSidebarCollapsed(mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [userToggledSidebar]);

  const handleSidebarCollapsedChange = useCallback((next: boolean) => {
    setUserToggledSidebar(true);
    setSidebarCollapsed(next);
  }, []);

  const ensureFlightTab = useCallback(
    (stair: StairRecord, flight: FlightRecord, mode: OpenMode = "peek") => {
      const title = `${stair.name} / Flight ${flight.order}`;
      dockviewRef.current?.openFlightTab(stair.id, flight.id, title, mode);
    },
    [],
  );

  const ensureStairTab = useCallback(
    (stairId: string, mode: OpenMode = "peek") => {
      const stair = useWorkbenchStore
        .getState()
        .project.stairs.find((s) => s.id === stairId);
      if (!stair) return;
      dockviewRef.current?.openStairTab(stair.id, stair.name, mode);
    },
    [],
  );

  const handleAddStair = useCallback(
    (config: AddStairConfig) => {
      const { stair, firstFlight } = storeAddStair(config);
      // Freshly created entities open as permanent tabs — the user just
      // authored them and is about to edit, not browse.
      ensureFlightTab(stair, firstFlight, "newTab");
      setAddStairOpen(false);
    },
    [ensureFlightTab, storeAddStair],
  );

  function handleAddRail(config: { name: string; type: RailType }) {
    const template = addRailTemplate(config.name, config.type);
    dockviewRef.current?.openRailTemplateTab(
      template.id,
      template.name,
      "newTab",
    );
    setAddRailOpen(false);
  }

  function handleAddLadder(config: { name: string }) {
    const ladder = addLadder(config.name);
    dockviewRef.current?.openLadderTab(ladder.id, ladder.name, "newTab");
    setAddLadderOpen(false);
  }

  function handleAddLanding(config: { name: string }) {
    const template = addLandingTemplate(config.name);
    dockviewRef.current?.openLandingTemplateTab(
      template.id,
      template.name,
      "newTab",
    );
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
      openStair: ensureStairTab,
      openRailTemplate: (templateId: string, mode: OpenMode = "peek") => {
        const template = useWorkbenchStore
          .getState()
          .project.railTemplates.find((t) => t.id === templateId);
        if (template)
          dockviewRef.current?.openRailTemplateTab(
            template.id,
            template.name,
            mode,
          );
      },
      openLadder: (ladderId: string, mode: OpenMode = "peek") => {
        const ladder = useWorkbenchStore
          .getState()
          .project.ladders.find((l) => l.id === ladderId);
        if (ladder)
          dockviewRef.current?.openLadderTab(ladder.id, ladder.name, mode);
      },
      openLandingTemplate: (templateId: string, mode: OpenMode = "peek") => {
        const template = useWorkbenchStore
          .getState()
          .project.landingTemplates.find((t) => t.id === templateId);
        if (template)
          dockviewRef.current?.openLandingTemplateTab(
            template.id,
            template.name,
            mode,
          );
      },
    }),
    [ensureFlightTab, ensureStairTab],
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
  // reorder, close tabs whose underlying entity was deleted.
  useEffect(() => {
    return useWorkbenchStore.subscribe(
      (state) => state.project.stairs,
      (stairs, prevStairs) => {
        const api = dockviewRef.current;
        if (!api) return;

        const currentFlightIds = new Set<string>();
        const currentStairIds = new Set<string>();
        for (const s of stairs) {
          currentStairIds.add(s.id);
          for (const f of s.flights) currentFlightIds.add(f.id);
        }

        const removedFlightIds: string[] = [];
        const removedStairIds: string[] = [];
        const prevByStair = new Map(prevStairs.map((s) => [s.id, s]));

        for (const prev of prevStairs) {
          if (!currentStairIds.has(prev.id)) removedStairIds.push(prev.id);
          for (const prevFlight of prev.flights) {
            if (!currentFlightIds.has(prevFlight.id)) {
              removedFlightIds.push(prevFlight.id);
            }
          }
        }
        if (removedFlightIds.length > 0) api.closeFlightTabs(removedFlightIds);
        if (removedStairIds.length > 0) api.closeStairTabs(removedStairIds);

        for (const stair of stairs) {
          const prev = prevByStair.get(stair.id);
          const nameChanged = prev && prev.name !== stair.name;
          if (nameChanged) api.updateStairTabTitle(stair.id, stair.name);

          for (const flight of stair.flights) {
            const prevFlight = prev?.flights.find((f) => f.id === flight.id);
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

  // Keep rail/ladder/landing tab titles in sync with rename, and close tabs
  // for entities that were deleted from the project.
  useEffect(() => {
    const syncCollection = <T extends { id: string; name: string }>(
      component: "rail-template" | "ladder" | "landing-template",
      current: T[],
      previous: T[],
    ) => {
      const api = dockviewRef.current;
      if (!api) return;
      const currentIds = new Set(current.map((x) => x.id));
      const removed = previous.filter((x) => !currentIds.has(x.id)).map((x) => x.id);
      if (removed.length > 0) api.closeEntityTabs(component, removed);
      const prevById = new Map(previous.map((x) => [x.id, x]));
      for (const item of current) {
        const prev = prevById.get(item.id);
        if (prev && prev.name !== item.name) {
          api.updateEntityTabTitle(component, item.id, item.name);
        }
      }
    };
    const unsubRails = useWorkbenchStore.subscribe(
      (s) => s.project.railTemplates,
      (current, previous) => syncCollection("rail-template", current, previous),
    );
    const unsubLadders = useWorkbenchStore.subscribe(
      (s) => s.project.ladders,
      (current, previous) => syncCollection("ladder", current, previous),
    );
    const unsubLandings = useWorkbenchStore.subscribe(
      (s) => s.project.landingTemplates,
      (current, previous) =>
        syncCollection("landing-template", current, previous),
    );
    return () => {
      unsubRails();
      unsubLadders();
      unsubLandings();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col px-4 py-4 text-white md:px-6">
      <div className="flex w-full flex-1 flex-col">
        <div className="flex flex-1 flex-col overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#1e1e1e] shadow-glow">
          <header className="flex items-center justify-between border-b border-slate-300/10 px-5 py-4">
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
                Upload / Attach Drawing
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
                ? sidebarCollapsed
                  ? "md:grid-cols-[48px_minmax(0,1fr)_260px]"
                  : "md:grid-cols-[304px_minmax(0,1fr)_260px]"
                : sidebarCollapsed
                  ? "md:grid-cols-[48px_minmax(0,1fr)]"
                  : "md:grid-cols-[304px_minmax(0,1fr)]"
            }`}
          >
            <WorkbenchSidebar
              addActions={addActions}
              panelOpener={panelOpener}
              collapsed={sidebarCollapsed}
              onCollapsedChange={handleSidebarCollapsedChange}
            />

            <section className="flex min-w-0 flex-col">
              <div className="min-h-0 flex-1">
                <DockviewWorkbench
                  ref={dockviewRef}
                  onAddStair={onAddStair}
                  onOpenFlight={onOpenFlight}
                />
              </div>

              <footer className="border-t border-slate-300/10 bg-slate-950/55 px-5 py-2.5 text-xs text-white/48">
                {project.stairs.length} stairs · {totalFlights} flights
                <span className="float-right">saved ✓</span>
              </footer>
            </section>

            {aiPanelOpen && (
              <aside className="border-t border-slate-300/10 bg-white/[0.02] md:border-l md:border-l-slate-300/10 md:border-t-0">
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

                  <div className="mt-6 border-t border-slate-300/10 pt-4 text-xs text-white/40">
                    Future: edit flights in plain English, explain
                    missing inputs, and assist without leaving the
                    workbench.
                  </div>

                  <div className="mt-auto pt-6">
                    <div className="rounded-xl border border-slate-300/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white/70">
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

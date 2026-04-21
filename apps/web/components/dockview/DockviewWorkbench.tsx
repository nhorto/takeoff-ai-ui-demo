import {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import "@/styles/dockview-theme.css";
import { FlightPanel } from "@/components/dockview/FlightPanel";
import { PdfPanel } from "@/components/dockview/PdfPanel";
import { RailTemplatePanel } from "@/components/dockview/RailTemplatePanel";
import { LadderPanel } from "@/components/dockview/LadderPanel";
import { LandingTemplatePanel } from "@/components/dockview/LandingTemplatePanel";
import { StairPanel } from "@/components/dockview/StairPanel";
import {
  DockviewActionsContext,
  type DockviewActions,
} from "@/components/dockview/DockviewActionsContext";
import { WelcomeView } from "@/components/WelcomeView";
import { loadDockviewLayout, saveDockviewLayout } from "@/lib/storage";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import { usePdfStore } from "@/hooks/usePdfStore";

const components: Record<string, React.FC<IDockviewPanelProps<any>>> = {
  flight: FlightPanel,
  pdf: PdfPanel,
  "rail-template": RailTemplatePanel,
  ladder: LadderPanel,
  "landing-template": LandingTemplatePanel,
  stair: StairPanel,
};

export type OpenMode = "peek" | "newTab" | "toSide";

export interface DockviewWorkbenchHandle {
  openFlightTab: (
    stairId: string,
    flightId: string,
    title: string,
    mode?: OpenMode,
  ) => void;
  closeFlightTab: (flightId: string) => void;
  closeFlightTabs: (flightIds: string[]) => void;
  updateFlightTabTitle: (flightId: string, title: string) => void;
  openStairTab: (stairId: string, title: string, mode?: OpenMode) => void;
  closeStairTabs: (stairIds: string[]) => void;
  updateStairTabTitle: (stairId: string, title: string) => void;
  openPdfTab: (pdfId: string, title: string) => void;
  openPdfFile: (file: File) => Promise<void>;
  openRailTemplateTab: (
    templateId: string,
    title: string,
    mode?: OpenMode,
  ) => void;
  openLadderTab: (ladderId: string, title: string, mode?: OpenMode) => void;
  openLandingTemplateTab: (
    templateId: string,
    title: string,
    mode?: OpenMode,
  ) => void;
  updateEntityTabTitle: (
    component: "rail-template" | "ladder" | "landing-template",
    entityId: string,
    title: string,
  ) => void;
  closeEntityTabs: (
    component: "rail-template" | "ladder" | "landing-template",
    entityIds: string[],
  ) => void;
}

export const DockviewWorkbench = forwardRef<
  DockviewWorkbenchHandle,
  {
    onAddStair: () => void;
    onOpenFlight: (stairId: string, flightId: string) => void;
  }
>(function DockviewWorkbench({ onAddStair, onOpenFlight }, ref) {
  const apiRef = useRef<DockviewApi | null>(null);
  // peekPanelIdRef is the single "peek" tab shown from sidebar single-clicks.
  // A new peek click replaces the current peek; promotion (open-in-new-tab,
  // drag to another group) clears the ref so the tab sticks around.
  const peekPanelIdRef = useRef<string | null>(null);
  const [panelCount, setPanelCount] = useState(0);
  const stairs = useWorkbenchStore((s) => s.project.stairs);
  const setSelectedFlight = useWorkbenchStore((s) => s.setSelectedFlight);

  const openEntityPanel = useCallback(
    (
      component: string,
      entityId: string,
      title: string,
      params: Record<string, unknown>,
      mode: OpenMode,
    ) => {
      const api = apiRef.current;
      if (!api) return;

      const panelId = `${component}-${entityId}`;
      const existing = api.panels.find((p) => p.id === panelId);
      if (existing) {
        existing.api.setActive();
        existing.setTitle(title);
        existing.update({ params });
        // If this panel was the peek and the user explicitly reopens it in a
        // non-peek mode, promote it (clear the peek ref) so the next peek
        // click doesn't remove it.
        if (mode !== "peek" && peekPanelIdRef.current === panelId) {
          peekPanelIdRef.current = null;
        }
        return;
      }

      if (mode === "peek") {
        const prevPeekId = peekPanelIdRef.current;
        if (prevPeekId && prevPeekId !== panelId) {
          const prev = api.panels.find((p) => p.id === prevPeekId);
          if (prev) api.removePanel(prev);
        }
        api.addPanel({ id: panelId, component, title, params });
        peekPanelIdRef.current = panelId;
        return;
      }

      if (mode === "toSide") {
        const active = api.activePanel;
        api.addPanel({
          id: panelId,
          component,
          title,
          params,
          ...(active
            ? { position: { referencePanel: active.id, direction: "right" } }
            : {}),
        });
        return;
      }

      api.addPanel({ id: panelId, component, title, params });
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    openFlightTab(stairId, flightId, title, mode = "peek") {
      openEntityPanel(
        "flight",
        flightId,
        title,
        { stairId, flightId },
        mode,
      );
      setSelectedFlight(stairId, flightId);
    },

    closeFlightTab(flightId) {
      const api = apiRef.current;
      if (!api) return;
      const panelId = `flight-${flightId}`;
      const panel = api.panels.find((p) => p.id === panelId);
      if (panel) api.removePanel(panel);
      if (peekPanelIdRef.current === panelId) peekPanelIdRef.current = null;
    },

    closeFlightTabs(flightIds) {
      const api = apiRef.current;
      if (!api) return;
      for (const fId of flightIds) {
        const panelId = `flight-${fId}`;
        const panel = api.panels.find((p) => p.id === panelId);
        if (panel) api.removePanel(panel);
        if (peekPanelIdRef.current === panelId) peekPanelIdRef.current = null;
      }
    },

    updateFlightTabTitle(flightId, title) {
      const api = apiRef.current;
      if (!api) return;
      const panel = api.panels.find((p) => p.id === `flight-${flightId}`);
      if (panel) panel.setTitle(title);
    },

    openStairTab(stairId, title, mode = "peek") {
      openEntityPanel("stair", stairId, title, { stairId }, mode);
    },

    closeStairTabs(stairIds) {
      const api = apiRef.current;
      if (!api) return;
      for (const sId of stairIds) {
        const panelId = `stair-${sId}`;
        const panel = api.panels.find((p) => p.id === panelId);
        if (panel) api.removePanel(panel);
        if (peekPanelIdRef.current === panelId) peekPanelIdRef.current = null;
      }
    },

    updateStairTabTitle(stairId, title) {
      const api = apiRef.current;
      if (!api) return;
      const panel = api.panels.find((p) => p.id === `stair-${stairId}`);
      if (panel) panel.setTitle(title);
    },

    openPdfTab(pdfId, title) {
      const api = apiRef.current;
      if (!api) return;
      const panelId = `pdf-${pdfId}`;
      const existing = api.panels.find((p) => p.id === panelId);
      if (existing) {
        existing.api.setActive();
      } else {
        api.addPanel({
          id: panelId,
          component: "pdf",
          title,
          params: { pdfId },
        });
      }
    },

    async openPdfFile(file) {
      const api = apiRef.current;
      if (!api) return;
      const pdfId = await usePdfStore.getState().openPdf(file);
      const panelId = `pdf-${pdfId}`;
      api.addPanel({
        id: panelId,
        component: "pdf",
        title: file.name,
        params: { pdfId },
      });
    },

    openRailTemplateTab(templateId, title, mode = "peek") {
      openEntityPanel(
        "rail-template",
        templateId,
        title,
        { templateId },
        mode,
      );
    },

    openLadderTab(ladderId, title, mode = "peek") {
      openEntityPanel("ladder", ladderId, title, { ladderId }, mode);
    },

    openLandingTemplateTab(templateId, title, mode = "peek") {
      openEntityPanel(
        "landing-template",
        templateId,
        title,
        { templateId },
        mode,
      );
    },

    updateEntityTabTitle(component, entityId, title) {
      const api = apiRef.current;
      if (!api) return;
      const panel = api.panels.find((p) => p.id === `${component}-${entityId}`);
      if (panel) panel.setTitle(title);
    },

    closeEntityTabs(component, entityIds) {
      const api = apiRef.current;
      if (!api) return;
      for (const id of entityIds) {
        const panelId = `${component}-${id}`;
        const panel = api.panels.find((p) => p.id === panelId);
        if (panel) api.removePanel(panel);
        if (peekPanelIdRef.current === panelId) peekPanelIdRef.current = null;
      }
    },
  }));

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api;

      event.api.onDidLayoutChange(() => {
        setPanelCount(event.api.panels.length);
        saveDockviewLayout(event.api.toJSON());
      });

      event.api.onDidActivePanelChange((panel) => {
        if (!panel) return;
        const params = panel.params as Record<string, string> | undefined;
        if (params?.stairId && params?.flightId) {
          setSelectedFlight(params.stairId, params.flightId);
        }
      });

      // Drag-to-another-group promotes a peek tab to a permanent one.
      event.api.onDidMovePanel((e) => {
        if (peekPanelIdRef.current === e.panel.id) {
          peekPanelIdRef.current = null;
        }
      });

      event.api.onDidRemovePanel((panel) => {
        if (peekPanelIdRef.current === panel.id) {
          peekPanelIdRef.current = null;
        }
        const params = panel.params as Record<string, string> | undefined;
        if (!params?.pdfId || !panel.id.startsWith("pdf-")) return;
        // Only release PDFs we actually loaded — skips restore-time prunes
        // where the buffer was never in the store to begin with.
        if (usePdfStore.getState().openPdfs[params.pdfId]) {
          usePdfStore.getState().closePdf(params.pdfId);
        }
      });

      const saved = loadDockviewLayout();
      if (saved) {
        try {
          event.api.fromJSON(saved as any);
          // Drop PDF panels on restore — ArrayBuffer data isn't persisted
          for (const panel of [...event.api.panels]) {
            if (panel.id.startsWith("pdf-")) {
              event.api.removePanel(panel);
            } else if (panel.id === "welcome") {
              event.api.removePanel(panel);
            }
          }
          setPanelCount(event.api.panels.length);
          return;
        } catch {
          /* fall through to default */
        }
      }
      setPanelCount(event.api.panels.length);
    },
    [setSelectedFlight],
  );

  const dockviewActions = useMemo<DockviewActions>(
    () => ({
      openFlight: (stairId, flightId, mode = "peek") => {
        const stair = useWorkbenchStore
          .getState()
          .project.stairs.find((s) => s.id === stairId);
        const flight = stair?.flights.find((f) => f.id === flightId);
        if (!stair || !flight) return;
        const title = `${stair.name} / Flight ${flight.order}`;
        openEntityPanel(
          "flight",
          flightId,
          title,
          { stairId, flightId },
          mode,
        );
        setSelectedFlight(stairId, flightId);
      },
      openStair: (stairId, mode = "peek") => {
        const stair = useWorkbenchStore
          .getState()
          .project.stairs.find((s) => s.id === stairId);
        if (!stair) return;
        openEntityPanel("stair", stairId, stair.name, { stairId }, mode);
      },
    }),
    [openEntityPanel, setSelectedFlight],
  );

  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);

    const api = apiRef.current;
    if (!api) return;

    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );

    for (const file of files) {
      const pdfId = await usePdfStore.getState().openPdf(file);
      api.addPanel({
        id: `pdf-${pdfId}`,
        component: "pdf",
        title: file.name,
        params: { pdfId },
      });
    }
  }, []);

  return (
    <DockviewActionsContext.Provider value={dockviewActions}>
      <div
        className="relative h-full w-full"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <DockviewReact
          className="dockview-theme-takeoff"
          components={components}
          onReady={onReady}
        />
        {panelCount === 0 && (
          <div className="absolute inset-0 z-10 overflow-auto">
            <WelcomeView
              stairs={stairs}
              onAddStair={onAddStair}
              onSelectFlight={(stair, flight) =>
                onOpenFlight(stair.id, flight.id)
              }
            />
          </div>
        )}
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-cyan-300/5 backdrop-blur-[1px]">
            <div className="rounded-xl border-2 border-dashed border-cyan-300/50 bg-black/40 px-6 py-4 text-sm text-cyan-100">
              Drop PDF to open
            </div>
          </div>
        )}
      </div>
    </DockviewActionsContext.Provider>
  );
});

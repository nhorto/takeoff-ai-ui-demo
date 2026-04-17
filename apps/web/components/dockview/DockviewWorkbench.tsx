import {
  useCallback,
  useImperativeHandle,
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
import { WelcomePanel } from "@/components/dockview/WelcomePanel";
import { FlightPanel } from "@/components/dockview/FlightPanel";
import { PdfPanel } from "@/components/dockview/PdfPanel";
import { RailTemplatePanel } from "@/components/dockview/RailTemplatePanel";
import { LadderPanel } from "@/components/dockview/LadderPanel";
import { LandingTemplatePanel } from "@/components/dockview/LandingTemplatePanel";
import { loadDockviewLayout, saveDockviewLayout } from "@/lib/storage";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";
import { usePdfStore } from "@/hooks/usePdfStore";

const components: Record<string, React.FC<IDockviewPanelProps<any>>> = {
  welcome: WelcomePanel,
  flight: FlightPanel,
  pdf: PdfPanel,
  "rail-template": RailTemplatePanel,
  ladder: LadderPanel,
  "landing-template": LandingTemplatePanel,
};

export interface DockviewWorkbenchHandle {
  openFlightTab: (stairId: string, flightId: string, title: string) => void;
  closeFlightTab: (flightId: string) => void;
  closeFlightTabs: (flightIds: string[]) => void;
  updateFlightTabTitle: (flightId: string, title: string) => void;
  openPdfTab: (pdfId: string, title: string) => void;
  openPdfFile: (file: File) => Promise<void>;
  openRailTemplateTab: (templateId: string, title: string) => void;
  openLadderTab: (ladderId: string, title: string) => void;
  openLandingTemplateTab: (templateId: string, title: string) => void;
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

function openEntityTab(
  api: DockviewApi | null,
  component: string,
  id: string,
  title: string,
  params: Record<string, unknown>,
) {
  if (!api) return;
  const panelId = `${component}-${id}`;
  const existing = api.panels.find((p) => p.id === panelId);
  if (existing) {
    existing.api.setActive();
    existing.setTitle(title);
    existing.update({ params });
    return;
  }
  api.addPanel({ id: panelId, component, title, params });
}

function createDefaultLayout(api: DockviewApi, params: { onAddStair: () => void; onOpenFlight: (stairId: string, flightId: string) => void }) {
  api.addPanel({
    id: "welcome",
    component: "welcome",
    title: "Welcome",
    params,
  });
}

export const DockviewWorkbench = forwardRef<
  DockviewWorkbenchHandle,
  {
    onAddStair: () => void;
    onOpenFlight: (stairId: string, flightId: string) => void;
  }
>(function DockviewWorkbench({ onAddStair, onOpenFlight }, ref) {
  const apiRef = useRef<DockviewApi | null>(null);
  const setSelectedFlight = useWorkbenchStore((s) => s.setSelectedFlight);

  useImperativeHandle(ref, () => ({
    openFlightTab(stairId: string, flightId: string, title: string) {
      const api = apiRef.current;
      if (!api) return;

      const panelId = `flight-${flightId}`;
      const existing = api.panels.find((p) => p.id === panelId);
      if (existing) {
        existing.api.setActive();
        existing.setTitle(title);
        existing.update({ params: { stairId, flightId } });
      } else {
        api.addPanel({
          id: panelId,
          component: "flight",
          title,
          params: { stairId, flightId },
        });
      }
      setSelectedFlight(stairId, flightId);
    },

    closeFlightTab(flightId: string) {
      const api = apiRef.current;
      if (!api) return;
      const panel = api.panels.find((p) => p.id === `flight-${flightId}`);
      if (panel) api.removePanel(panel);
    },

    closeFlightTabs(flightIds: string[]) {
      const api = apiRef.current;
      if (!api) return;
      for (const fId of flightIds) {
        const panel = api.panels.find((p) => p.id === `flight-${fId}`);
        if (panel) api.removePanel(panel);
      }
    },

    updateFlightTabTitle(flightId: string, title: string) {
      const api = apiRef.current;
      if (!api) return;
      const panel = api.panels.find((p) => p.id === `flight-${flightId}`);
      if (panel) panel.setTitle(title);
    },

    openPdfTab(pdfId: string, title: string) {
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

    async openPdfFile(file: File) {
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

    openRailTemplateTab(templateId: string, title: string) {
      openEntityTab(apiRef.current, "rail-template", templateId, title, {
        templateId,
      });
    },

    openLadderTab(ladderId: string, title: string) {
      openEntityTab(apiRef.current, "ladder", ladderId, title, { ladderId });
    },

    openLandingTemplateTab(templateId: string, title: string) {
      openEntityTab(apiRef.current, "landing-template", templateId, title, {
        templateId,
      });
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
        const panel = api.panels.find((p) => p.id === `${component}-${id}`);
        if (panel) api.removePanel(panel);
      }
    },
  }));

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api;

      event.api.onDidLayoutChange(() => {
        saveDockviewLayout(event.api.toJSON());
      });

      event.api.onDidActivePanelChange((panel) => {
        if (!panel) return;
        const params = panel.params as Record<string, string> | undefined;
        if (params?.stairId && params?.flightId) {
          setSelectedFlight(params.stairId, params.flightId);
        }
      });

      event.api.onDidRemovePanel((panel) => {
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
              panel.update({ params: { onAddStair, onOpenFlight } });
            }
          }
          if (event.api.panels.length > 0) return;
        } catch {
          /* fall through to default */
        }
      }

      createDefaultLayout(event.api, { onAddStair, onOpenFlight });
    },
    [onAddStair, onOpenFlight, setSelectedFlight],
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
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-cyan-300/5 backdrop-blur-[1px]">
          <div className="rounded-xl border-2 border-dashed border-cyan-300/50 bg-slate-950/70 px-6 py-4 text-sm text-cyan-100">
            Drop PDF to open
          </div>
        </div>
      )}
    </div>
  );
});

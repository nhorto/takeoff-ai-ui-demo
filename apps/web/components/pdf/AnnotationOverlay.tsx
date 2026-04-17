import { useEffect, useRef } from "react";
import * as fabric from "fabric";
import {
  useAnnotationStore,
  type FabricSerialized,
} from "@/hooks/useAnnotationStore";
import {
  useAnnotationModeStore,
  type AnnotationColor,
  type AnnotationTool,
} from "@/hooks/useAnnotationModeStore";

interface PageMetrics {
  width: number;
  height: number;
}

export function AnnotationOverlay({
  pdfId,
  docKey,
  pageNumber,
  metrics,
  zoom,
}: {
  pdfId: string;
  docKey: string;
  pageNumber: number;
  metrics: PageMetrics;
  zoom: number;
}) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const modeRef = useRef<{ tool: AnnotationTool; color: AnnotationColor; enabled: boolean }>({
    tool: "pointer",
    color: "#ef4444",
    enabled: false,
  });
  const drawingRectRef = useRef<fabric.Rect | null>(null);
  const loadedRef = useRef(false);

  const tool = useAnnotationModeStore((s) => s.getMode(pdfId).tool);
  const color = useAnnotationModeStore((s) => s.getMode(pdfId).color);
  const enabled = useAnnotationModeStore((s) => s.getMode(pdfId).enabled);
  const setTool = useAnnotationModeStore((s) => s.setTool);

  // Keep latest mode visible to event handlers without re-binding them.
  useEffect(() => {
    modeRef.current = { tool, color, enabled };
    const canvas = fabricRef.current;
    if (!canvas) return;

    const selectable = enabled && tool === "pointer";
    canvas.selection = selectable;
    canvas.skipTargetFind = !enabled;
    canvas.defaultCursor = !enabled
      ? "default"
      : tool === "rect"
        ? "crosshair"
        : tool === "text"
          ? "text"
          : "default";
    canvas.hoverCursor = selectable ? "move" : canvas.defaultCursor;
    for (const obj of canvas.getObjects()) {
      obj.selectable = selectable;
      obj.evented = enabled;
    }

    // Fabric wraps the <canvas> in .canvas-container after mount — we have to
    // style the wrapper directly; styles on the original <canvas> don't reach
    // the hit-test layer (upper-canvas).
    const wrapper = canvas.wrapperEl as HTMLDivElement | undefined;
    if (wrapper) {
      wrapper.style.pointerEvents = enabled ? "auto" : "none";
    }

    canvas.requestRenderAll();
  }, [tool, color, enabled]);

  // Mount fabric canvas once per page.
  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    const canvas = new fabric.Canvas(el, {
      width: metrics.width,
      height: metrics.height,
      selection: false,
      preserveObjectStacking: true,
      fireRightClick: false,
      stopContextMenu: true,
    });
    fabricRef.current = canvas;

    // Position the fabric wrapper over the PDF canvas. Without this the wrapper
    // renders inline below the PDF and clicks never reach the annotation layer.
    const wrapper = canvas.wrapperEl as HTMLDivElement | undefined;
    if (wrapper) {
      wrapper.style.position = "absolute";
      wrapper.style.top = "0";
      wrapper.style.left = "0";
      wrapper.style.pointerEvents = modeRef.current.enabled ? "auto" : "none";
    }

    // Load persisted annotations for this page
    const stored = useAnnotationStore.getState().get(docKey, pageNumber);
    if (stored) {
      canvas.loadFromJSON(stored).then(() => {
        // Bail if we were disposed/replaced mid-load.
        if (fabricRef.current !== canvas) return;
        for (const obj of canvas.getObjects()) {
          obj.selectable = modeRef.current.enabled && modeRef.current.tool === "pointer";
          obj.evented = modeRef.current.enabled;
        }
        canvas.requestRenderAll();
        loadedRef.current = true;
      });
    } else {
      loadedRef.current = true;
    }

    canvas.on("mouse:down", (opt) => {
      const mode = modeRef.current;
      if (!mode.enabled) return;
      const scenePoint = canvas.getScenePoint(opt.e);

      if (mode.tool === "rect") {
        if (opt.target) return;
        const rect = new fabric.Rect({
          left: scenePoint.x,
          top: scenePoint.y,
          width: 1,
          height: 1,
          fill: `${mode.color}33`,
          stroke: mode.color,
          strokeWidth: 2,
          strokeUniform: true,
          selectable: false,
          evented: false,
        });
        canvas.add(rect);
        drawingRectRef.current = rect;
        canvas.selection = false;
      } else if (mode.tool === "text") {
        if (opt.target) return;
        const text = new fabric.IText("Text", {
          left: scenePoint.x,
          top: scenePoint.y,
          fontSize: 18,
          fill: mode.color,
          fontFamily: "Inter, system-ui, sans-serif",
          selectable: true,
          evented: true,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        setTool(pdfId, "pointer");
      }
    });

    canvas.on("mouse:move", (opt) => {
      const rect = drawingRectRef.current;
      if (!rect) return;
      const scenePoint = canvas.getScenePoint(opt.e);
      const originX = rect.left ?? 0;
      const originY = rect.top ?? 0;
      const w = scenePoint.x - originX;
      const h = scenePoint.y - originY;
      rect.set({
        width: Math.abs(w) || 1,
        height: Math.abs(h) || 1,
        left: w < 0 ? scenePoint.x : originX,
        top: h < 0 ? scenePoint.y : originY,
      });
      rect.setCoords();
      canvas.requestRenderAll();
    });

    canvas.on("mouse:up", () => {
      const rect = drawingRectRef.current;
      if (!rect) return;
      if ((rect.width ?? 0) < 4 || (rect.height ?? 0) < 4) {
        canvas.remove(rect);
      } else {
        rect.set({ selectable: true, evented: true });
        rect.setCoords();
      }
      drawingRectRef.current = null;
      canvas.requestRenderAll();
      // Keep rect tool active so estimators can drop many rects without re-clicking.
    });

    const persist = () => {
      if (!loadedRef.current) return;
      // Skip intermediate writes while a rect is being drag-sized.
      if (drawingRectRef.current) return;
      const json = canvas.toJSON() as FabricSerialized;
      if (canvas.getObjects().length === 0) {
        useAnnotationStore.getState().clear(docKey, pageNumber);
      } else {
        useAnnotationStore.getState().set(docKey, pageNumber, json);
      }
    };

    canvas.on("object:added", persist);
    canvas.on("object:modified", persist);
    canvas.on("object:removed", persist);

    return () => {
      drawingRectRef.current = null;
      fabricRef.current = null;
      canvas.dispose();
    };
  }, [docKey, pageNumber, metrics.width, metrics.height, pdfId, setTool]);

  // Sync fabric zoom to match PDF render zoom.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setZoom(zoom);
    canvas.setDimensions({
      width: metrics.width * zoom,
      height: metrics.height * zoom,
    });
    canvas.requestRenderAll();
  }, [zoom, metrics.width, metrics.height]);

  // Delete-key removes active annotation object when overlay is enabled.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const canvas = fabricRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active) return;
      if (active instanceof fabric.IText && active.isEditing) return;
      const selected = canvas.getActiveObjects();
      for (const obj of selected) canvas.remove(obj);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  return <canvas ref={canvasElRef} />;
}

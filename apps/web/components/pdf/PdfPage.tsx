import { useEffect, useRef, useState } from "react";
import type { RenderTask } from "pdfjs-dist";
import type { PDFDocumentProxy } from "@/lib/pdfjs";
import { AnnotationOverlay } from "@/components/pdf/AnnotationOverlay";

interface PageMetrics {
  width: number;
  height: number;
}

export function PdfPage({
  doc,
  pageNumber,
  zoom,
  onVisible,
  metrics,
  pdfId,
  docKey,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  onVisible: (pageNumber: number) => void;
  metrics: PageMetrics;
  pdfId: string;
  docKey: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            onVisible(pageNumber);
          }
        }
      },
      { rootMargin: "400px 0px", threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;

    (async () => {
      // Wait for any in-flight render on this canvas to finish canceling
      // before we resize/re-render — pdfjs throws on concurrent renders.
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        await renderTaskRef.current.promise.catch(() => {});
        renderTaskRef.current = null;
      }
      if (cancelled) return;

      const page = await doc.getPage(pageNumber);
      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: zoom * dpr });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const task = page.render({ canvasContext: ctx, viewport, canvas });
      renderTaskRef.current = task;

      try {
        await task.promise;
      } catch {
        /* cancelled */
      }
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [doc, pageNumber, zoom, isVisible]);

  const width = metrics.width * zoom;
  const height = metrics.height * zoom;

  return (
    <div
      ref={containerRef}
      data-page-number={pageNumber}
      className="relative mx-auto my-3 shadow-lg ring-1 ring-white/10"
      style={{ width, height, background: "white" }}
    >
      <canvas ref={canvasRef} className="block" />
      <AnnotationOverlay
        pdfId={pdfId}
        docKey={docKey}
        pageNumber={pageNumber}
        metrics={metrics}
        zoom={zoom}
      />
    </div>
  );
}

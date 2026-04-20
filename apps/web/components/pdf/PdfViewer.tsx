import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "@/lib/pdfjs";
import { usePdfStore } from "@/hooks/usePdfStore";
import { makeDocKey } from "@/hooks/useAnnotationStore";
import { useAnnotationModeStore } from "@/hooks/useAnnotationModeStore";
import { PdfPage } from "@/components/pdf/PdfPage";
import { PdfToolbar } from "@/components/pdf/PdfToolbar";
import { AnnotationToolbar } from "@/components/pdf/AnnotationToolbar";

interface PageMetrics {
  width: number;
  height: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

function AnnotationToolbarSection({ pdfId }: { pdfId: string }) {
  const enabled = useAnnotationModeStore((s) => s.getMode(pdfId).enabled);
  if (!enabled) return null;
  return <AnnotationToolbar pdfId={pdfId} />;
}

export function PdfViewer({ pdfId }: { pdfId: string }) {
  const pdf = usePdfStore((s) => s.openPdfs[pdfId]);
  const setCurrentPage = usePdfStore((s) => s.setCurrentPage);
  const setZoom = usePdfStore((s) => s.setZoom);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageMetrics, setPageMetrics] = useState<Record<number, PageMetrics>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pdf) return;

    let cancelled = false;
    let loadedDoc: PDFDocumentProxy | null = null;

    (async () => {
      try {
        setLoadError(null);
        setDoc(null);
        setPageMetrics({});

        const { pdfjs } = await import("@/lib/pdfjs");
        // pdfjs mutates the buffer — clone so the store copy stays intact
        const buffer = pdf.data.slice(0);
        const task = pdfjs.getDocument({ data: buffer });
        loadedDoc = await task.promise;
        if (cancelled) {
          loadedDoc.destroy();
          return;
        }

        // Seed with page 1 only so fit-width and first paint work without
        // walking the entire document up front.
        const firstPage = await loadedDoc.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1 });
        if (cancelled) return;

        setDoc(loadedDoc);
        setPageMetrics({
          1: { width: firstViewport.width, height: firstViewport.height },
        });
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load PDF");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (loadedDoc) loadedDoc.destroy();
    };
  }, [pdf?.id, pdf?.data]);

  const handlePageVisible = useCallback(
    (pageNumber: number) => {
      const current = usePdfStore.getState().openPdfs[pdfId];
      if (current && current.currentPage !== pageNumber) {
        setCurrentPage(pdfId, pageNumber);
      }
    },
    [pdfId, setCurrentPage],
  );

  const applyZoom = useCallback(
    (next: number) => {
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
      setZoom(pdfId, clamped);
    },
    [pdfId, setZoom],
  );

  const handlePageMetrics = useCallback((pageNumber: number, metrics: PageMetrics) => {
    setPageMetrics((current) => {
      const existing = current[pageNumber];
      if (
        existing &&
        existing.width === metrics.width &&
        existing.height === metrics.height
      ) {
        return current;
      }
      return { ...current, [pageNumber]: metrics };
    });
  }, []);

  const handleFitWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstWidth = pageMetrics[1]?.width;
    if (!firstWidth) return;
    const available = el.clientWidth - 32; // account for padding
    applyZoom(available / firstWidth);
  }, [pageMetrics, applyZoom]);

  // Ctrl/Cmd + wheel to zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pdf) return;

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      applyZoom(pdf.zoom * (1 + delta));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pdf?.zoom, applyZoom]);

  const pageNumbers = useMemo(
    () => (doc ? Array.from({ length: doc.numPages }, (_, i) => i + 1) : []),
    [doc],
  );

  const docKey = useMemo(
    () => (pdf ? makeDocKey(pdf.fileName, pdf.fileSize) : ""),
    [pdf?.fileName, pdf?.fileSize],
  );

  if (!pdf) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/45">
        PDF not found
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-900/40">
      <PdfToolbar
        pdfId={pdfId}
        fileName={pdf.fileName}
        currentPage={pdf.currentPage}
        pageCount={doc?.numPages ?? 0}
        zoom={pdf.zoom}
        onZoomIn={() => applyZoom(pdf.zoom * 1.2)}
        onZoomOut={() => applyZoom(pdf.zoom / 1.2)}
        onFitWidth={handleFitWidth}
      />
      <AnnotationToolbarSection pdfId={pdfId} />

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-4 py-3"
        style={{ overscrollBehavior: "contain" }}
      >
        {loadError ? (
          <div className="flex h-full items-center justify-center text-sm text-red-300">
            {loadError}
          </div>
        ) : !doc ? (
          <div className="flex h-full items-center justify-center text-sm text-white/45">
            Loading PDF…
          </div>
        ) : (
          pageNumbers.map((pageNumber) => (
            <PdfPage
              key={pageNumber}
              doc={doc}
              pageNumber={pageNumber}
              zoom={pdf.zoom}
              metrics={pageMetrics[pageNumber] ?? pageMetrics[1] ?? DEFAULT_PAGE_METRICS}
              onMetrics={handlePageMetrics}
              onVisible={handlePageVisible}
              pdfId={pdfId}
              docKey={docKey}
            />
          ))
        )}
      </div>
    </div>
  );
}

const DEFAULT_PAGE_METRICS: PageMetrics = {
  width: 612,
  height: 792,
};

import { useAnnotationModeStore } from "@/hooks/useAnnotationModeStore";

export function PdfToolbar({
  pdfId,
  fileName,
  currentPage,
  pageCount,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitWidth,
}: {
  pdfId: string;
  fileName: string;
  currentPage: number;
  pageCount: number;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
}) {
  const enabled = useAnnotationModeStore((s) => s.getMode(pdfId).enabled);
  const setEnabled = useAnnotationModeStore((s) => s.setEnabled);

  return (
    <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-white/70">
      <div className="truncate font-medium text-white/85" title={fileName}>
        {fileName}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEnabled(pdfId, !enabled)}
          className={`rounded-md border px-2 py-1 transition ${
            enabled
              ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
              : "border-white/10 hover:border-white/25 hover:bg-white/[0.06]"
          }`}
          title="Toggle annotation mode"
        >
          Annotate
        </button>
        <div className="mx-1 h-4 w-px bg-white/15" />
        <span className="tabular-nums text-white/55">
          Page {currentPage} / {pageCount || "?"}
        </span>
        <div className="mx-1 h-4 w-px bg-white/15" />
        <button
          type="button"
          onClick={onZoomOut}
          className="rounded-md border border-white/10 px-2 py-1 transition hover:border-white/25 hover:bg-white/[0.06]"
          title="Zoom out"
        >
          −
        </button>
        <span className="min-w-[3.5rem] text-center tabular-nums text-white/60">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={onZoomIn}
          className="rounded-md border border-white/10 px-2 py-1 transition hover:border-white/25 hover:bg-white/[0.06]"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={onFitWidth}
          className="ml-1 rounded-md border border-white/10 px-2 py-1 text-[11px] uppercase tracking-wider transition hover:border-white/25 hover:bg-white/[0.06]"
          title="Fit width"
        >
          Fit
        </button>
      </div>
    </div>
  );
}

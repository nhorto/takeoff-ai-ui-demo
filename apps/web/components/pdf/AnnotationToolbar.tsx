import {
  useAnnotationModeStore,
  ANNOTATION_COLORS,
  type AnnotationColor,
  type AnnotationTool,
} from "@/hooks/useAnnotationModeStore";

const TOOLS: { id: AnnotationTool; label: string; title: string }[] = [
  { id: "pointer", label: "Select", title: "Select / move" },
  { id: "rect", label: "Rect", title: "Draw rectangle" },
  { id: "text", label: "Text", title: "Add text" },
];

export function AnnotationToolbar({ pdfId }: { pdfId: string }) {
  const mode = useAnnotationModeStore((s) => s.getMode(pdfId));
  const setTool = useAnnotationModeStore((s) => s.setTool);
  const setColor = useAnnotationModeStore((s) => s.setColor);

  return (
    <div className="flex items-center gap-3 border-b border-white/10 bg-slate-950/40 px-3 py-1.5 text-xs text-white/70">
      <div className="flex items-center gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(pdfId, t.id)}
            title={t.title}
            className={`rounded-md border px-2 py-1 transition ${
              mode.tool === t.id
                ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
                : "border-white/10 hover:border-white/25 hover:bg-white/[0.06]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mx-1 h-4 w-px bg-white/15" />

      <div className="flex items-center gap-1">
        {ANNOTATION_COLORS.map((c: AnnotationColor) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(pdfId, c)}
            title={c}
            aria-label={`Color ${c}`}
            className={`h-5 w-5 rounded-full border transition ${
              mode.color === c ? "border-white ring-2 ring-white/25" : "border-white/25"
            }`}
            style={{ background: c }}
          />
        ))}
      </div>

      <div className="ml-auto text-[11px] uppercase tracking-[0.18em] text-white/40">
        Delete key removes selection
      </div>
    </div>
  );
}

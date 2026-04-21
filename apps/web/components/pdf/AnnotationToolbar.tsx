import {
  useAnnotationModeStore,
  ANNOTATION_COLORS,
  type AnnotationColor,
  type AnnotationTool,
} from "@/hooks/useAnnotationModeStore";
import { buttonClass, cx } from "@/components/ui/uiStyles";

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
    <div className="flex items-center gap-3 border-b border-white/[0.05] bg-[#2d2d30] px-3 py-1.5 text-xs text-white/70">
      <div className="flex items-center gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(pdfId, t.id)}
            title={t.title}
            className={cx(
              "px-2 py-1 text-xs",
              mode.tool === t.id
                ? buttonClass.primary
                : buttonClass.secondary,
            )}
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
              mode.color === c ? "border-white ring-2 ring-white/25" : "border-white/30 hover:border-white/60"
            }`}
            style={{ background: c }}
          />
        ))}
      </div>

      <div className="ml-auto text-[11px] uppercase tracking-[0.16em] text-white/48">
        Delete key removes selection
      </div>
    </div>
  );
}

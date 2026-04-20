import { Suspense, lazy } from "react";
import type { IDockviewPanelProps } from "dockview-react";

const LazyPdfViewer = lazy(async () => {
  const mod = await import("@/components/pdf/PdfViewer");
  return { default: mod.PdfViewer };
});

export function PdfPanel({
  params,
}: IDockviewPanelProps<{ pdfId: string }>) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-white/58">
          Loading PDF viewer…
        </div>
      }
    >
      <LazyPdfViewer pdfId={params.pdfId} />
    </Suspense>
  );
}

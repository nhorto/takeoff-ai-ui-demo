import type { IDockviewPanelProps } from "dockview-react";
import { PdfViewer } from "@/components/pdf/PdfViewer";

export function PdfPanel({
  params,
}: IDockviewPanelProps<{ pdfId: string }>) {
  return <PdfViewer pdfId={params.pdfId} />;
}

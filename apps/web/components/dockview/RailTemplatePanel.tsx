import type { IDockviewPanelProps } from "dockview-react";
import { RailTemplateEditor } from "@/components/RailTemplateEditor";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";

export function RailTemplatePanel({
  params,
}: IDockviewPanelProps<{ templateId: string }>) {
  const template = useWorkbenchStore((s) =>
    s.project.railTemplates.find((t) => t.id === params.templateId),
  );

  if (!template) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/42">
        Rail template not found. It may have been deleted.
      </div>
    );
  }

  return <RailTemplateEditor template={template} />;
}

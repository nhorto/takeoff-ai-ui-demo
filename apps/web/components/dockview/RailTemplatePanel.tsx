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
      <div className="flex h-full items-center justify-center p-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/58">
          Rail template not found. It may have been deleted.
        </div>
      </div>
    );
  }

  return <RailTemplateEditor template={template} />;
}

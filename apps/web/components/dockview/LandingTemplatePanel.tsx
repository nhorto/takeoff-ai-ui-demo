import type { IDockviewPanelProps } from "dockview-react";
import { LandingTemplateEditor } from "@/components/LandingTemplateEditor";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";

export function LandingTemplatePanel({
  params,
}: IDockviewPanelProps<{ templateId: string }>) {
  const template = useWorkbenchStore((s) =>
    s.project.landingTemplates.find((t) => t.id === params.templateId),
  );

  if (!template) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/42">
        Landing template not found. It may have been deleted.
      </div>
    );
  }

  return <LandingTemplateEditor template={template} />;
}

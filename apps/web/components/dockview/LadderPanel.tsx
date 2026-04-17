import type { IDockviewPanelProps } from "dockview-react";
import { LadderEditor } from "@/components/LadderEditor";
import { useWorkbenchStore } from "@/hooks/useWorkbenchStore";

export function LadderPanel({
  params,
}: IDockviewPanelProps<{ ladderId: string }>) {
  const ladder = useWorkbenchStore((s) =>
    s.project.ladders.find((l) => l.id === params.ladderId),
  );

  if (!ladder) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/42">
        Ladder not found. It may have been deleted.
      </div>
    );
  }

  return <LadderEditor ladder={ladder} />;
}

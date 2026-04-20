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
      <div className="flex h-full items-center justify-center p-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/58">
          Ladder not found. It may have been deleted.
        </div>
      </div>
    );
  }

  return <LadderEditor ladder={ladder} />;
}

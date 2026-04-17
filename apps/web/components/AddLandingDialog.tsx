import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/Dialog";

export function AddLandingDialog({
  nextIndex,
  onConfirm,
  onCancel,
}: {
  nextIndex: number;
  onConfirm: (config: { name: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(`Landing ${nextIndex}`);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogTitle>Add Landing Template</DialogTitle>
        <DialogDescription>
          Reusable landing configuration. Assign to a flight for an editable copy.
        </DialogDescription>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-white/65">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ name: name.trim() || `Landing ${nextIndex}` })}
            className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-4 py-2.5 text-sm text-cyan-100 transition hover:bg-cyan-300/20"
          >
            Create Landing
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

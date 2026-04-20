import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/Dialog";
import { buttonClass, cx, fieldInputSurfaceClass } from "@/components/ui/uiStyles";

export function AddLadderDialog({
  nextIndex,
  onConfirm,
  onCancel,
}: {
  nextIndex: number;
  onConfirm: (config: { name: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(`Ladder ${nextIndex}`);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogTitle>Add Ladder</DialogTitle>
        <DialogDescription>
          Ladders are standalone entities — not attached to any stair.
        </DialogDescription>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-white/65">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cx(fieldInputSurfaceClass, "mt-1")}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={buttonClass.secondary}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ name: name.trim() || `Ladder ${nextIndex}` })}
            className={buttonClass.primary}
          >
            Create Ladder
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

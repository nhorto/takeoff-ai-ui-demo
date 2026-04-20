import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { RailType } from "@/types/project";
import { buttonClass, cx, fieldInputSurfaceClass } from "@/components/ui/uiStyles";

const TYPE_OPTIONS: { value: RailType; label: string }[] = [
  { value: "picket", label: "Picket rail" },
  { value: "multi-line", label: "Multi-line rail" },
  { value: "cable", label: "Cable rail" },
  { value: "wall", label: "Wall rail" },
  { value: "assist", label: "Assist rail" },
];

export function AddRailDialog({
  nextIndex,
  onConfirm,
  onCancel,
}: {
  nextIndex: number;
  onConfirm: (config: { name: string; type: RailType }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(`Rail ${nextIndex}`);
  const [type, setType] = useState<RailType>("picket");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogTitle>Add Rail Template</DialogTitle>
        <DialogDescription>
          A rail template is a reusable rail configuration. Assign it to a
          flight to get an editable copy.
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
          <div>
            <label className="block text-sm text-white/65">Type</label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as RailType)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            onClick={() =>
              onConfirm({
                name: name.trim() || `Rail ${nextIndex}`,
                type,
              })
            }
            className={buttonClass.primary}
          >
            Create Rail
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

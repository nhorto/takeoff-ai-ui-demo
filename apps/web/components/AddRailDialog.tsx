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
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
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
            className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
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
            className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-4 py-2.5 text-sm text-cyan-100 transition hover:bg-cyan-300/20"
          >
            Create Rail
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import type { Item } from "@shared/engine";
import { ItemsTable } from "@/components/ItemsTable";

export function MaterialsPanel({
  items,
  errors = [],
  defaultOpen = false,
}: {
  items: Item[];
  errors?: { source: string; message: string }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-white/10 bg-slate-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left text-xs uppercase tracking-[0.18em] text-white/55 transition hover:bg-white/[0.03]"
      >
        <span>
          Materials
          <span className="ml-2 text-white/35">{items.length} items</span>
        </span>
        <span className="text-white/45">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="space-y-3 px-5 pb-5">
          {errors.map((e) => (
            <div
              key={e.source}
              className="rounded-xl border border-red-400/18 bg-red-400/10 p-3 text-sm text-red-100"
            >
              {e.source}: {e.message}
            </div>
          ))}
          {items.length > 0 ? (
            <ItemsTable items={items} />
          ) : errors.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
              No items yet — fill in the required fields above.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

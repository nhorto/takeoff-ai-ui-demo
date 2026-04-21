import { useState } from "react";
import type { Item } from "@shared/engine";
import { ItemsTable } from "@/components/ItemsTable";
import { cx } from "@/components/ui/uiStyles";

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
    <div className="border-t border-white/[0.06] bg-[#1c1c1c]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <span className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
            Materials
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/52">
            {items.length} items
          </span>
          {errors.length > 0 ? (
            <span className="rounded-full border border-red-400/20 bg-red-500/[0.08] px-2 py-0.5 text-[11px] text-red-200/85">
              {errors.length} issue{errors.length === 1 ? "" : "s"}
            </span>
          ) : null}
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
              <span className="font-medium">{e.source}</span>
              <span className="text-red-100/78">: {e.message}</span>
            </div>
          ))}
          {items.length > 0 ? (
            <ItemsTable items={items} />
          ) : errors.length === 0 ? (
            <div className={cx(
              "rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/52",
            )}>
              No items yet — fill in the required fields above.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

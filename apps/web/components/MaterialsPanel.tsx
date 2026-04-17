import { useState } from "react";
import type { Item } from "@shared/engine";
import { ItemsTable } from "@/components/ItemsTable";

const PREVIEW_ROWS = 5;

export function MaterialsPanel({
  items,
  errors = [],
}: {
  items: Item[];
  errors?: { source: string; message: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > PREVIEW_ROWS;
  const visibleItems = expanded || !hasMore ? items : items.slice(0, PREVIEW_ROWS);

  return (
    <div className="border-t border-white/10 bg-slate-950/40">
      <div className="flex items-center justify-between px-5 py-3 text-xs uppercase tracking-[0.18em] text-white/55">
        <span>
          Materials
          <span className="ml-2 text-white/35">{items.length} items</span>
        </span>
      </div>

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
          <>
            <ItemsTable items={visibleItems} />
            {hasMore && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/55 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white/80"
              >
                {expanded
                  ? `Show first ${PREVIEW_ROWS}`
                  : `Show all ${items.length} items`}
              </button>
            )}
          </>
        ) : errors.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/45">
            No items yet — fill in the required fields above.
          </div>
        ) : null}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import type { Item } from "@shared/engine";
import { formatFeetInches } from "@shared/engine";

interface ItemsTableProps {
  items: Item[];
}

export function ItemsTable({ items }: ItemsTableProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,17,31,0.72),rgba(7,17,31,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-sm text-white/80">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.22em] text-white/45">
            <tr>
              <HeaderCell>Shape</HeaderCell>
              <HeaderCell>Size</HeaderCell>
              <HeaderCell>Qty</HeaderCell>
              <HeaderCell>Length</HeaderCell>
              <HeaderCell>Width</HeaderCell>
              <HeaderCell>Grade</HeaderCell>
              <HeaderCell>Labor</HeaderCell>
              <HeaderCell>Comment</HeaderCell>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {items.map((item, index) => (
              <tr key={`${item.shape}-${index}`} className="odd:bg-white/[0.015] hover:bg-cyan-300/[0.06]">
                <BodyCell>
                  <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                    {item.shape}
                  </span>
                </BodyCell>
                <BodyCell>{item.size ?? "—"}</BodyCell>
                <BodyCell>{item.quantity}</BodyCell>
                <BodyCell>{item.length !== undefined ? formatFeetInches(item.length) : "—"}</BodyCell>
                <BodyCell>{item.width !== undefined ? formatFeetInches(item.width) : "—"}</BodyCell>
                <BodyCell>{item.grade}</BodyCell>
                <BodyCell>{item.laborCode ?? "—"}</BodyCell>
                <BodyCell>{item.comment ?? item.description ?? "—"}</BodyCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return <th className="px-4 py-4 font-medium">{children}</th>;
}

function BodyCell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-4 align-top">{children}</td>;
}

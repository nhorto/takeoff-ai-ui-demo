import type { ReactNode } from "react";
import type { Item } from "@shared/engine";
import { formatFeetInches } from "@shared/engine";

interface ItemsTableProps {
  items: Item[];
}

export function ItemsTable({ items }: ItemsTableProps) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#1f1f1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="max-h-[320px] overflow-auto">
        <table className="min-w-full divide-y divide-white/[0.06] text-sm text-white/82">
          <thead className="sticky top-0 z-10 bg-[#252526] text-left text-[11px] uppercase tracking-[0.16em] text-white/50 backdrop-blur">
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
              <tr
                key={`${item.shape}-${index}`}
                className="odd:bg-white/[0.015] hover:bg-cyan-300/[0.05]"
              >
                <BodyCell>
                  <span className="inline-flex min-w-[3rem] justify-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/78">
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
  return <th className="px-4 py-3.5 font-medium">{children}</th>;
}

function BodyCell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3.5 align-top">{children}</td>;
}

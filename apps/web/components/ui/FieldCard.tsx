import type { ReactNode } from "react";

export function FieldCard({
  label,
  description,
  badge,
  children,
}: {
  label: string;
  description?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="relative block overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-white/14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white/96">{label}</div>
          {description && (
            <p className="mt-1.5 text-sm leading-6 text-white/62">{description}</p>
          )}
        </div>
        {badge && (
          <span className="rounded-full border border-white/12 bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/58">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </label>
  );
}

export const fieldInputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] outline-none transition placeholder:text-white/32 hover:border-white/18 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20";

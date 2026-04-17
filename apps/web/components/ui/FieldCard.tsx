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
    <label className="relative block overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          {description && (
            <p className="mt-2 text-sm leading-6 text-white/55">{description}</p>
          )}
        </div>
        {badge && (
          <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </label>
  );
}

export const fieldInputClass =
  "w-full rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-cyan-300/35 bg-cyan-300/12 px-3 py-2 text-sm font-medium text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-cyan-300/55 hover:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/30 disabled:pointer-events-none disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/20 disabled:pointer-events-none disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/72 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/20 disabled:pointer-events-none disabled:opacity-50",
  destructive:
    "inline-flex items-center justify-center gap-2 rounded-md border border-red-400/28 bg-red-500/[0.08] px-3 py-2 text-sm font-medium text-red-100/90 transition hover:border-red-400/45 hover:bg-red-500/[0.14] hover:text-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/25 disabled:pointer-events-none disabled:opacity-50",
  icon:
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-white/38 transition hover:border-white/10 hover:bg-white/[0.06] hover:text-white/82 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/20 disabled:pointer-events-none disabled:opacity-50",
  sidebarAdd:
    "inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-white/82 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/20 disabled:pointer-events-none disabled:opacity-50",
};

export const panelEyebrowClass =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50";

export const editableTitleClass =
  "mt-1 w-full rounded-md border border-transparent bg-white/[0.03] px-3 py-2 text-xl font-semibold text-white outline-none transition hover:border-white/10 hover:bg-white/[0.05] focus:border-cyan-300/45 focus:bg-slate-950/70 focus:ring-2 focus:ring-cyan-300/18";

export const fieldInputSurfaceClass =
  "w-full rounded-xl border border-white/12 bg-slate-950/78 px-4 py-3 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition placeholder:text-white/32 hover:border-white/18 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20";

export function SectionSearch({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="px-4 pt-3 pb-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
      />
    </div>
  );
}

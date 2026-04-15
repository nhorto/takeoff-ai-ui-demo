import { starterLibrary } from "@shared/pa-library";
import type { AssemblyRecord, Group } from "@/types/project";

interface GroupSidebarProps {
  groups: Group[];
  assemblies: AssemblyRecord[];
  selectedGroupId: string | null;
  selectedAssemblyId: string | null;
  onSelectGroup: (groupId: string) => void;
  onSelectAssembly: (assemblyId: string) => void;
  onCreateGroup: () => void;
}

export function GroupSidebar({
  groups,
  assemblies,
  selectedGroupId,
  selectedAssemblyId,
  onSelectGroup,
  onSelectAssembly,
  onCreateGroup,
}: GroupSidebarProps) {
  return (
    <aside className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-signal-cyan/90">
            Grouped Wizard
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">Project structure</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Groups are explicit on purpose. They let you validate whether estimators
            prefer organizing by tower, zone, or package before we build the full tree.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateGroup}
          className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300/15"
        >
          New group
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {groups.map((group) => {
          const groupAssemblies = assemblies.filter((assembly) => assembly.groupId === group.id);

          return (
            <section
              key={group.id}
              className={`rounded-2xl border p-4 ${
                selectedGroupId === group.id
                  ? "border-signal-gold/40 bg-amber-300/10"
                  : "border-white/10 bg-slate-950/30"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectGroup(group.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white">{group.name}</div>
                    <p className="mt-1 text-sm leading-6 text-white/55">{group.note}</p>
                  </div>
                  <div className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/70">
                    {groupAssemblies.length} assemblies
                  </div>
                </div>
              </button>

              <div className="mt-4 space-y-2">
                {groupAssemblies.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/45">
                    No assemblies in this group yet.
                  </div>
                ) : (
                  groupAssemblies.map((assembly) => {
                    const template = starterLibrary.find(
                      (entry) => entry.id === assembly.templateId,
                    );

                    return (
                    <button
                      key={assembly.id}
                      type="button"
                      onClick={() => onSelectAssembly(assembly.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition ${
                        selectedAssemblyId === assembly.id
                          ? "bg-white text-slate-950"
                          : "bg-white/5 text-white hover:bg-white/10"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium">{assembly.name}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.2em] opacity-70">
                          {template?.name ?? assembly.templateId}
                        </div>
                      </div>
                      <span className="rounded-full bg-black/15 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                        Ready
                      </span>
                    </button>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}

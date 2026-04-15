import { useEffect, useMemo, useState } from "react";
import {
  evaluatePA,
  formatFeetInches,
  type EvaluateResult,
  type PATemplate,
  type VariableValue,
} from "@shared/engine";
import { exportItemsToCsv } from "@shared/exporters";
import { starterLibrary } from "@shared/pa-library";
import { ItemsTable } from "@/components/ItemsTable";
import { WizardForm } from "@/components/WizardForm";
import { downloadTextFile } from "@/lib/download";
import { loadState, makeId, resetState, saveState } from "@/lib/storage";
import type {
  AssemblyRecord,
  Group,
  OpenTab,
  PersistedState,
  ProjectState,
  WorkspaceMode,
} from "@/types/project";

export default function App() {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [groupForm, setGroupForm] = useState({ name: "", note: "" });
  const [assemblyForm, setAssemblyForm] = useState({
    templateId: starterLibrary[0]?.id ?? "",
    name: "",
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  const project = state.project;
  const activeTab = state.ui.openTabs.find((tab) => tab.id === state.ui.activeTabId) ?? state.ui.openTabs[0];
  const activeAssembly =
    activeTab?.type === "assembly"
      ? project.assemblies.find((assembly) => assembly.id === activeTab.assemblyId) ?? null
      : null;
  const activeTemplate =
    activeAssembly
      ? starterLibrary.find((template) => template.id === activeAssembly.templateId) ?? null
      : null;
  const activeGroup =
    project.groups.find((group) => group.id === (activeAssembly?.groupId ?? state.ui.selectedGroupId)) ?? null;
  const activeDrafts = activeAssembly ? state.drafts[activeAssembly.id] ?? {} : {};

  const evaluation = useMemo(() => {
    if (!activeAssembly || !activeTemplate) return null;

    try {
      return {
        result: evaluatePA(activeTemplate, activeAssembly.values),
        error: null,
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Unknown evaluation error.",
      };
    }
  }, [activeAssembly, activeTemplate]);

  function updateProject(nextProject: ProjectState): void {
    setState((current) => ({
      ...current,
      project: {
        ...nextProject,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function setWorkspaceMode(mode: WorkspaceMode): void {
    setState((current) => ({
      ...current,
      ui: {
        ...current.ui,
        workspaceMode: mode,
      },
    }));
  }

  function setActiveTab(tabId: string): void {
    setState((current) => {
      const tab = current.ui.openTabs.find((entry) => entry.id === tabId);
      return {
        ...current,
        ui: {
          ...current.ui,
          activeTabId: tabId,
          selectedAssemblyId:
            tab?.type === "assembly" ? tab.assemblyId ?? current.ui.selectedAssemblyId : current.ui.selectedAssemblyId,
        },
      };
    });
  }

  function ensureAssemblyTab(assembly: AssemblyRecord): void {
    const tabId = `assembly-${assembly.id}`;
    setState((current) => {
      const exists = current.ui.openTabs.some((tab) => tab.id === tabId);
      const nextTabs = exists
        ? current.ui.openTabs
        : [
            ...current.ui.openTabs,
            {
              id: tabId,
              type: "assembly",
              title: assembly.name,
              assemblyId: assembly.id,
            } satisfies OpenTab,
          ];

      return {
        ...current,
        ui: {
          ...current.ui,
          openTabs: nextTabs,
          activeTabId: tabId,
          selectedAssemblyId: assembly.id,
          selectedGroupId: assembly.groupId,
        },
      };
    });
  }

  function closeTab(tabId: string): void {
    if (tabId === "welcome") return;

    setState((current) => {
      const nextTabs = current.ui.openTabs.filter((tab) => tab.id !== tabId);
      return {
        ...current,
        ui: {
          ...current.ui,
          openTabs: nextTabs.length > 0 ? nextTabs : current.ui.openTabs,
          activeTabId:
            current.ui.activeTabId === tabId
              ? "welcome"
              : current.ui.activeTabId,
        },
      };
    });
  }

  function createGroup(): void {
    const name = groupForm.name.trim();
    if (!name) return;

    const now = new Date().toISOString();
    const group: Group = {
      id: makeId("group"),
      name,
      note: groupForm.note.trim(),
      createdAt: now,
    };

    updateProject({
      ...project,
      groups: [...project.groups, group],
    });

    setState((current) => ({
      ...current,
      ui: {
        ...current.ui,
        selectedGroupId: group.id,
      },
    }));
    setGroupForm({ name: "", note: "" });
  }

  function createAssembly(): void {
    const groupId = state.ui.selectedGroupId ?? project.groups[0]?.id;
    if (!groupId) return;

    const template = starterLibrary.find((entry) => entry.id === assemblyForm.templateId);
    if (!template) return;

    const now = new Date().toISOString();
    const name =
      assemblyForm.name.trim() ||
      `${template.name} ${countAssembliesForTemplate(project.assemblies, template.id) + 1}`;
    const assembly: AssemblyRecord = {
      id: makeId("assembly"),
      groupId,
      templateId: template.id,
      name,
      values: {},
      createdAt: now,
      updatedAt: now,
    };

    updateProject({
      ...project,
      assemblies: [...project.assemblies, assembly],
    });

    setAssemblyForm((current) => ({ ...current, name: "" }));
    ensureAssemblyTab(assembly);
  }

  function updateAssemblyValue(key: string, value: VariableValue, draft?: string): void {
    if (!activeAssembly) return;

    updateProject({
      ...project,
      assemblies: project.assemblies.map((assembly) =>
        assembly.id === activeAssembly.id
          ? {
              ...assembly,
              values: {
                ...assembly.values,
                [key]: value,
              },
              updatedAt: new Date().toISOString(),
            }
          : assembly,
      ),
    });

    setState((current) => ({
      ...current,
      drafts: {
        ...current.drafts,
        [activeAssembly.id]: {
          ...(current.drafts[activeAssembly.id] ?? {}),
          ...(draft !== undefined ? { [key]: draft } : {}),
        },
      },
    }));
  }

  function handleExport(): void {
    if (!activeAssembly || !activeTemplate || !evaluation?.result) return;
    const csv = exportItemsToCsv(evaluation.result.items);
    const safeName = activeAssembly.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadTextFile(`${safeName || activeTemplate.id}.csv`, csv, "text/csv;charset=utf-8");
  }

  function handleReset(): void {
    if (!window.confirm("Reset the workbench demo back to its starting state?")) return;
    setState(resetState());
    setGroupForm({ name: "", note: "" });
    setAssemblyForm({
      templateId: starterLibrary[0]?.id ?? "",
      name: "",
    });
  }

  const totalAssemblies = project.assemblies.length;
  const openAssemblyTabs = state.ui.openTabs.filter((tab) => tab.type === "assembly").length;
  const completedAssemblies = project.assemblies.filter((assembly) => {
    const template = starterLibrary.find((entry) => entry.id === assembly.templateId);
    return template ? getCompletionPercent(assembly.values, template) === 100 : false;
  }).length;

  return (
    <div className="min-h-screen px-4 py-4 text-white md:px-6">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-4">
        <header className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-6 py-5 shadow-glow">
          <div className="relative">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="absolute right-24 top-8 h-24 w-24 rounded-full bg-amber-300/10 blur-3xl" />
          </div>
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.34em] text-signal-cyan/90">
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
                TakeoffAI
                <span className="text-white/35">Workbench Study</span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Hybrid Workbench Prototype
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/62 md:text-base">
                This branch combines the grouped tree, the form-grid editing model,
                a persistent Welcome tab, a toggleable AI placeholder panel, and a
                drawing placeholder that can be viewed alone or side-by-side with the workbench.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-2">
              <HeaderPill label="Project" value={project.name} />
              <HeaderPill label="Assemblies" value={String(totalAssemblies)} />
              <HeaderPill label="Completed" value={`${completedAssemblies}/${totalAssemblies}`} />
              <HeaderPill label="Open Tabs" value={String(openAssemblyTabs + 1)} />
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
          <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <SidebarSection
              eyebrow="Project tree"
              title="Groups and assemblies"
              body="Groups are created explicitly, but the center behaves like a tabbed desktop workspace."
            />

            <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-white/40">Create group</div>
              <div className="mt-3 space-y-3">
                <SidebarInput
                  placeholder="Main Tower"
                  value={groupForm.name}
                  onChange={(value) => setGroupForm((current) => ({ ...current, name: value }))}
                />
                <SidebarInput
                  placeholder="Optional note for the estimator team"
                  value={groupForm.note}
                  onChange={(value) => setGroupForm((current) => ({ ...current, note: value }))}
                />
                <button
                  type="button"
                  onClick={createGroup}
                  disabled={!groupForm.name.trim()}
                  className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add group
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-white/40">Create assembly</div>
              <div className="mt-3 space-y-3">
                <select
                  value={assemblyForm.templateId}
                  onChange={(event) =>
                    setAssemblyForm((current) => ({
                      ...current,
                      templateId: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
                >
                  {starterLibrary.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <SidebarInput
                  placeholder="Optional custom assembly name"
                  value={assemblyForm.name}
                  onChange={(value) => setAssemblyForm((current) => ({ ...current, name: value }))}
                />
                <button
                  type="button"
                  onClick={createAssembly}
                  disabled={!project.groups.length}
                  className="w-full rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-200/50 hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add assembly to selected group
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <button
                type="button"
                onClick={() => setActiveTab("welcome")}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                  activeTab?.id === "welcome"
                    ? "border-signal-cyan/45 bg-[linear-gradient(135deg,rgba(77,214,255,0.18),rgba(255,255,255,0.04))]"
                    : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
                }`}
              >
                <div>
                  <div className="text-sm font-semibold text-white">Welcome</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">
                    Pinned workspace tab
                  </div>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                  Fixed
                </span>
              </button>

              {project.groups.map((group) => {
                const groupAssemblies = project.assemblies.filter((assembly) => assembly.groupId === group.id);

                return (
                  <section
                    key={group.id}
                    className={`rounded-[24px] border p-4 ${
                      state.ui.selectedGroupId === group.id
                        ? "border-signal-gold/35 bg-[linear-gradient(135deg,rgba(255,191,87,0.18),rgba(255,255,255,0.04))]"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setState((current) => ({
                          ...current,
                          ui: {
                            ...current.ui,
                            selectedGroupId: group.id,
                          },
                        }))
                      }
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-white">{group.name}</div>
                          <p className="mt-2 text-sm leading-6 text-white/55">{group.note}</p>
                        </div>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/55">
                          {groupAssemblies.length}
                        </span>
                      </div>
                    </button>

                    <div className="mt-4 space-y-2">
                      {groupAssemblies.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-white/40">
                          No assemblies yet.
                        </div>
                      ) : (
                        groupAssemblies.map((assembly) => {
                          const template = starterLibrary.find(
                            (entry) => entry.id === assembly.templateId,
                          );
                          const completion = template
                            ? getCompletionPercent(assembly.values, template)
                            : 0;

                          return (
                            <button
                              key={assembly.id}
                              type="button"
                              onClick={() => ensureAssemblyTab(assembly)}
                              className={`w-full rounded-2xl px-3 py-3 text-left transition ${
                                activeAssembly?.id === assembly.id
                                  ? "bg-white text-slate-950 shadow-[0_12px_30px_rgba(255,255,255,0.08)]"
                                  : "bg-white/5 hover:bg-white/10"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium">{assembly.name}</div>
                                  <div className="mt-1 text-[11px] uppercase tracking-[0.18em] opacity-65">
                                    {template?.name ?? assembly.templateId}
                                  </div>
                                </div>
                                <div
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    completion === 100
                                      ? "bg-emerald-400"
                                      : completion > 0
                                        ? "bg-amber-300"
                                        : "bg-white/25"
                                  }`}
                                />
                              </div>
                              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20">
                                <div
                                  className={`h-full rounded-full ${
                                    completion === 100
                                      ? "bg-emerald-400"
                                      : completion > 0
                                        ? "bg-gradient-to-r from-amber-300 to-cyan-300"
                                        : "bg-white/10"
                                  }`}
                                  style={{ width: `${completion}%` }}
                                />
                              </div>
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

          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-white/42">
                    Workbench
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {activeTab?.type === "welcome"
                      ? "Welcome"
                      : activeAssembly?.name ?? "No tab selected"}
                  </div>
                  <div className="mt-2 text-sm text-white/58">
                    {activeTab?.type === "welcome"
                      ? "Pinned overview and launch surface for the project workspace."
                      : `${activeGroup?.name ?? "Ungrouped"} · ${activeTemplate?.name ?? "Template"} · Autosave on`}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <SegmentedControl
                    value={state.ui.workspaceMode}
                    options={[
                      { value: "workbench", label: "Workbench" },
                      { value: "drawing", label: "Drawing" },
                      { value: "split", label: "Split" },
                    ]}
                    onChange={(value) => setWorkspaceMode(value as WorkspaceMode)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        ui: {
                          ...current.ui,
                          aiPanelOpen: !current.ui.aiPanelOpen,
                        },
                      }))
                    }
                    className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/78 transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    {state.ui.aiPanelOpen ? "Hide AI Panel" : "Show AI Panel"}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/78 transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    Reset demo
                  </button>
                </div>
              </div>
            </div>

            <div className="border-b border-white/10 px-4">
              <div className="flex gap-2 overflow-x-auto py-3">
                {state.ui.openTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`group inline-flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                      state.ui.activeTabId === tab.id
                        ? "border-signal-cyan/45 bg-[linear-gradient(135deg,rgba(77,214,255,0.18),rgba(255,255,255,0.04))] text-white"
                        : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${tab.type === "welcome" ? "bg-amber-300" : "bg-cyan-300"}`} />
                    <span>{tab.title}</span>
                    {tab.id !== "welcome" ? (
                      <span
                        role="button"
                        aria-label={`Close ${tab.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          closeTab(tab.id);
                        }}
                        className="rounded-full bg-black/20 px-2 py-0.5 text-xs opacity-70 transition group-hover:opacity-100"
                      >
                        ×
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              {activeTab?.type === "welcome" ? (
                <WelcomeTab
                  totalAssemblies={totalAssemblies}
                  totalGroups={project.groups.length}
                  aiPanelOpen={state.ui.aiPanelOpen}
                  onOpenFirstAssembly={() => {
                    const first = project.assemblies[0];
                    if (first) ensureAssemblyTab(first);
                  }}
                  onCreateGroup={() => {
                    setState((current) => ({
                      ...current,
                      ui: { ...current.ui, selectedGroupId: project.groups[0]?.id ?? null },
                    }));
                  }}
                />
              ) : activeAssembly && activeTemplate ? (
                <AssemblyWorkbench
                  assembly={activeAssembly}
                  template={activeTemplate}
                  evaluation={evaluation}
                  drafts={activeDrafts}
                  workspaceMode={state.ui.workspaceMode}
                  onValueChange={updateAssemblyValue}
                  onExport={handleExport}
                />
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/10 p-6 text-sm text-white/45">
                  Select an assembly from the tree to start working.
                </div>
              )}
            </div>

            <footer className="border-t border-white/10 bg-slate-950/45 px-5 py-3 text-xs text-white/45">
              {activeTab?.type === "welcome"
                ? "Welcome tab is always available. Use it as the stable home surface in this hybrid prototype."
                : `Autosaving ${activeAssembly?.name ?? "assembly"} · ${
                    evaluation?.error ? "Evaluation error present" : "Live preview current"
                  }`}
            </footer>
          </section>

          {state.ui.aiPanelOpen ? (
            <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <SidebarSection
                eyebrow="Future AI panel"
                title="Conversational assistance"
                body="This panel is intentionally a placeholder. In the future it will read the active assembly context, suggest field values, explain missing inputs, and accept natural-language instructions."
              />

              <div className="mt-5 space-y-4">
                <PlaceholderCard
                  title="What this panel will do later"
                  body="Fill or revise active form values from natural language, ask clarifying questions, and help estimators move quickly without leaving the workbench."
                  accent="cyan"
                />
                <PlaceholderCard
                  title="Why it is toggleable"
                  body="Some users will want the extra help; others will want maximum editing space. The layout needs to support both states cleanly."
                  accent="gold"
                />
                <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/40">
                    Example future prompts
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      "Use the same stair settings as Stair 1, but widen it to 5 feet.",
                      "What fields are still missing before export?",
                      "Summarize the difference between this stair and the landing tab.",
                    ].map((prompt) => (
                      <div
                        key={prompt}
                        className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-3 py-3 text-sm leading-6 text-white/62"
                      >
                        {prompt}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HeaderPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/40">{label}</div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function SidebarSection({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.28em] text-white/42">{eyebrow}</div>
      <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-white/58">{body}</p>
    </div>
  );
}

function SidebarInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
    />
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-slate-950/40 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            value === option.value
              ? "bg-white text-slate-950"
              : "text-white/65 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function WelcomeTab({
  totalAssemblies,
  totalGroups,
  aiPanelOpen,
  onOpenFirstAssembly,
  onCreateGroup,
}: {
  totalAssemblies: number;
  totalGroups: number;
  aiPanelOpen: boolean;
  onOpenFirstAssembly: () => void;
  onCreateGroup: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-[26px] border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(77,214,255,0.18),rgba(255,255,255,0.04))] p-6">
          <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-cyan-200/15 blur-3xl" />
          <div className="text-xs uppercase tracking-[0.26em] text-cyan-100/80">
            Welcome tab
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-white">
            Persistent anchor for the workspace
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/66">
            This tab never closes. It gives the workbench a stable home surface for
            launching assemblies, reviewing project health, and explaining future
            product surfaces like the AI panel and drawing review.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onOpenFirstAssembly}
              className="rounded-full border border-cyan-200/35 bg-cyan-200/12 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/50 hover:bg-cyan-200/18"
            >
              Open first assembly tab
            </button>
            <button
              type="button"
              onClick={onCreateGroup}
              className="rounded-full border border-white/12 px-4 py-3 text-sm font-semibold text-white/78 transition hover:border-white/22 hover:bg-white/[0.06]"
            >
              Focus group creation
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          <MetricCard label="Groups" value={String(totalGroups)} />
          <MetricCard label="Assemblies" value={String(totalAssemblies)} />
          <MetricCard label="AI Panel" value={aiPanelOpen ? "Visible" : "Hidden"} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <PlaceholderCard
          title="Form-grid core"
          body="The center editor for assembly tabs is intentionally the familiar form-grid pattern. This is the dependable base inside the more ambitious workbench shell."
          accent="cyan"
        />
        <PlaceholderCard
          title="Drawing modes"
          body="Workbench, Drawing, and Split are layout modes for the same assembly tab. They exist to test whether estimators want the drawing adjacent to the form or only occasionally."
          accent="gold"
        />
        <PlaceholderCard
          title="AI panel role"
          body="The right panel is not wired yet. Its job in the future is to assist from the current tab context rather than operate as a detached chat experience."
          accent="cyan"
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5">
      <div className="text-xs uppercase tracking-[0.24em] text-white/42">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}

function PlaceholderCard({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent: "cyan" | "gold";
}) {
  const classes =
    accent === "cyan"
      ? "border-cyan-300/18 bg-cyan-300/10"
      : "border-amber-300/18 bg-amber-300/10";

  return (
    <div className={`rounded-[24px] border p-5 ${classes}`}>
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-3 text-sm leading-6 text-white/66">{body}</p>
    </div>
  );
}

function AssemblyWorkbench({
  assembly,
  template,
  evaluation,
  drafts,
  workspaceMode,
  onValueChange,
  onExport,
}: {
  assembly: AssemblyRecord;
  template: PATemplate;
  evaluation:
    | {
        result: EvaluateResult | null;
        error: string | null;
      }
    | null;
  drafts: Record<string, string>;
  workspaceMode: WorkspaceMode;
  onValueChange: (key: string, value: VariableValue, draft?: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-white/40">
            Active assembly
          </div>
          <h3 className="mt-2 text-xl font-semibold text-white">{assembly.name}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">{template.description}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <MetricBadge label="Fields" value={String(template.variables.length)} />
          <MetricBadge
            label="Complete"
            value={`${getCompletionPercent(assembly.values, template)}%`}
          />
          <button
            type="button"
            onClick={onExport}
            className="rounded-full border border-emerald-300/35 bg-emerald-300/12 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/50 hover:bg-emerald-300/18"
          >
            Export CSV
          </button>
        </div>
      </div>

      {workspaceMode === "workbench" ? (
        <WorkbenchMode
          template={template}
          assembly={assembly}
          evaluation={evaluation}
          drafts={drafts}
          onValueChange={onValueChange}
        />
      ) : workspaceMode === "drawing" ? (
        <DrawingPanel template={template} assembly={assembly} />
      ) : (
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.05fr)_420px]">
          <WorkbenchMode
            template={template}
            assembly={assembly}
            evaluation={evaluation}
            drafts={drafts}
            onValueChange={onValueChange}
            compact
          />
          <DrawingPanel template={template} assembly={assembly} compact />
        </div>
      )}
    </div>
  );
}

function MetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-slate-950/35 px-4 py-2.5 text-sm">
      <span className="text-white/45">{label}</span>
      <span className="ml-3 font-semibold text-white">{value}</span>
    </div>
  );
}

function WorkbenchMode({
  template,
  assembly,
  evaluation,
  drafts,
  onValueChange,
  compact = false,
}: {
  template: PATemplate;
  assembly: AssemblyRecord;
  evaluation:
    | {
        result: EvaluateResult | null;
        error: string | null;
      }
    | null;
  drafts: Record<string, string>;
  onValueChange: (key: string, value: VariableValue, draft?: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-5 ${compact ? "" : "2xl:grid-cols-[minmax(0,1.08fr)_430px]"}`}>
      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5">
        <div className="text-xs uppercase tracking-[0.24em] text-white/40">Form grid</div>
        <h4 className="mt-2 text-lg font-semibold text-white">
          Dynamic variable editor
        </h4>
        <p className="mt-3 text-sm leading-6 text-white/60">
          This is the familiar form-grid editor pulled into the workbench shell. It
          uses the real PA variable definitions, so the layout experiment sits on top
          of the actual engine contract.
        </p>
        <div className="mt-5">
          <WizardForm
            variables={template.variables}
            values={assembly.values}
            drafts={drafts}
            onValueChange={onValueChange}
          />
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-white/40">Live preview</div>
          <h4 className="mt-2 text-lg font-semibold text-white">
            Expanded material list
          </h4>
          <p className="mt-3 text-sm leading-6 text-white/60">
            The preview updates as the form changes so the user can stay inside the
            workbench without running a separate calculation step.
          </p>

          {evaluation?.error ? (
            <div className="mt-5 rounded-2xl border border-red-400/18 bg-red-400/10 p-4 text-sm text-red-100">
              {evaluation.error}
            </div>
          ) : evaluation?.result ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard label="Rows" value={String(evaluation.result.items.length)} />
                <MetricCard
                  label="Warnings"
                  value={String(evaluation.result.warnings.length)}
                />
                <MetricCard
                  label="Header rows"
                  value={String(
                    evaluation.result.items.filter((item) => item.mainPiece).length,
                  )}
                />
              </div>
              <ItemsTable items={evaluation.result.items} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DrawingPanel({
  template,
  assembly,
  compact = false,
}: {
  template: PATemplate;
  assembly: AssemblyRecord;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5">
      <div className="text-xs uppercase tracking-[0.24em] text-white/40">Future drawing tab</div>
      <h4 className="mt-2 text-lg font-semibold text-white">
        Drawing review surface for {assembly.name}
      </h4>
      <p className="mt-3 text-sm leading-6 text-white/60">
        This panel is intentionally a placeholder. In the future it will show the
        uploaded drawing, let the user inspect callouts and dimensions, and link
        those observations back to the active {template.name} form.
      </p>

      <div
        className={`mt-5 rounded-[24px] border border-dashed border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 ${
          compact ? "min-h-[420px]" : "min-h-[620px]"
        }`}
      >
        <div className="flex h-full flex-col justify-between">
          <div>
            <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-100/80">
              Placeholder
            </div>
            <h5 className="mt-4 text-xl font-semibold text-white">
              Drawing viewer will live here
            </h5>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/62">
              The goal is to support both a dedicated drawing mode and a split mode
              beside the form-grid editor. This branch is testing whether that spatial
              relationship feels useful before implementing actual PDF behavior.
            </p>
            <div className="mt-6 rounded-[20px] border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/45">
                <span className="h-2 w-2 rounded-full bg-red-300/80" />
                <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
                Future drawing viewport
              </div>
              <div className="mt-4 grid gap-3">
                <div className="h-24 rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))]" />
                <div className="grid grid-cols-[1.1fr_0.9fr] gap-3">
                  <div className="h-32 rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))]" />
                  <div className="h-32 rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,191,87,0.08),rgba(255,255,255,0.02))]" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <DrawingMiniCard
              title="Future use"
              body="Uploaded PDF pages, zooming, callout references, and pinned observations tied to the active tab."
            />
            <DrawingMiniCard
              title="Why it matters"
              body="This validates whether estimators want the drawing always adjacent, occasionally adjacent, or mostly hidden."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawingMiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-slate-950/35 p-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-3 text-sm leading-6 text-white/60">{body}</p>
    </div>
  );
}

function countAssembliesForTemplate(assemblies: AssemblyRecord[], templateId: string): number {
  return assemblies.filter((assembly) => assembly.templateId === templateId).length;
}

function getCompletionPercent(
  values: Record<string, VariableValue>,
  template: PATemplate,
): number {
  const required = template.variables.filter((variable) => variable.required);
  if (required.length === 0) return 100;

  const complete = required.filter((variable) => {
    const value = values[variable.key];
    return value !== undefined && value !== null && value !== "";
  }).length;

  return Math.round((complete / required.length) * 100);
}

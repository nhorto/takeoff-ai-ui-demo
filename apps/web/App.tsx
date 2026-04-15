import { useEffect, useMemo, useState } from "react";
import {
  evaluatePA,
  type EvaluateResult,
  type PACategory,
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
  OpenTab,
  PersistedState,
  ProjectState,
  WorkspaceMode,
} from "@/types/project";

type CategorySection = {
  key: PACategory;
  label: string;
  addLabel: string;
};

const CATEGORY_SECTIONS: CategorySection[] = [
  { key: "stair", label: "Stairs", addLabel: "Add stair" },
  { key: "landing", label: "Landings", addLabel: "Add landing" },
  { key: "rail", label: "Rails", addLabel: "Add rail" },
  { key: "ladder", label: "Ladders", addLabel: "Add ladder" },
];

export default function App() {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [search, setSearch] = useState("");
  const [commandText, setCommandText] = useState("");
  const [aiInput, setAiInput] = useState("");

  useEffect(() => {
    saveState(state);
  }, [state]);

  const project = state.project;
  const activeTab =
    state.ui.openTabs.find((tab) => tab.id === state.ui.activeTabId) ?? state.ui.openTabs[0];
  const activeAssembly =
    activeTab?.type === "assembly"
      ? project.assemblies.find((assembly) => assembly.id === activeTab.assemblyId) ?? null
      : null;
  const activeTemplate =
    activeAssembly
      ? starterLibrary.find((template) => template.id === activeAssembly.templateId) ?? null
      : null;
  const activeDrafts = activeAssembly ? state.drafts[activeAssembly.id] ?? {} : {};

  const evaluation = useMemo(() => {
    if (!activeAssembly || !activeTemplate) return null;

    try {
      const raw = evaluatePA(activeTemplate, activeAssembly.values);
      const qty = activeAssembly.quantity > 0 ? activeAssembly.quantity : 1;
      const scaled = {
        ...raw,
        items: raw.items.map((item) => ({
          ...item,
          quantity: item.quantity * qty,
        })),
      };
      return { result: scaled, error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Unknown evaluation error.",
      };
    }
  }, [activeAssembly, activeTemplate]);

  const filteredAssemblies = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return project.assemblies;
    return project.assemblies.filter((assembly) => {
      const template = starterLibrary.find((entry) => entry.id === assembly.templateId);
      return (
        assembly.name.toLowerCase().includes(term) ||
        template?.name.toLowerCase().includes(term)
      );
    });
  }, [project.assemblies, search]);

  const recentAssemblies = [...project.assemblies]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 4);

  const completedAssemblies = project.assemblies.filter((assembly) => {
    const template = starterLibrary.find((entry) => entry.id === assembly.templateId);
    return template ? getCompletionPercent(assembly.values, template) === 100 : false;
  }).length;

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
            tab?.type === "assembly"
              ? tab.assemblyId ?? current.ui.selectedAssemblyId
              : current.ui.selectedAssemblyId,
        },
      };
    });
  }

  function ensureAssemblyTab(assembly: AssemblyRecord): void {
    const tabId = `assembly-${assembly.id}`;
    setState((current) => {
      const exists = current.ui.openTabs.some((tab) => tab.id === tabId);
      const nextTabs = exists
        ? current.ui.openTabs.map((tab) =>
            tab.id === tabId ? { ...tab, title: assembly.name } : tab,
          )
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
          activeTabId: current.ui.activeTabId === tabId ? "welcome" : current.ui.activeTabId,
        },
      };
    });
  }

  function createAssemblyForCategory(category: PACategory): void {
    const template = starterLibrary.find((entry) => entry.category === category);
    if (!template) return;

    const now = new Date().toISOString();
    const groupId = project.groups[0]?.id ?? makeId("group");
    const assembly: AssemblyRecord = {
      id: makeId("assembly"),
      groupId,
      templateId: template.id,
      name: `${template.name} ${countAssembliesForTemplate(project.assemblies, template.id) + 1}`,
      quantity: 1,
      values: {},
      createdAt: now,
      updatedAt: now,
    };

    updateProject({
      ...project,
      groups:
        project.groups.length > 0
          ? project.groups
          : [
              {
                id: groupId,
                name: "Default",
                note: "",
                createdAt: now,
              },
            ],
      assemblies: [...project.assemblies, assembly],
    });

    ensureAssemblyTab(assembly);
  }

  function createAssemblyFromTemplate(templateId: string): void {
    const template = starterLibrary.find((entry) => entry.id === templateId);
    if (!template) return;
    createAssemblyForCategory(template.category);
  }

  function updateAssemblyQuantity(quantity: number): void {
    if (!activeAssembly) return;
    const next = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
    updateProject({
      ...project,
      assemblies: project.assemblies.map((assembly) =>
        assembly.id === activeAssembly.id
          ? { ...assembly, quantity: next, updatedAt: new Date().toISOString() }
          : assembly,
      ),
    });
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

  function submitCommand(templateId: string): void {
    createAssemblyFromTemplate(templateId);
    setCommandText("");
  }

  function toggleAiPanel(): void {
    setState((current) => ({
      ...current,
      ui: {
        ...current.ui,
        aiPanelOpen: !current.ui.aiPanelOpen,
      },
    }));
  }

  function handleReset(): void {
    if (!window.confirm("Reset the workbench demo back to its starting state?")) return;
    setState(resetState());
    setSearch("");
    setCommandText("");
    setAiInput("");
  }

  return (
    <div className="min-h-screen px-4 py-4 text-white md:px-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,30,0.98),rgba(8,13,24,0.98))] shadow-glow">
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="font-semibold tracking-[0.16em] text-white">TakeoffAI</div>
              <div className="text-white/35">▸</div>
              <div className="text-white/72">{project.name}</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleAiPanel}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                {state.ui.aiPanelOpen ? "Hide AI" : "Show AI"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                Reset
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                ⚙
              </button>
            </div>
          </header>

          <div
            className={`grid min-h-[760px] ${
              state.ui.aiPanelOpen
                ? "xl:grid-cols-[260px_minmax(0,1fr)_260px]"
                : "xl:grid-cols-[260px_minmax(0,1fr)]"
            }`}
          >
            <aside className="border-b border-white/10 bg-white/[0.02] xl:border-b-0 xl:border-r">
              <div className="px-4 py-4">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                  Assemblies
                </div>
                <div className="mt-4">
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search..."
                    className="w-full rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
                  />
                </div>
              </div>

              <div className="space-y-4 px-4 pb-4">
                {CATEGORY_SECTIONS.map((section) => {
                  const sectionTemplates = starterLibrary
                    .filter((template) => template.category === section.key)
                    .map((template) => template.id);
                  const sectionAssemblies = filteredAssemblies.filter((assembly) =>
                    sectionTemplates.includes(assembly.templateId),
                  );

                  return (
                    <div key={section.key}>
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/45">
                        <span>▾ {section.label}</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {sectionAssemblies.map((assembly) => {
                          const complete = getCompletionPercentForAssembly(assembly);
                          const active = activeAssembly?.id === assembly.id;

                          return (
                            <button
                              key={assembly.id}
                              type="button"
                              onClick={() => ensureAssemblyTab(assembly)}
                              className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition ${
                                active
                                  ? "bg-white text-slate-950"
                                  : "text-white/72 hover:bg-white/[0.06] hover:text-white"
                              }`}
                            >
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  complete === 100
                                    ? "bg-emerald-400"
                                    : active
                                      ? "bg-slate-950"
                                      : "bg-white/22"
                                }`}
                              />
                              <span className="truncate">{assembly.name}</span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => createAssemblyForCategory(section.key)}
                          className="w-full rounded-lg px-2 py-2 text-left text-sm text-cyan-200/85 transition hover:bg-white/[0.06] hover:text-cyan-100"
                        >
                          + {section.addLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            <section className="flex min-w-0 flex-col">
              {activeTab?.type === "welcome" ? (
                <>
                  <div className="flex-1 px-6 py-6">
                    <div className="mx-auto max-w-2xl pt-10">
                      <div className="text-center text-sm text-white/58">
                        Type a command or click below
                      </div>
                      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <div className="flex items-center gap-3 text-sm text-white/74">
                          <span className="text-cyan-300">&gt;</span>
                          <input
                            type="text"
                            value={commandText}
                            onChange={(event) => setCommandText(event.target.value)}
                            placeholder="Add stair"
                            className="w-full bg-transparent outline-none placeholder:text-white/28"
                          />
                        </div>
                      </div>

                      <div className="mt-10">
                        <div className="text-sm text-white/52">Quick actions</div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <QuickAction label="New stair" onClick={() => submitCommand("stair-channel")} />
                          <QuickAction label="New landing" onClick={() => submitCommand("landing-channel")} />
                          <QuickAction label="New rail" onClick={() => submitCommand("hss-rail-pickets")} />
                          <QuickAction label="New ladder" onClick={() => submitCommand("roof-ladder")} />
                          <QuickAction label="Import from PowerFab" muted />
                          <QuickAction label="Export CSV" onClick={handleExport} muted={!activeAssembly} />
                        </div>
                      </div>

                      <div className="mt-10">
                        <div className="text-sm text-white/52">Recent</div>
                        <div className="mt-4 space-y-2">
                          {recentAssemblies.map((assembly) => (
                            <button
                              key={assembly.id}
                              type="button"
                              onClick={() => ensureAssemblyTab(assembly)}
                              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
                            >
                              <span className="text-white/35">◦</span>
                              <span>
                                {assembly.name}{" "}
                                <span className="text-white/38">
                                  (edited {relativeEditedLabel(assembly.updatedAt)})
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex gap-2 overflow-x-auto">
                      {state.ui.openTabs
                        .filter((tab) => tab.type === "assembly")
                        .map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`inline-flex shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-3 py-2 text-sm transition ${
                              state.ui.activeTabId === tab.id
                                ? "border-white/20 bg-white/[0.06] text-white"
                                : "border-transparent bg-transparent text-white/52 hover:text-white/78"
                            }`}
                          >
                            <span>{tab.title}</span>
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                closeTab(tab.id);
                              }}
                              className="text-white/40 hover:text-white/78"
                            >
                              ×
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto px-6 py-5">
                    {activeAssembly && activeTemplate ? (
                      <AssemblyEditor
                        assembly={activeAssembly}
                        template={activeTemplate}
                        evaluation={evaluation}
                        drafts={activeDrafts}
                        workspaceMode={state.ui.workspaceMode}
                        onSetWorkspaceMode={setWorkspaceMode}
                        onValueChange={updateAssemblyValue}
                        onQuantityChange={updateAssemblyQuantity}
                        onExport={handleExport}
                      />
                    ) : (
                      <div className="py-16 text-center text-sm text-white/42">
                        Select an assembly to begin editing.
                      </div>
                    )}
                  </div>
                </>
              )}

              <footer className="border-t border-white/10 bg-slate-950/55 px-5 py-2.5 text-xs text-white/48">
                Project: {project.assemblies.length} assemblies · {completedAssemblies} complete ·{" "}
                {project.assemblies.length - completedAssemblies} in progress
                <span className="float-right">
                  {activeAssembly ? "editing · " : ""}
                  saved ✓
                </span>
              </footer>
            </section>

            {state.ui.aiPanelOpen ? (
              <aside className="border-t border-white/10 bg-white/[0.02] xl:border-l xl:border-t-0">
                <div className="px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                    AI Assistant
                  </div>
                </div>
                <div className="flex h-full flex-col px-4 pb-4">
                  {activeTab?.type === "welcome" ? (
                    <div className="space-y-4 text-sm leading-6 text-white/66">
                      <p>Hi. Tell me what you want to add.</p>
                      <p>You can describe it in plain English.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 text-sm leading-6 text-white/66">
                      <div>
                        <div className="text-white/45">You:</div>
                        <div>change the stringer to HSS</div>
                      </div>
                      <div>
                        <div className="text-white/45">AI:</div>
                        <div>
                          Done. I&apos;ve updated the shape to HSS and set the size to
                          HSS8X8X1/2.
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab?.type !== "welcome" && (
                    <div className="mt-6 border-t border-white/10 pt-4 text-xs text-white/40">
                      Future role: edit the active tab in plain English, explain
                      missing inputs, and assist without leaving the workbench.
                    </div>
                  )}

                  <div className="mt-auto pt-6">
                    <div className="rounded-xl border border-white/10 bg-slate-950/65 px-3 py-2.5 text-sm text-white/70">
                      <input
                        type="text"
                        value={aiInput}
                        onChange={(event) => setAiInput(event.target.value)}
                        placeholder="Type here…"
                        className="w-full bg-transparent outline-none placeholder:text-white/28"
                      />
                    </div>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  function getCompletionPercentForAssembly(assembly: AssemblyRecord): number {
    const template = starterLibrary.find((entry) => entry.id === assembly.templateId);
    return template ? getCompletionPercent(assembly.values, template) : 0;
  }
}

function QuickAction({
  label,
  onClick,
  muted = false,
}: {
  label: string;
  onClick?: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
        muted
          ? "border-white/10 bg-white/[0.03] text-white/48"
          : "border-white/10 bg-white/[0.03] text-white/76 hover:border-white/20 hover:bg-white/[0.06]"
      } disabled:cursor-default`}
    >
      <span>⊞</span>
      <span>{label}</span>
    </button>
  );
}

function AssemblyEditor({
  assembly,
  template,
  evaluation,
  drafts,
  workspaceMode,
  onSetWorkspaceMode,
  onValueChange,
  onQuantityChange,
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
  onSetWorkspaceMode: (mode: WorkspaceMode) => void;
  onValueChange: (key: string, value: VariableValue, draft?: string) => void;
  onQuantityChange: (quantity: number) => void;
  onExport: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-white">{assembly.name}</div>
          <div className="mt-2 flex items-center gap-3 text-sm text-white/55">
            <span>Label: {assembly.name}</span>
            <span className="text-white/20">·</span>
            <label className="flex items-center gap-2">
              <span>Quantity</span>
              <input
                type="number"
                min={1}
                step={1}
                value={assembly.quantity}
                onChange={(event) => onQuantityChange(Number(event.target.value))}
                className="w-16 rounded-lg border border-white/10 bg-slate-950/65 px-2 py-1 text-sm text-white outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/15"
              />
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModeButton
            active={workspaceMode === "workbench"}
            onClick={() => onSetWorkspaceMode("workbench")}
          >
            Workbench
          </ModeButton>
          <ModeButton
            active={workspaceMode === "drawing"}
            onClick={() => onSetWorkspaceMode("drawing")}
          >
            Drawing
          </ModeButton>
          <ModeButton
            active={workspaceMode === "split"}
            onClick={() => onSetWorkspaceMode("split")}
          >
            Split
          </ModeButton>
        </div>
      </div>

      {workspaceMode === "drawing" ? (
        <SimpleDrawingView template={template} />
      ) : workspaceMode === "split" ? (
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <EditorWorkbench
            assembly={assembly}
            template={template}
            evaluation={evaluation}
            drafts={drafts}
            onValueChange={onValueChange}
            onExport={onExport}
          />
          <SimpleDrawingView template={template} compact />
        </div>
      ) : (
        <EditorWorkbench
          assembly={assembly}
          template={template}
          evaluation={evaluation}
          drafts={drafts}
          onValueChange={onValueChange}
          onExport={onExport}
        />
      )}
    </div>
  );
}

function EditorWorkbench({
  assembly,
  template,
  evaluation,
  drafts,
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
  onValueChange: (key: string, value: VariableValue, draft?: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm text-white/58">Variables</div>
        <div className="mt-4">
          <WizardForm
            variables={template.variables}
            values={assembly.values}
            drafts={drafts}
            onValueChange={onValueChange}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-white/58">Items (live preview)</div>
          <button
            type="button"
            onClick={onExport}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/68 transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            Export CSV
          </button>
        </div>

        {evaluation?.error ? (
          <div className="mt-4 rounded-xl border border-red-400/18 bg-red-400/10 p-4 text-sm text-red-100">
            {evaluation.error}
          </div>
        ) : evaluation?.result ? (
          <div className="mt-4">
            <ItemsTable items={evaluation.result.items} />
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/72 transition hover:border-white/20 hover:bg-white/[0.05]"
        >
          Duplicate
        </button>
        <button
          type="button"
          className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/72 transition hover:border-white/20 hover:bg-white/[0.05]"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function SimpleDrawingView({
  template,
  compact = false,
}: {
  template: PATemplate;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5">
      <div className="text-sm text-white/58">Drawing placeholder</div>
      <div
        className={`mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-5 ${
          compact ? "min-h-[380px]" : "min-h-[520px]"
        }`}
      >
        <div className="text-xs uppercase tracking-[0.2em] text-white/42">
          Future drawing review for {template.name}
        </div>
        <div className="mt-5 grid gap-3">
          <div className="h-20 rounded-xl border border-white/8 bg-white/[0.04]" />
          <div className="grid grid-cols-[1.15fr_0.85fr] gap-3">
            <div className="h-36 rounded-xl border border-white/8 bg-white/[0.04]" />
            <div className="h-36 rounded-xl border border-white/8 bg-white/[0.04]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition ${
        active
          ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
          : "border-white/10 text-white/55 hover:border-white/20 hover:bg-white/[0.05] hover:text-white/76"
      }`}
    >
      {children}
    </button>
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

function relativeEditedLabel(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

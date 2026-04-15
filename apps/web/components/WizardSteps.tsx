const STEPS = [
  {
    id: 0,
    label: "Group Setup",
    summary: "Create explicit work buckets before assemblies are authored.",
  },
  {
    id: 1,
    label: "Assembly Selection",
    summary: "Choose a template and attach it to a group.",
  },
  {
    id: 2,
    label: "Guided Inputs",
    summary: "Fill the dynamic form and watch the material list update live.",
  },
  {
    id: 3,
    label: "Review + Export",
    summary: "Check the generated steel package and export a CSV.",
  },
] as const;

interface WizardStepsProps {
  activeStep: number;
  onStepChange: (step: 0 | 1 | 2 | 3) => void;
}

export function WizardSteps({ activeStep, onStepChange }: WizardStepsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {STEPS.map((step) => {
        const active = step.id === activeStep;
        const complete = step.id < activeStep;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepChange(step.id)}
            className={`rounded-2xl border px-4 py-4 text-left transition ${
              active
                ? "border-signal-cyan bg-cyan-400/10 shadow-glow"
                : complete
                  ? "border-emerald-400/40 bg-emerald-400/10"
                  : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.24em] text-white/45">
                Step {step.id + 1}
              </span>
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-cyan-300 text-slate-950"
                    : complete
                      ? "bg-emerald-300 text-slate-950"
                      : "bg-white/10 text-white/60"
                }`}
              >
                {step.id + 1}
              </span>
            </div>
            <div className="text-sm font-semibold text-white">{step.label}</div>
            <p className="mt-2 text-sm leading-6 text-white/60">{step.summary}</p>
          </button>
        );
      })}
    </div>
  );
}

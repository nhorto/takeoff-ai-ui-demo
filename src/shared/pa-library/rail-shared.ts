// Shared rail-post mounting options. Used by picket, multi-line, cable, and
// assist rails. Wall rails are wall-mounted and define their own bracket
// options, so they don't use this constant.
//
// Exported as a function so each template gets its own array — avoids
// accidental shared-reference mutation of the enum list.
export function mountingOptions(): { value: string; label: string }[] {
  return [
    { value: "baseplate", label: "Base plate (bolt-down)" },
    { value: "core-drill", label: "Core-drilled into concrete" },
    { value: "side-mount", label: "Side-mounted tabs" },
  ];
}

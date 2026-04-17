// Shared rail-post mounting options. Used by picket, multi-line, cable, and
// assist rails. Wall rails are wall-mounted and define their own bracket
// options, so they don't use this constant.
//
// Exported as a function so each template gets its own array — avoids
// accidental shared-reference mutation of the enum list.
export function mountingOptions(): { value: string; label: string }[] {
  return [
    { value: "embedded", label: "Embedded" },
    { value: "mounted-on-stair", label: "Mounted on Stair" },
    { value: "mounted-on-side", label: "Mounted on Side of Stair" },
    { value: "baseplate", label: "Base Plate and Anchors" },
  ];
}

// Rail material shape options — the spec allows HSS tubes, round HSS
// (HSSR), or pipe for top/bottom/post on most rail types.
export const RAIL_MATERIAL_SHAPES = ["HSS", "HSSR", "PIPE"] as const;

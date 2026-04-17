/**
 * Wall Rail — a single-line handrail mounted to a wall with brackets.
 * No posts, no pickets; the wall carries the load.
 */

import type { PATemplate, Item } from "../engine/types";
import { feet, inches } from "../engine/units";

export const wallRail: PATemplate = {
  id: "wall-rail",
  name: "Wall Rail",
  description:
    "Single-line handrail mounted to a wall with brackets. Used for ADA/code compliance on stairs with wall-adjacent paths.",
  category: "rail",

  variables: [
    {
      key: "railLength",
      label: "Rail Length",
      type: "length",
      defaultValue: feet(10),
      required: true,
      position: 1,
      group: "geometry",
    },

    {
      key: "railMaterial",
      label: "Rail Size",
      type: "dimension",
      shapeFilter: ["HSS", "RD", "PIPE"],
      defaultValue: "PIPE1-1/2",
      required: true,
      position: 5,
      group: "rails",
    },
    {
      key: "railReturns",
      label: "End Returns",
      description:
        "Code typically requires returns to wall at each end of the rail.",
      type: "enum",
      enumOptions: [
        { value: "both", label: "Both ends return" },
        { value: "one", label: "One end returns" },
        { value: "none", label: "No returns" },
      ],
      defaultValue: "both",
      required: true,
      position: 6,
      group: "rails",
    },

    {
      key: "bracketSpacing",
      label: "Max Bracket Spacing",
      type: "length",
      defaultValue: feet(4),
      required: true,
      position: 10,
      group: "brackets",
    },
    {
      key: "bracketType",
      label: "Bracket Type",
      type: "enum",
      enumOptions: [
        { value: "plate", label: "Plate bracket (bolt-through)" },
        { value: "wall-flange", label: "Wall flange (surface mount)" },
      ],
      defaultValue: "plate",
      required: true,
      position: 11,
      group: "brackets",
    },
  ],

  calculate: (v) => {
    const railLength = v.railLength as number;
    const railSize = v.railMaterial as string;
    const returns = v.railReturns as "both" | "one" | "none";
    const bracketSpacing = v.bracketSpacing as number;
    const bracketType = v.bracketType as "plate" | "wall-flange";

    const brackets = Math.max(2, Math.ceil(railLength / bracketSpacing) + 1);
    const numReturns = returns === "both" ? 2 : returns === "one" ? 1 : 0;

    const items: Item[] = [
      {
        mainPiece: true,
        shape: "CO",
        grade: ".",
        quantity: 1,
        description: "Wall Rail",
        erectHours: 2,
      },
      {
        shape: "PIPE",
        size: railSize,
        grade: "A53",
        quantity: 1,
        length: railLength,
        laborCode: "H",
        comment: "Rail",
        erectHours: (railLength / inches(12)) * 0.15,
      },
    ];

    if (numReturns > 0) {
      items.push({
        shape: "PIPE",
        size: railSize,
        grade: "A53",
        quantity: numReturns,
        length: inches(4),
        laborCode: "H",
        comment: "End Returns",
      });
    }

    if (bracketType === "plate") {
      items.push({
        shape: "PL",
        size: "PL1/4",
        grade: "A36",
        quantity: brackets,
        length: inches(4),
        width: inches(4),
        laborCode: "W",
        comment: "Wall Brackets",
        holes: 2,
      });
    } else {
      items.push({
        shape: "FL",
        size: "FL1-1/2",
        grade: "A36",
        quantity: brackets,
        laborCode: "W",
        comment: "Wall Flanges",
        holes: 4,
      });
    }

    return items;
  },
};

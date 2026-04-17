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
      shapeFilter: ["HSSR", "PIPE"],
      defaultValue: "PIPE1-1/2",
      required: true,
      position: 5,
      group: "rails",
    },
    {
      key: "endCondition",
      label: "End Condition",
      type: "enum",
      enumOptions: [
        { value: "terminate-to-wall", label: "Terminate to wall" },
        { value: "cap", label: "Cap" },
      ],
      defaultValue: "terminate-to-wall",
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
        { value: "buyout", label: "Buyout" },
        { value: "plate-and-rod", label: "Plate and Rod" },
      ],
      defaultValue: "plate-and-rod",
      required: true,
      position: 11,
      group: "brackets",
    },
  ],

  calculate: (v) => {
    const railLength = v.railLength as number;
    const railSize = v.railMaterial as string;
    const endCondition = v.endCondition as "cap" | "terminate-to-wall";
    const bracketSpacing = v.bracketSpacing as number;
    const bracketType = v.bracketType as "buyout" | "plate-and-rod";

    const brackets = Math.max(2, Math.ceil(railLength / bracketSpacing) + 1);
    const numReturns = endCondition === "terminate-to-wall" ? 2 : 0;

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

    if (bracketType === "plate-and-rod") {
      items.push({
        shape: "PL",
        size: "PL1/4",
        grade: "A36",
        quantity: brackets,
        length: inches(4),
        width: inches(4),
        laborCode: "W",
        comment: "Wall Brackets (Plate and Rod)",
        holes: 2,
      });
      items.push({
        shape: "RD",
        size: "RD1/2",
        grade: "A36",
        quantity: brackets,
        length: inches(6),
        laborCode: "Y",
        comment: "Bracket Rods",
      });
    }

    return items;
  },
};

/**
 * Standard Ladder — two flat-bar side rails, round-bar rungs, mounting
 * plates, and an optional safety cage (hoops + vertical straps).
 *
 * Supersedes `roof-ladder.ts` with richer variable coverage (hoop cage,
 * hoop spacing, walkthrough option). Roof ladder is kept in the library
 * for existing projects.
 */

import type { PATemplate, Item } from "../engine/types";
import { feet, inches } from "../engine/units";

export const standardLadder: PATemplate = {
  id: "standard-ladder",
  name: "Standard Ladder",
  description:
    "Two-rail access ladder with round-bar rungs, mounting brackets, and optional safety cage (hoops).",
  category: "ladder",

  variables: [
    {
      key: "ladderHeight",
      label: "Ladder Height",
      description: "Overall height (also the side-rail length).",
      type: "length",
      defaultValue: feet(16),
      required: true,
      position: 1,
      group: "geometry",
    },
    {
      key: "ladderWidth",
      label: "Ladder Width",
      description: "Inside-to-inside width between the side rails.",
      type: "length",
      defaultValue: inches(18),
      required: true,
      position: 2,
      group: "geometry",
    },
    {
      key: "walkthrough",
      label: "Walkthrough Extension",
      description:
        "Do the side rails extend past the landing for a walkthrough exit?",
      type: "enum",
      enumOptions: [
        { value: "none", label: "None — flush with landing" },
        { value: "walkthrough", label: "Walkthrough (rails extend 42\")" },
      ],
      defaultValue: "walkthrough",
      required: true,
      position: 3,
      group: "geometry",
    },

    {
      key: "sideRailSize",
      label: "Side Rail Size",
      type: "dimension",
      shapeFilter: ["FB"],
      defaultValue: "FB3X3/8",
      required: true,
      position: 10,
      group: "rails",
    },
    {
      key: "rungSize",
      label: "Rung Size",
      type: "dimension",
      shapeFilter: ["RD"],
      defaultValue: "RD3/4",
      required: true,
      position: 11,
      group: "rails",
    },
    {
      key: "rungSpacing",
      label: "Rung Spacing",
      description: "Center-to-center; OSHA max 12 in.",
      type: "length",
      defaultValue: inches(12),
      required: true,
      position: 12,
      group: "rails",
    },

    {
      key: "bracketType",
      label: "Mounting Bracket Type",
      type: "enum",
      enumOptions: [
        { value: "wall", label: "Wall-mount standoff" },
        { value: "floor", label: "Floor-mount base" },
      ],
      defaultValue: "wall",
      required: true,
      position: 20,
      group: "brackets",
    },
    {
      key: "bracketSpacing",
      label: "Max Bracket Spacing",
      type: "length",
      defaultValue: feet(4),
      required: true,
      position: 21,
      group: "brackets",
    },

    {
      key: "cage",
      label: "Safety Cage",
      description: "Hoop cage for falls protection. Required above 20 ft.",
      type: "enum",
      enumOptions: [
        { value: "no", label: "No cage" },
        { value: "yes", label: "Yes — hoop cage" },
      ],
      defaultValue: "no",
      required: true,
      position: 30,
      group: "cage",
    },
    {
      key: "hoopSpacing",
      label: "Hoop Spacing",
      type: "length",
      defaultValue: feet(4),
      position: 31,
      group: "cage",
    },
    {
      key: "hoopStraps",
      label: "Vertical Straps",
      description: "Number of vertical straps connecting the hoops.",
      type: "integer",
      defaultValue: 4,
      position: 32,
      group: "cage",
    },
  ],

  calculate: (v) => {
    const height = v.ladderHeight as number;
    const width = v.ladderWidth as number;
    const walkthrough = (v.walkthrough as string) === "walkthrough";
    const railSize = v.sideRailSize as string;
    const rungSize = v.rungSize as string;
    const rungSpacing = v.rungSpacing as number;
    const bracketType = v.bracketType as "wall" | "floor";
    const bracketSpacing = v.bracketSpacing as number;
    const hasCage = (v.cage as string) === "yes";
    const hoopSpacing = (v.hoopSpacing as number) ?? feet(4);
    const hoopStraps = Math.max(0, (v.hoopStraps as number) ?? 0);

    const railLength = height + (walkthrough ? inches(42) : 0);
    const numRungs = Math.floor(height / rungSpacing);
    const numBrackets = Math.max(2, Math.ceil(height / bracketSpacing) + 1);

    const items: Item[] = [
      {
        mainPiece: true,
        shape: "CO",
        grade: ".",
        quantity: 1,
        description: "Standard Ladder",
        erectHours: 6,
      },
      {
        shape: "FB",
        size: railSize,
        grade: "A36",
        quantity: 2,
        length: railLength,
        laborCode: "C",
        comment: "Side Rails",
        holes: numRungs,
      },
      {
        shape: "RD",
        size: rungSize,
        grade: "A36",
        quantity: numRungs,
        length: width + inches(1),
        laborCode: "R",
        comment: "Rungs",
      },
    ];

    if (bracketType === "wall") {
      items.push({
        shape: "FB",
        size: "FB3X3/8",
        grade: "A36",
        quantity: numBrackets * 2,
        length: inches(10),
        laborCode: "C",
        comment: "Wall Standoff Brackets",
        holes: 2,
      });
    } else {
      items.push({
        shape: "PL",
        size: "PL3/8",
        grade: "A36",
        quantity: 2,
        length: inches(6),
        width: inches(6),
        laborCode: "W",
        comment: "Floor Base Plates",
        holes: 4,
      });
    }

    if (hasCage) {
      const numHoops = Math.max(1, Math.floor(height / hoopSpacing));
      items.push({
        shape: "FB",
        size: "FB2X1/4",
        grade: "A36",
        quantity: numHoops,
        length: feet(8),
        laborCode: "C",
        comment: "Hoops",
      });
      if (hoopStraps > 0) {
        items.push({
          shape: "FB",
          size: "FB2X1/4",
          grade: "A36",
          quantity: hoopStraps,
          length: height - inches(84),
          laborCode: "C",
          comment: "Hoop Vertical Straps",
        });
      }
    }

    return items;
  },
};

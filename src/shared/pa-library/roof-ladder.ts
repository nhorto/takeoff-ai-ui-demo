/**
 * Roof Ladder — simple two-rail ladder with round-bar rungs and mounting plates.
 *
 * Modeled on Ricky's PowerFab PA 54 (Ladder). See
 * scripts/powerfab-schema-dump/dump/parametric_assemblies/029_Ladder.json.
 */

import type { PATemplate } from "../engine/types";
import { feet, inches } from "../engine/units";

export const roofLadder: PATemplate = {
  id: "roof-ladder",
  name: "Roof Ladder",
  description:
    "Roof-access ladder with two flat-bar side rails, round-bar rungs every 12\", and mounting plates at top and bottom.",
  category: "ladder",

  variables: [
    {
      key: "sideRailLength",
      label: "Side Rail Length",
      description: "Length of each of the two side rails (overall ladder height).",
      type: "length",
      defaultValue: feet(20),
      required: true,
      position: 1,
    },
    {
      key: "sideRailSize",
      label: "Side Rail Size",
      description: "Flat-bar designation for the side rails.",
      type: "dimension",
      shapeFilter: ["FB"],
      defaultValue: "FB3X3/8",
      required: true,
      position: 2,
    },
    {
      key: "rungSize",
      label: "Rung Size",
      description: "Round-bar designation for the rungs.",
      type: "dimension",
      shapeFilter: ["RD"],
      defaultValue: "RD3/4",
      required: true,
      position: 3,
    },
    {
      key: "rungLength",
      label: "Rung Length",
      description:
        "Length of each rung (also the ladder width, inside-to-inside of the side rails).",
      type: "length",
      defaultValue: inches(18),
      required: true,
      position: 4,
    },
    {
      key: "rungSpacing",
      label: "Rung Spacing",
      description: "Vertical distance between rung centerlines. OSHA default 12 in.",
      type: "length",
      defaultValue: inches(12),
      required: true,
      position: 5,
    },
    {
      key: "mountingPlateLength",
      label: "Mounting Plate Length",
      description: "Length of the top and bottom mounting plates.",
      type: "length",
      defaultValue: inches(12),
      required: true,
      position: 6,
    },
  ],

  calculate: (v) => {
    const railLength = v.sideRailLength as number;
    const railSize = v.sideRailSize as string;
    const rungSize = v.rungSize as string;
    const rungLength = v.rungLength as number;
    const rungSpacing = v.rungSpacing as number;
    const plateLength = v.mountingPlateLength as number;

    const numRungs = Math.floor(railLength / rungSpacing);

    return [
      {
        mainPiece: true,
        shape: "CO",
        grade: ".",
        quantity: 1,
        description: "Roof Ladder",
        erectHours: 4,
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
        shape: "FB",
        size: railSize,
        grade: "A36",
        quantity: 2,
        length: plateLength,
        laborCode: "C",
        comment: "Mounting Plates",
        holes: 1,
      },
      {
        shape: "RD",
        size: rungSize,
        grade: "A36",
        quantity: numRungs,
        length: rungLength,
        laborCode: "R",
        comment: "Rungs",
      },
      {
        shape: "L",
        size: "L2X2X1/4",
        grade: "A36",
        quantity: 2,
        length: inches(3),
        laborCode: "A",
        comment: "Bottom Angles",
        holes: 1,
      },
    ];
  },
};

/**
 * Stair Channel — a channel-stringer stair with pan treads, jacks, and clips.
 *
 * Modeled on Ricky's PowerFab PA 29 (Stair Channel). See
 * scripts/powerfab-schema-dump/dump/parametric_assemblies/008_Stair_Channel.json
 * for the original.
 *
 * See docs/plans/01-pa-engine.md §6 for the worked example.
 */

import type { PATemplate } from "../engine/types";
import { feet, ftIn, inches } from "../engine/units";

export const stairChannel: PATemplate = {
  id: "stair-channel",
  name: "Stair Channel",
  description:
    "Channel-stringer stair with pan treads. Two stringers, jacks, tread pans, cap plates, and clips.",
  category: "stair",

  variables: [
    {
      key: "heightBetweenLandings",
      label: "Height Between Landings",
      description:
        "Vertical distance from the lower landing surface to the upper landing surface.",
      type: "length",
      defaultValue: feet(10),
      required: true,
      position: 1,
    },
    {
      key: "stairWidth",
      label: "Stair Width",
      description: "Width of the treads (also the overall stair width).",
      type: "length",
      defaultValue: ftIn(3, 6),
      required: true,
      position: 2,
    },
    {
      key: "stringerSize",
      label: "Stringer Size",
      description: "Channel size for the two stringers.",
      type: "dimension",
      shapeFilter: ["C", "MC"],
      defaultValue: "C12X20.7",
      required: true,
      position: 3,
    },
    {
      key: "riserHeight",
      label: "Riser Height",
      description:
        "Vertical distance between treads. Commercial default 6.75 in.",
      type: "length",
      defaultValue: inches(6.75),
      required: true,
      position: 4,
    },
    {
      key: "treadDepth",
      label: "Tread Depth",
      description: "Horizontal run of each tread. Commercial default 11 in.",
      type: "length",
      defaultValue: inches(11),
      required: true,
      position: 5,
    },
  ],

  calculate: (v) => {
    const height = v.heightBetweenLandings as number;
    const width = v.stairWidth as number;
    const stringerSize = v.stringerSize as string;
    const riser = v.riserHeight as number;
    const run = v.treadDepth as number;

    const numTreads = Math.floor(height / riser);
    const horizontalRun = numTreads * run;
    const stringerLength =
      Math.sqrt(height * height + horizontalRun * horizontalRun) + inches(1);

    return [
      {
        mainPiece: true,
        shape: "CO",
        grade: ".",
        quantity: 1,
        description: "Stair",
        erectHours: 40,
      },
      {
        shape: "C",
        size: stringerSize,
        grade: "A36",
        quantity: 2,
        length: stringerLength,
        laborCode: "M",
        comment: "Stringer",
      },
      {
        shape: "L",
        size: "L3X3X1/4",
        grade: "A36",
        quantity: numTreads * 2,
        length: inches(9),
        laborCode: "Y",
        comment: "Jacks",
      },
      {
        shape: "PL",
        size: "PL14GA",
        grade: "A36",
        quantity: numTreads,
        length: width,
        width: run,
        laborCode: "JJ",
        comment: "Tread Pans",
      },
      {
        shape: "PL",
        size: "PL3/8",
        grade: "A36",
        quantity: 3,
        length: inches(12),
        width: inches(2),
        laborCode: "W",
        comment: "Caps",
      },
      {
        shape: "L",
        size: "L2X2X1/4",
        grade: "A36",
        quantity: 2,
        length: inches(12),
        laborCode: "Y",
        comment: "Clips",
      },
    ];
  },
};

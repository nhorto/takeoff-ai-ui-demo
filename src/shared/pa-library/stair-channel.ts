/**
 * Stair Channel — a channel-stringer stair with pan treads, jacks, and clips.
 *
 * Visible to the estimator: the few numbers they can read off a drawing.
 *   - numTreads, numRisers, stairWidth
 *
 * Hidden (company defaults): everything else — riser height, tread depth,
 * stringer size, grades, labor codes. The engine falls back to defaultValue
 * when the form doesn't provide a value, so these just live here.
 *
 * See docs/architecture/parametric-assembly-product-direction.md for the
 * vision this rewrite is built against.
 */

import type { PATemplate } from "../engine/types";
import { ftIn, inches } from "../engine/units";

export const stairChannel: PATemplate = {
  id: "stair-channel",
  name: "Stair Channel",
  description:
    "Channel-stringer stair with pan treads. Two stringers, jacks, tread pans, cap plates, and clips.",
  category: "stair",

  variables: [
    // ─── Visible to the estimator ──────────────────────────────────────────
    {
      key: "numTreads",
      label: "Number of Treads",
      description: "Total treads on the flight.",
      type: "integer",
      defaultValue: 14,
      required: true,
      position: 1,
    },
    {
      key: "numRisers",
      label: "Number of Risers",
      description:
        "Total risers on the flight. Typically one more than the number of treads.",
      type: "integer",
      defaultValue: 15,
      required: true,
      position: 2,
    },
    {
      key: "stairWidth",
      label: "Stair Width",
      description: "Width of the treads (also the overall stair width).",
      type: "length",
      defaultValue: ftIn(3, 6),
      required: true,
      position: 3,
    },

    // ─── Hidden company defaults ───────────────────────────────────────────
    {
      key: "riserHeight",
      label: "Riser Height",
      type: "length",
      defaultValue: inches(6.75),
      hidden: true,
    },
    {
      key: "treadDepth",
      label: "Tread Depth",
      type: "length",
      defaultValue: inches(11),
      hidden: true,
    },
    {
      key: "stringerSize",
      label: "Stringer Size",
      type: "dimension",
      shapeFilter: ["C", "MC"],
      defaultValue: "C12X20.7",
      hidden: true,
    },
  ],

  calculate: (v) => {
    const numTreads = v.numTreads as number;
    const numRisers = v.numRisers as number;
    const width = v.stairWidth as number;
    const riser = v.riserHeight as number;
    const run = v.treadDepth as number;
    const stringerSize = v.stringerSize as string;

    const height = numRisers * riser;
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

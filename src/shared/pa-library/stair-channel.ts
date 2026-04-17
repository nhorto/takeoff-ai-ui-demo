/**
 * Stair Channel — a channel-stringer stair with pan treads, jacks, and clips.
 *
 * Visible to the estimator: the few numbers they can read off a drawing,
 * plus stringer material/size, dogleg toggle, and tread type.
 *
 * Hidden (company defaults): riser height, tread depth, plate thicknesses,
 * grades, labor codes. The engine falls back to defaultValue when the form
 * doesn't provide a value, so these just live here.
 *
 * Variables are tagged with `group` so the flight editor tabs can partition
 * them into Geometry / Stringers / Treads.
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
    // ─── Geometry ──────────────────────────────────────────────────────────
    {
      key: "numTreads",
      label: "Number of Treads",
      description: "Total treads on the flight.",
      type: "integer",
      defaultValue: 14,
      required: true,
      position: 1,
      group: "geometry",
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
      group: "geometry",
    },
    {
      key: "stairWidth",
      label: "Stair Width",
      description: "Width of the treads (also the overall stair width).",
      type: "length",
      defaultValue: ftIn(3, 6),
      required: true,
      position: 3,
      group: "geometry",
    },
    {
      key: "riserHeight",
      label: "Riser Height",
      type: "length",
      defaultValue: inches(6.75),
      hidden: true,
      group: "geometry",
    },
    {
      key: "treadDepth",
      label: "Tread Depth",
      type: "length",
      defaultValue: inches(11),
      hidden: true,
      group: "geometry",
    },

    // ─── Stringers ─────────────────────────────────────────────────────────
    {
      key: "stringerSize",
      label: "Stringer Size",
      description: "Shape used for both stringers.",
      type: "dimension",
      shapeFilter: ["C", "MC", "HSS", "PL"],
      defaultValue: "C12X20.7",
      required: true,
      position: 10,
      group: "stringers",
    },
    {
      key: "stringerGrade",
      label: "Stringer Grade",
      type: "enum",
      enumOptions: [
        { value: "A36", label: "A36 (paint)" },
        { value: "A572", label: "A572 Gr. 50" },
        { value: "A36-GAL", label: "A36 (galvanized)" },
      ],
      defaultValue: "A36",
      required: true,
      position: 11,
      group: "stringers",
    },
    {
      key: "dogleg",
      label: "Dogleg",
      description:
        "Does the stringer kink at the top/bottom to land flush on the landing?",
      type: "enum",
      enumOptions: [
        { value: "no", label: "No — straight stringer" },
        { value: "yes", label: "Yes — doglegged stringer" },
      ],
      defaultValue: "no",
      required: true,
      position: 12,
      group: "stringers",
    },

    // ─── Treads ────────────────────────────────────────────────────────────
    {
      key: "treadType",
      label: "Tread Type",
      description: "Which tread assembly sits in the stringer pockets.",
      type: "enum",
      enumOptions: [
        { value: "pan", label: "Pan (PL14GA + concrete fill)" },
        { value: "checker-plate", label: "Checker plate" },
        { value: "grating", label: "Bar grating" },
      ],
      defaultValue: "pan",
      required: true,
      position: 20,
      group: "treads",
    },
    {
      key: "panGauge",
      label: "Pan Gauge",
      type: "dimension",
      shapeFilter: ["PL"],
      defaultValue: "PL14GA",
      hidden: true,
      group: "treads",
    },
    {
      key: "checkerPlateSize",
      label: "Checker Plate Thickness",
      type: "dimension",
      shapeFilter: ["PL"],
      defaultValue: "PL1/4",
      hidden: true,
      group: "treads",
    },
    {
      key: "gratingSize",
      label: "Grating Size",
      type: "dimension",
      defaultValue: "GR1-1/4X3/16",
      hidden: true,
      group: "treads",
    },
  ],

  calculate: (v) => {
    const numTreads = v.numTreads as number;
    const numRisers = v.numRisers as number;
    const width = v.stairWidth as number;
    const riser = v.riserHeight as number;
    const run = v.treadDepth as number;
    const stringerSize = v.stringerSize as string;
    const stringerGrade = (v.stringerGrade as string) ?? "A36";
    const dogleg = (v.dogleg as string) === "yes";
    const treadType = (v.treadType as string) ?? "pan";

    const height = numRisers * riser;
    const horizontalRun = numTreads * run;
    // Stringer is the hypotenuse of rise × run, plus a small connection
    // allowance: 1" for a straight stringer, 6" for a doglegged one (extra
    // steel to cover the kink at the dogleg joint).
    const stringerLength =
      Math.sqrt(height * height + horizontalRun * horizontalRun) +
      inches(dogleg ? 6 : 1);

    const treadItem = (() => {
      if (treadType === "checker-plate") {
        return {
          shape: "PL",
          size: v.checkerPlateSize as string,
          grade: "A36",
          quantity: numTreads,
          length: width,
          width: run,
          laborCode: "JJ",
          comment: "Checker Plate Treads",
        };
      }
      if (treadType === "grating") {
        return {
          shape: "GR",
          size: v.gratingSize as string,
          grade: "A1011",
          quantity: numTreads,
          length: width,
          width: run,
          laborCode: "GG",
          comment: "Grating Treads",
        };
      }
      return {
        shape: "PL",
        size: v.panGauge as string,
        grade: "A36",
        quantity: numTreads,
        length: width,
        width: run,
        laborCode: "JJ",
        comment: "Tread Pans",
      };
    })();

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
        grade: stringerGrade,
        quantity: 2,
        length: stringerLength,
        laborCode: "M",
        comment: dogleg ? "Stringer (doglegged)" : "Stringer",
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
      treadItem,
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

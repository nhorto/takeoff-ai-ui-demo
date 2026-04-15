/**
 * HSS Rail with Pickets — top, bottom, and optional mid rails, pickets
 * between rails, and posts. Supports 0, 1, or 2 turns (up to 3 sections).
 *
 * Modeled on Ricky's PowerFab PA 32 (HSS Rail w/Pickets). The original
 * stored three fixed section dimensions and used IF-on-Number-of-Turns
 * to zero out unused sections; our version uses a real sections array
 * inside calculate() so the code reads like what it is.
 */

import type { PATemplate, Item } from "../engine/types";
import { feet, inches } from "../engine/units";

export const hssRailPickets: PATemplate = {
  id: "hss-rail-pickets",
  name: "HSS Rail with Pickets",
  description:
    "HSS handrail with top rail, bottom rail, optional mid rails, pickets, and posts. Supports straight runs and L/U-shaped runs with up to two turns.",
  category: "rail",

  variables: [
    {
      key: "section1Length",
      label: "Section 1 Length",
      description: "Length of the first (longest) straight run of rail.",
      type: "length",
      defaultValue: feet(10),
      required: true,
      position: 1,
    },
    {
      key: "numberOfTurns",
      label: "Number of Turns",
      description: "Additional sections after Section 1. 0 = straight run.",
      type: "integer",
      defaultValue: 0,
      required: true,
      position: 2,
    },
    {
      key: "section2Length",
      label: "Section 2 Length",
      description: "Length of the second section (only used if Number of Turns ≥ 1).",
      type: "length",
      defaultValue: feet(1),
      position: 3,
    },
    {
      key: "section3Length",
      label: "Section 3 Length",
      description: "Length of the third section (only used if Number of Turns ≥ 2).",
      type: "length",
      defaultValue: feet(1),
      position: 4,
    },
    {
      key: "topMaterial",
      label: "Top Rail Size",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS2X2X1/4",
      required: true,
      position: 5,
    },
    {
      key: "bottomMaterial",
      label: "Bottom Rail Size",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS2X2X1/4",
      required: true,
      position: 6,
    },
    {
      key: "midMaterial",
      label: "Mid Rail Size",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS1X1X1/8",
      position: 7,
    },
    {
      key: "numberOfMidRunners",
      label: "Number of Mid Runners",
      type: "integer",
      defaultValue: 0,
      required: true,
      position: 8,
    },
    {
      key: "postMaterial",
      label: "Post Size",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS2X2X1/4",
      required: true,
      position: 9,
    },
    {
      key: "postLength",
      label: "Post Length",
      type: "length",
      defaultValue: inches(42),
      required: true,
      position: 10,
    },
    {
      key: "postSpacing",
      label: "Post Spacing",
      description: "Center-to-center spacing between posts.",
      type: "length",
      defaultValue: feet(4),
      required: true,
      position: 11,
    },
    {
      key: "pickets",
      label: "Pickets",
      description: "Do we have pickets between top and bottom rails?",
      type: "enum",
      enumOptions: [
        { value: "yes", label: "Yes — pickets between rails" },
        { value: "no", label: "No — open rail" },
      ],
      defaultValue: "yes",
      required: true,
      position: 12,
    },
    {
      key: "pickMaterial",
      label: "Picket Size",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS1X1X1/8",
      position: 13,
    },
    {
      key: "pickLength",
      label: "Picket Length",
      type: "length",
      defaultValue: inches(36),
      position: 14,
    },
    {
      key: "pickSpacing",
      label: "Picket Spacing",
      type: "length",
      defaultValue: inches(4),
      position: 15,
    },
  ],

  calculate: (v) => {
    const turns = Math.max(0, Math.floor((v.numberOfTurns as number) ?? 0));
    const s1 = v.section1Length as number;
    const s2 = (v.section2Length as number) ?? 0;
    const s3 = (v.section3Length as number) ?? 0;

    const sections: number[] = [s1];
    if (turns >= 1) sections.push(s2);
    if (turns >= 2) sections.push(s3);

    const topSize = v.topMaterial as string;
    const botSize = v.bottomMaterial as string;
    const midSize = v.midMaterial as string;
    const midRunners = v.numberOfMidRunners as number;
    const postSize = v.postMaterial as string;
    const postLength = v.postLength as number;
    const postSpacing = v.postSpacing as number;
    const hasPickets = (v.pickets as string) === "yes";
    const pickSize = v.pickMaterial as string;
    const pickLength = v.pickLength as number;
    const pickSpacing = v.pickSpacing as number;

    const items: Item[] = [
      {
        mainPiece: true,
        shape: "CO",
        grade: ".",
        quantity: 1,
        description: "HSS Rail",
        erectHours: 2,
      },
    ];

    sections.forEach((sectionLength, index) => {
      const n = index + 1;
      const bays = Math.max(1, Math.ceil(sectionLength / postSpacing));
      const bayLength = sectionLength / bays + inches(1);

      // Top rail — one full-length piece per section.
      items.push({
        shape: "HSS",
        size: topSize,
        grade: "A500",
        quantity: 1,
        length: sectionLength,
        laborCode: "H",
        comment: `S${n} Top Rail`,
        erectHours: (sectionLength / inches(12)) * 0.17,
      });

      // Bottom rail — one per bay, slightly over bay length for fit-up.
      items.push({
        shape: "HSS",
        size: botSize,
        grade: "A500",
        quantity: bays,
        length: bayLength,
        laborCode: "H",
        comment: `S${n} Bottom Rail`,
      });

      // Mid rails — stacked runners if configured.
      if (midRunners > 0) {
        items.push({
          shape: "HSS",
          size: midSize,
          grade: "A500",
          quantity: bays * midRunners,
          length: bayLength,
          laborCode: "H",
          comment: `S${n} Mid Rail`,
        });
      }

      // Pickets between rails, every `pickSpacing`.
      if (hasPickets) {
        items.push({
          shape: "HSS",
          size: pickSize,
          grade: "A500",
          quantity: Math.ceil(sectionLength / pickSpacing),
          length: pickLength,
          laborCode: "H",
          comment: `S${n} Pickets`,
        });
      }

      // Posts — one per bay edge. The first section provides posts at both
      // ends; subsequent sections share a post with the previous section.
      items.push({
        shape: "HSS",
        size: postSize,
        grade: "A500",
        quantity: bays + (index === 0 ? 1 : 0),
        length: postLength,
        laborCode: "H",
        comment: `S${n} Posts`,
      });
    });

    // Base plates — one per post across the whole run.
    const totalPosts = items
      .filter((item) => item.comment?.endsWith("Posts"))
      .reduce((sum, item) => sum + item.quantity, 0);

    items.push({
      shape: "PL",
      size: "PL1/4",
      grade: "A36",
      quantity: totalPosts,
      length: inches(4),
      width: inches(4),
      laborCode: "W",
      comment: "Base Plates",
      holes: 4,
    });

    return items;
  },
};

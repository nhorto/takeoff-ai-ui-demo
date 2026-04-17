/**
 * Multi-Line Rail — top and bottom rails with N horizontal runners between
 * them (no pickets). Runners are continuous across each section.
 */

import type { PATemplate, Item } from "../engine/types";
import { feet, inches } from "../engine/units";
import { mountingOptions } from "./rail-shared";

export const multiLineRail: PATemplate = {
  id: "multi-line-rail",
  name: "Multi-Line Rail",
  description:
    "HSS handrail with top and bottom rails plus horizontal runners between posts. Supports straight runs and L/U-shaped runs with up to two turns.",
  category: "rail",

  variables: [
    {
      key: "section1Length",
      label: "Section 1 Length",
      type: "length",
      defaultValue: feet(10),
      required: true,
      position: 1,
      group: "geometry",
    },
    {
      key: "numberOfTurns",
      label: "Number of Turns",
      type: "integer",
      defaultValue: 0,
      required: true,
      position: 2,
      group: "geometry",
    },
    {
      key: "section2Length",
      label: "Section 2 Length",
      type: "length",
      defaultValue: feet(1),
      position: 3,
      group: "geometry",
    },
    {
      key: "section3Length",
      label: "Section 3 Length",
      type: "length",
      defaultValue: feet(1),
      position: 4,
      group: "geometry",
    },

    {
      key: "topMaterial",
      label: "Top Rail Size",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS2X2X1/4",
      required: true,
      position: 5,
      group: "rails",
    },
    {
      key: "bottomMaterial",
      label: "Bottom Rail Size",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS2X2X1/4",
      required: true,
      position: 6,
      group: "rails",
    },
    {
      key: "runnerMaterial",
      label: "Runner Size",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS1X1X1/8",
      required: true,
      position: 7,
      group: "rails",
    },
    {
      key: "numberOfRunners",
      label: "Number of Runners",
      description: "Horizontal runners between top and bottom rails.",
      type: "integer",
      defaultValue: 3,
      required: true,
      position: 8,
      group: "rails",
    },

    {
      key: "postMaterial",
      label: "Post Size",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS2X2X1/4",
      required: true,
      position: 9,
      group: "posts",
    },
    {
      key: "postLength",
      label: "Post Length",
      type: "length",
      defaultValue: inches(42),
      required: true,
      position: 10,
      group: "posts",
    },
    {
      key: "postSpacing",
      label: "Max Post Spacing",
      type: "length",
      defaultValue: feet(5),
      required: true,
      position: 11,
      group: "posts",
    },
    {
      key: "mounting",
      label: "Mounting",
      type: "enum",
      enumOptions: mountingOptions(),
      defaultValue: "baseplate",
      required: true,
      position: 12,
      group: "posts",
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
    const runnerSize = v.runnerMaterial as string;
    const runners = Math.max(0, (v.numberOfRunners as number) ?? 0);
    const postSize = v.postMaterial as string;
    const postLength = v.postLength as number;
    const postSpacing = v.postSpacing as number;

    const items: Item[] = [
      {
        mainPiece: true,
        shape: "CO",
        grade: ".",
        quantity: 1,
        description: "Multi-Line Rail",
        erectHours: 2,
      },
    ];

    sections.forEach((sectionLength, index) => {
      const n = index + 1;
      const bays = Math.max(1, Math.ceil(sectionLength / postSpacing));
      const bayLength = sectionLength / bays + inches(1);

      // Top rail is one continuous stick per section. Bottom rail and
      // runners break at each post so they're counted per-bay with a 1"
      // cut-to-fit allowance — this matches how the shop lays out the
      // piece, not a quirk of the formula.
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

      items.push({
        shape: "HSS",
        size: botSize,
        grade: "A500",
        quantity: bays,
        length: bayLength,
        laborCode: "H",
        comment: `S${n} Bottom Rail`,
      });

      if (runners > 0) {
        items.push({
          shape: "HSS",
          size: runnerSize,
          grade: "A500",
          quantity: bays * runners,
          length: bayLength,
          laborCode: "H",
          comment: `S${n} Runners`,
        });
      }

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

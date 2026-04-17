/**
 * Cable Rail — top rail with tensioned cables running between end posts.
 * Cables replace pickets/runners; end posts take the tension so they're
 * typically heavier than intermediate posts.
 *
 * No turns: cable tension requires a continuous straight run between two
 * end posts. L- or U-shaped cable rails are modeled as separate cable-rail
 * assignments on separate flights — not as a multi-section template like
 * multi-line-rail or hss-rail-pickets.
 */

import type { PATemplate, Item } from "../engine/types";
import { feet, inches } from "../engine/units";
import { mountingOptions } from "./rail-shared";

export const cableRail: PATemplate = {
  id: "cable-rail",
  name: "Cable Rail",
  description:
    "Top rail with stainless-cable infill between posts. Tensioned through end posts — straight runs only.",
  category: "rail",

  variables: [
    {
      key: "sectionLength",
      label: "Section Length",
      description: "Total horizontal run between end posts.",
      type: "length",
      defaultValue: feet(10),
      required: true,
      position: 1,
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
      key: "cableSize",
      label: "Cable Diameter",
      type: "dimension",
      shapeFilter: ["CA"],
      defaultValue: "CA1/8",
      required: true,
      position: 6,
      group: "rails",
    },
    {
      key: "numberOfCables",
      label: "Number of Cables",
      description: "Vertical stack of horizontal cables.",
      type: "integer",
      defaultValue: 10,
      required: true,
      position: 7,
      group: "rails",
    },

    {
      key: "endPostMaterial",
      label: "End Post Size",
      description: "Heavier posts at each end to take cable tension.",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS3X3X1/4",
      required: true,
      position: 9,
      group: "posts",
    },
    {
      key: "intermediatePostMaterial",
      label: "Intermediate Post Size",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS2X2X1/4",
      required: true,
      position: 10,
      group: "posts",
    },
    {
      key: "postLength",
      label: "Post Length",
      type: "length",
      defaultValue: inches(42),
      required: true,
      position: 11,
      group: "posts",
    },
    {
      key: "postSpacing",
      label: "Max Post Spacing",
      type: "length",
      defaultValue: feet(4),
      required: true,
      position: 12,
      group: "posts",
    },
    {
      key: "mounting",
      label: "Mounting",
      type: "enum",
      enumOptions: mountingOptions(),
      defaultValue: "baseplate",
      required: true,
      position: 13,
      group: "posts",
    },
  ],

  calculate: (v) => {
    const sectionLength = v.sectionLength as number;
    const topSize = v.topMaterial as string;
    const cableSize = v.cableSize as string;
    const cables = Math.max(0, (v.numberOfCables as number) ?? 0);
    const endPostSize = v.endPostMaterial as string;
    const intPostSize = v.intermediatePostMaterial as string;
    const postLength = v.postLength as number;
    const postSpacing = v.postSpacing as number;

    const bays = Math.max(1, Math.ceil(sectionLength / postSpacing));
    const intermediatePosts = Math.max(0, bays - 1);

    const items: Item[] = [
      {
        mainPiece: true,
        shape: "CO",
        grade: ".",
        quantity: 1,
        description: "Cable Rail",
        erectHours: 3,
      },
      {
        shape: "HSS",
        size: topSize,
        grade: "A500",
        quantity: 1,
        length: sectionLength,
        laborCode: "H",
        comment: "Top Rail",
        erectHours: (sectionLength / inches(12)) * 0.17,
      },
      {
        shape: "HSS",
        size: endPostSize,
        grade: "A500",
        quantity: 2,
        length: postLength,
        laborCode: "H",
        comment: "End Posts",
      },
      {
        shape: "CA",
        size: cableSize,
        grade: "316SS",
        quantity: cables,
        length: sectionLength,
        laborCode: "X",
        comment: "Cables",
      },
    ];

    if (intermediatePosts > 0) {
      items.push({
        shape: "HSS",
        size: intPostSize,
        grade: "A500",
        quantity: intermediatePosts,
        length: postLength,
        laborCode: "H",
        comment: "Intermediate Posts",
      });
    }

    items.push({
      shape: "PL",
      size: "PL3/8",
      grade: "A36",
      quantity: 2,
      length: inches(6),
      width: inches(6),
      laborCode: "W",
      comment: "End Post Base Plates",
      holes: 4,
    });

    if (intermediatePosts > 0) {
      items.push({
        shape: "PL",
        size: "PL1/4",
        grade: "A36",
        quantity: intermediatePosts,
        length: inches(4),
        width: inches(4),
        laborCode: "W",
        comment: "Intermediate Base Plates",
        holes: 4,
      });
    }

    return items;
  },
};

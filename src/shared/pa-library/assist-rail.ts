/**
 * Assist Rail — a short grab/assist rail, typically near a door threshold
 * or accessible route. Free-standing on one or two posts, not a full run.
 */

import type { PATemplate, Item } from "../engine/types";
import { feet, inches } from "../engine/units";
import { mountingOptions } from "./rail-shared";

export const assistRail: PATemplate = {
  id: "assist-rail",
  name: "Assist Rail",
  description:
    "Short grab/assist rail on one or two posts. Used at accessible thresholds, ramps, or single-step transitions.",
  category: "rail",

  variables: [
    {
      key: "railLength",
      label: "Rail Length",
      type: "length",
      defaultValue: feet(3),
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
      key: "bracketType",
      label: "Bracket Type",
      type: "enum",
      enumOptions: [
        { value: "buyout", label: "Buyout" },
        { value: "plate-and-rod", label: "Plate and Rod" },
      ],
      defaultValue: "plate-and-rod",
      required: true,
      position: 6,
      group: "rails",
    },
    {
      key: "endCondition",
      label: "End Condition",
      type: "enum",
      enumOptions: [
        { value: "cap", label: "Cap" },
        { value: "terminate-to-rail", label: "Terminate to rail" },
        { value: "extension", label: "Extension" },
      ],
      defaultValue: "terminate-to-rail",
      required: true,
      position: 7,
      group: "rails",
    },

    {
      key: "postMaterial",
      label: "Post Size",
      type: "dimension",
      shapeFilter: ["HSSR", "PIPE"],
      defaultValue: "PIPE1-1/2",
      required: true,
      position: 9,
      group: "posts",
    },
    {
      key: "postLength",
      label: "Post Length",
      type: "length",
      defaultValue: inches(36),
      required: true,
      position: 10,
      group: "posts",
    },
    {
      key: "numberOfPosts",
      label: "Number of Posts",
      type: "integer",
      defaultValue: 2,
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
    const railLength = v.railLength as number;
    const railSize = v.railMaterial as string;
    const postSize = v.postMaterial as string;
    const postLength = v.postLength as number;
    const numPosts = Math.max(1, (v.numberOfPosts as number) ?? 2);

    const items: Item[] = [
      {
        mainPiece: true,
        shape: "CO",
        grade: ".",
        quantity: 1,
        description: "Assist Rail",
        erectHours: 1,
      },
      {
        shape: "PIPE",
        size: railSize,
        grade: "A53",
        quantity: 1,
        length: railLength,
        laborCode: "H",
        comment: "Rail",
      },
      {
        shape: "PIPE",
        size: postSize,
        grade: "A53",
        quantity: numPosts,
        length: postLength,
        laborCode: "H",
        comment: "Posts",
      },
      {
        shape: "PL",
        size: "PL1/4",
        grade: "A36",
        quantity: numPosts,
        length: inches(4),
        width: inches(4),
        laborCode: "W",
        comment: "Base Plates",
        holes: 4,
      },
    ];

    return items;
  },
};

/**
 * Landing Channel — a channel-frame stair landing with cross members and
 * a selectable floor type (deck, floor plate, or bent plate).
 *
 * Modeled on Ricky's PowerFab PA (012_Landing_Channel).
 */

import type { PATemplate } from "../engine/types";
import { feet, inches } from "../engine/units";

export const landingChannel: PATemplate = {
  id: "landing-channel",
  name: "Landing Channel",
  description:
    "Channel-frame landing: three-sided frame, front channel, angle cross members, and a selectable floor type.",
  category: "landing",

  variables: [
    {
      key: "widthOfLanding",
      label: "Width of Landing",
      type: "length",
      defaultValue: feet(4),
      required: true,
      position: 1,
    },
    {
      key: "depthOfLanding",
      label: "Depth of Landing",
      type: "length",
      defaultValue: feet(4),
      required: true,
      position: 2,
    },
    {
      key: "frameSize",
      label: "Frame Channel Size",
      description: "Channel for the three-sided frame (back and sides).",
      type: "dimension",
      shapeFilter: ["C", "MC"],
      defaultValue: "C12X20.7",
      required: true,
      position: 3,
    },
    {
      key: "frontSize",
      label: "Front Channel Size",
      description: "Channel for the open front edge of the landing.",
      type: "dimension",
      shapeFilter: ["C", "MC"],
      defaultValue: "C8X11.5",
      required: true,
      position: 4,
    },
    {
      key: "crossMemberSize",
      label: "Cross Member Size",
      description: "Angle size for the cross members running depth-wise.",
      type: "dimension",
      shapeFilter: ["L"],
      defaultValue: "L3X3X1/4",
      required: true,
      position: 5,
    },
    {
      key: "flooring",
      label: "Flooring",
      description: "Landing floor material.",
      type: "enum",
      enumOptions: [
        { value: "deck", label: "Deck (ribbed metal decking)" },
        { value: "floor-plate", label: "Floor plate (1/4\" PL)" },
        { value: "bent-plate", label: "Bent plate" },
      ],
      defaultValue: "deck",
      required: true,
      position: 6,
    },
    {
      key: "connectionType",
      label: "Connection Type",
      description: "How the landing connects to the supporting structure.",
      type: "enum",
      enumOptions: [
        { value: "clips", label: "Angle clips (bolted)" },
        { value: "welded", label: "Welded" },
      ],
      defaultValue: "clips",
      required: true,
      position: 7,
    },
  ],

  calculate: (v) => {
    const width = v.widthOfLanding as number;
    const depth = v.depthOfLanding as number;
    const frameSize = v.frameSize as string;
    const frontSize = v.frontSize as string;
    const crossMemberSize = v.crossMemberSize as string;
    const flooring = v.flooring as "deck" | "floor-plate" | "bent-plate";
    const connection = v.connectionType as "clips" | "welded";

    const items = [];

    items.push({
      mainPiece: true,
      shape: "CO",
      grade: ".",
      quantity: 1,
      description: "Landing",
      erectHours: 8,
    });

    // Back of landing — one channel spanning the width.
    items.push({
      shape: "C",
      size: frameSize,
      grade: "A36",
      quantity: 1,
      length: width,
      laborCode: "M",
      comment: "Back of Landing",
    });

    // Sides — two channels spanning the depth.
    items.push({
      shape: "C",
      size: frameSize,
      grade: "A36",
      quantity: 2,
      length: depth,
      laborCode: "M",
      comment: "Sides of Landing",
    });

    // Front — one channel (typically smaller) spanning the width.
    items.push({
      shape: "C",
      size: frontSize,
      grade: "A36",
      quantity: 1,
      length: width,
      laborCode: "M",
      comment: "Front of Landing",
    });

    // Cross members — one per 2 ft of width, running depth-wise.
    const crossCount = Math.max(1, Math.floor(width / feet(2)));
    items.push({
      shape: "L",
      size: crossMemberSize,
      grade: "A36",
      quantity: crossCount,
      length: depth,
      laborCode: "Y",
      comment: "Cross Members",
    });

    // Floor — one of three flavors, emitted only when selected.
    if (flooring === "deck") {
      items.push({
        shape: "DK",
        size: "1.5B",
        grade: "A653",
        quantity: Math.ceil(depth / feet(3)),
        length: width,
        comment: "Landing Deck",
      });
    } else if (flooring === "floor-plate") {
      items.push({
        shape: "PL",
        size: "PL1/4",
        grade: "A36",
        quantity: 1,
        length: width,
        width: depth,
        laborCode: "JJ",
        comment: "Landing Floor Plate",
      });
    } else if (flooring === "bent-plate") {
      const panelsDeep = Math.max(1, Math.ceil(depth / feet(5)));
      const panelsWide = Math.max(1, Math.ceil(width / feet(10)));
      items.push({
        shape: "PL",
        size: "PL1/4",
        grade: "A36",
        quantity: panelsDeep + panelsWide,
        length: width / panelsWide,
        width: depth / panelsDeep,
        laborCode: "JJ",
        comment: "Landing Bent Plate",
      });
    }

    // Connection — clips only if selected.
    if (connection === "clips") {
      items.push({
        shape: "L",
        size: "L3X3X1/4",
        grade: "A36",
        quantity: 6,
        length: inches(6),
        laborCode: "A",
        comment: "Angle Clips",
        erectHours: 0.5,
      });
    }

    return items;
  },
};

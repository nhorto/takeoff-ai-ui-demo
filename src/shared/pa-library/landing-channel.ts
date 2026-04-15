/**
 * Landing Channel — a channel-frame stair landing with cross members and
 * a selectable floor type (deck, floor plate, or bent plate).
 *
 * Visible to the estimator: width + depth. That's what they read off a drawing.
 * Hidden (company defaults): frame size, front channel, cross members,
 * flooring, connection type. The engine falls back to defaultValue.
 *
 * See docs/architecture/parametric-assembly-product-direction.md for the
 * vision this rewrite is built against.
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
    // ─── Visible to the estimator ──────────────────────────────────────────
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

    // ─── Hidden company defaults ───────────────────────────────────────────
    {
      key: "frameSize",
      label: "Frame Channel Size",
      type: "dimension",
      shapeFilter: ["C", "MC"],
      defaultValue: "C12X20.7",
      hidden: true,
    },
    {
      key: "frontSize",
      label: "Front Channel Size",
      type: "dimension",
      shapeFilter: ["C", "MC"],
      defaultValue: "C8X11.5",
      hidden: true,
    },
    {
      key: "crossMemberSize",
      label: "Cross Member Size",
      type: "dimension",
      shapeFilter: ["L"],
      defaultValue: "L3X3X1/4",
      hidden: true,
    },
    {
      key: "flooring",
      label: "Flooring",
      type: "enum",
      enumOptions: [
        { value: "deck", label: "Deck (ribbed metal decking)" },
        { value: "floor-plate", label: "Floor plate (1/4\" PL)" },
        { value: "bent-plate", label: "Bent plate" },
      ],
      defaultValue: "deck",
      hidden: true,
    },
    {
      key: "connectionType",
      label: "Connection Type",
      type: "enum",
      enumOptions: [
        { value: "clips", label: "Angle clips (bolted)" },
        { value: "welded", label: "Welded" },
      ],
      defaultValue: "clips",
      hidden: true,
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

    items.push({
      shape: "C",
      size: frameSize,
      grade: "A36",
      quantity: 1,
      length: width,
      laborCode: "M",
      comment: "Back of Landing",
    });

    items.push({
      shape: "C",
      size: frameSize,
      grade: "A36",
      quantity: 2,
      length: depth,
      laborCode: "M",
      comment: "Sides of Landing",
    });

    items.push({
      shape: "C",
      size: frontSize,
      grade: "A36",
      quantity: 1,
      length: width,
      laborCode: "M",
      comment: "Front of Landing",
    });

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

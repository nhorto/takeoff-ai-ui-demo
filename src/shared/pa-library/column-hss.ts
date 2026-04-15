/**
 * HSS Column — hollow structural section column with base plate, cap plate,
 * optional stabilizer plates, and optional shear tabs.
 *
 * Modeled on the HSS variant of Ricky's PowerFab PA 43 (Columns Pipe / Channel).
 */

import type { PATemplate } from "../engine/types";
import { feet, inches } from "../engine/units";

export const columnHss: PATemplate = {
  id: "column-hss",
  name: "HSS Column",
  description:
    "Hollow-section column with base plate, cap plate, optional stabilizer plates, and optional shear tabs.",
  category: "column",

  variables: [
    {
      key: "columnHeight",
      label: "Column Height",
      type: "length",
      defaultValue: feet(12),
      required: true,
      position: 1,
    },
    {
      key: "hssSize",
      label: "HSS Size",
      description: "Hollow structural section size for the column shaft.",
      type: "dimension",
      shapeFilter: ["HSS"],
      defaultValue: "HSS8X8X1/2",
      required: true,
      position: 2,
    },
    {
      key: "basePlateLength",
      label: "Base Plate Length",
      type: "length",
      defaultValue: inches(18),
      required: true,
      position: 3,
    },
    {
      key: "basePlateWidth",
      label: "Base Plate Width",
      type: "length",
      defaultValue: inches(18),
      required: true,
      position: 4,
    },
    {
      key: "basePlateSize",
      label: "Base Plate Thickness",
      type: "dimension",
      shapeFilter: ["PL"],
      defaultValue: "PL3/4",
      required: true,
      position: 5,
    },
    {
      key: "capPlateLength",
      label: "Cap Plate Length",
      type: "length",
      defaultValue: inches(12),
      required: true,
      position: 6,
    },
    {
      key: "capPlateWidth",
      label: "Cap Plate Width",
      type: "length",
      defaultValue: inches(12),
      required: true,
      position: 7,
    },
    {
      key: "capPlateSize",
      label: "Cap Plate Thickness",
      type: "dimension",
      shapeFilter: ["PL"],
      defaultValue: "PL1/2",
      required: true,
      position: 8,
    },
    {
      key: "stiffenerCount",
      label: "Stabilizer Plates",
      description: "Number of stabilizer (stiffener) plates on the column.",
      type: "integer",
      defaultValue: 0,
      required: true,
      position: 9,
    },
    {
      key: "shearTabCount",
      label: "Shear Tabs",
      description: "Number of shear tabs welded to the column.",
      type: "integer",
      defaultValue: 0,
      required: true,
      position: 10,
    },
  ],

  calculate: (v) => {
    const height = v.columnHeight as number;
    const hssSize = v.hssSize as string;
    const bpLen = v.basePlateLength as number;
    const bpWid = v.basePlateWidth as number;
    const bpSize = v.basePlateSize as string;
    const cpLen = v.capPlateLength as number;
    const cpWid = v.capPlateWidth as number;
    const cpSize = v.capPlateSize as string;
    const stiffeners = v.stiffenerCount as number;
    const shearTabs = v.shearTabCount as number;

    const items = [
      {
        mainPiece: true,
        shape: "CO",
        grade: ".",
        quantity: 1,
        description: "Column",
        erectHours: 2,
      },
      {
        shape: "HSS",
        size: hssSize,
        grade: "A500",
        quantity: 1,
        length: height,
        laborCode: "H",
        comment: "HSS Column",
      },
      {
        shape: "PL",
        size: bpSize,
        grade: "A572",
        quantity: 1,
        length: bpLen,
        width: bpWid,
        laborCode: "W",
        comment: "Base Plate",
        holes: 4,
      },
      {
        shape: "PL",
        size: cpSize,
        grade: "A572",
        quantity: 1,
        length: cpLen,
        width: cpWid,
        laborCode: "W",
        comment: "Cap Plate",
      },
    ];

    if (stiffeners > 0) {
      items.push({
        shape: "PL",
        size: "PL3/8",
        grade: "A36",
        quantity: stiffeners,
        length: inches(6),
        width: inches(6),
        laborCode: "W",
        comment: "Stabilizer Plates",
      });
    }

    if (shearTabs > 0) {
      items.push({
        shape: "PL",
        size: "PL3/8",
        grade: "A36",
        quantity: shearTabs,
        length: inches(6),
        width: inches(4),
        laborCode: "W",
        comment: "Shear Tabs",
        holes: 2,
      });
    }

    return items;
  },
};

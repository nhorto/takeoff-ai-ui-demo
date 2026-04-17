/**
 * PA library registry. Ships the starter templates wired for the workbench.
 */

import type { PACategory, PATemplate } from "../engine/types";
import { stairChannel } from "./stair-channel";
import { landingChannel } from "./landing-channel";
import { hssRailPickets } from "./hss-rail-pickets";
import { multiLineRail } from "./multi-line-rail";
import { cableRail } from "./cable-rail";
import { wallRail } from "./wall-rail";
import { assistRail } from "./assist-rail";
// roofLadder is the original PowerFab PA 54 port. Superseded by
// standardLadder for new work but kept in the registry so existing projects
// referencing "roof-ladder" still resolve via getTemplate().
import { roofLadder } from "./roof-ladder";
import { standardLadder } from "./standard-ladder";
import { columnHss } from "./column-hss";

export {
  stairChannel,
  landingChannel,
  hssRailPickets,
  multiLineRail,
  cableRail,
  wallRail,
  assistRail,
  roofLadder,
  standardLadder,
  columnHss,
};

export const starterLibrary: readonly PATemplate[] = [
  stairChannel,
  landingChannel,
  hssRailPickets,
  multiLineRail,
  cableRail,
  wallRail,
  assistRail,
  roofLadder,
  standardLadder,
  columnHss,
];

export function getTemplate(id: string): PATemplate | undefined {
  return starterLibrary.find((t) => t.id === id);
}

export function getTemplatesByCategory(
  category: PACategory,
): PATemplate[] {
  return starterLibrary.filter((t) => t.category === category);
}

// Mirrors RailType in apps/web/types/project.ts. Duplicated here because
// src/shared cannot import from apps/web — the web layer imports this list
// instead. If a new rail type is added, update both the union there and the
// entry here (the compiler will flag missing keys).
export type RailType =
  | "picket"
  | "multi-line"
  | "cable"
  | "wall"
  | "assist";

export const RAIL_TEMPLATE_BY_TYPE: Record<RailType, string> = {
  picket: "hss-rail-pickets",
  "multi-line": "multi-line-rail",
  cable: "cable-rail",
  wall: "wall-rail",
  assist: "assist-rail",
};

/**
 * Starter PA library. Phase 1 ships with five hand-ported templates.
 * See docs/plans/01-pa-engine.md §7.
 */

import type { PACategory, PATemplate } from "../engine/types";
import { stairChannel } from "./stair-channel";
import { landingChannel } from "./landing-channel";
import { hssRailPickets } from "./hss-rail-pickets";
import { roofLadder } from "./roof-ladder";
import { columnHss } from "./column-hss";

export { stairChannel, landingChannel, hssRailPickets, roofLadder, columnHss };

export const starterLibrary: readonly PATemplate[] = [
  stairChannel,
  landingChannel,
  hssRailPickets,
  roofLadder,
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

import { describe, expect, it } from "vitest";
import { evaluatePA } from "../engine/runtime";
import { feet } from "../engine/units";
import { multiLineRail } from "./multi-line-rail";
import { cableRail } from "./cable-rail";
import { wallRail } from "./wall-rail";
import { assistRail } from "./assist-rail";
import { standardLadder } from "./standard-ladder";
import { getTemplate, starterLibrary } from "./index";

describe("multi-line-rail", () => {
  it("evaluates with defaults and produces a non-empty item list", () => {
    const result = evaluatePA(multiLineRail, {});
    expect(result.warnings).toEqual([]);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]).toMatchObject({ mainPiece: true, shape: "CO" });
  });

  it("produces runner pieces scaled by number of runners × bays", () => {
    const result = evaluatePA(multiLineRail, {
      section1Length: feet(10),
      numberOfRunners: 3,
      postSpacing: feet(5),
    });
    const runners = result.items.find((i) => i.comment === "S1 Runners");
    // 10 ft / 5 ft = 2 bays, 3 runners each
    expect(runners?.quantity).toBe(6);
  });

  it("adds sections when number of turns is set", () => {
    const result = evaluatePA(multiLineRail, {
      section1Length: feet(8),
      numberOfTurns: 2,
      section2Length: feet(4),
      section3Length: feet(4),
    });
    const topRails = result.items.filter((i) =>
      i.comment?.endsWith("Top Rail"),
    );
    expect(topRails.length).toBe(3);
  });
});

describe("cable-rail", () => {
  it("evaluates with defaults", () => {
    const result = evaluatePA(cableRail, {});
    expect(result.warnings).toEqual([]);
    expect(result.items[0]).toMatchObject({ mainPiece: true });
    const cables = result.items.find((i) => i.comment === "Cables");
    expect(cables?.quantity).toBe(10);
  });

  it("drops intermediate posts for short sections", () => {
    const result = evaluatePA(cableRail, {
      sectionLength: feet(3),
      postSpacing: feet(4),
    });
    const intermediate = result.items.find(
      (i) => i.comment === "Intermediate Posts",
    );
    expect(intermediate).toBeUndefined();
  });
});

describe("wall-rail", () => {
  it("evaluates with defaults and includes returns", () => {
    const result = evaluatePA(wallRail, {});
    expect(result.warnings).toEqual([]);
    const returns = result.items.find((i) => i.comment === "End Returns");
    expect(returns?.quantity).toBe(2);
  });

  it("omits returns when configured", () => {
    const result = evaluatePA(wallRail, { railReturns: "none" });
    const returns = result.items.find((i) => i.comment === "End Returns");
    expect(returns).toBeUndefined();
  });
});

describe("assist-rail", () => {
  it("evaluates with defaults", () => {
    const result = evaluatePA(assistRail, {});
    expect(result.warnings).toEqual([]);
    const posts = result.items.find((i) => i.comment === "Posts");
    expect(posts?.quantity).toBe(2);
  });
});

describe("standard-ladder", () => {
  it("evaluates with defaults", () => {
    const result = evaluatePA(standardLadder, {});
    expect(result.warnings).toEqual([]);
    const rungs = result.items.find((i) => i.comment === "Rungs");
    expect(rungs?.quantity).toBeGreaterThan(0);
  });

  it("adds hoops when cage is enabled", () => {
    const result = evaluatePA(standardLadder, { cage: "yes" });
    const hoops = result.items.find((i) => i.comment === "Hoops");
    expect(hoops).toBeDefined();
  });
});

describe("starter library registry", () => {
  it("exposes every template via getTemplate()", () => {
    for (const template of starterLibrary) {
      expect(getTemplate(template.id)?.id).toBe(template.id);
    }
  });

  it("has all rail types represented", () => {
    const railIds = starterLibrary
      .filter((t) => t.category === "rail")
      .map((t) => t.id)
      .sort();
    expect(railIds).toEqual([
      "assist-rail",
      "cable-rail",
      "hss-rail-pickets",
      "multi-line-rail",
      "wall-rail",
    ]);
  });

  it("gives every visible variable in every template a unique position", () => {
    for (const template of starterLibrary) {
      const positions = template.variables
        .filter((v) => !v.hidden && v.position !== undefined)
        .map((v) => v.position);
      const unique = new Set(positions);
      expect(
        unique.size,
        `duplicate positions in ${template.id}: ${positions.join(", ")}`,
      ).toBe(positions.length);
    }
  });
});

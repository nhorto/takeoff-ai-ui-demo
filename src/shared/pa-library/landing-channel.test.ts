import { describe, expect, it } from "vitest";
import { evaluatePA } from "../engine/runtime";
import { feet } from "../engine/units";
import { landingChannel } from "./landing-channel";

describe("landing-channel", () => {
  it("evaluates with only width + depth (hidden vars fall back to defaults)", () => {
    const result = evaluatePA(landingChannel, {
      widthOfLanding: feet(5),
      depthOfLanding: feet(5),
    });
    expect(result.warnings).toEqual([]);
    // CO + back + sides + front + cross + deck + clips
    expect(result.items.length).toBe(7);
  });

  it("produces the expected material list for a 5x5 ft landing", () => {
    const result = evaluatePA(landingChannel, {
      widthOfLanding: feet(5),
      depthOfLanding: feet(5),
    });

    expect(result.items[0]).toMatchObject({
      mainPiece: true,
      shape: "CO",
      quantity: 1,
      description: "Landing",
    });

    expect(result.items[1]).toMatchObject({
      shape: "C",
      size: "C12X20.7",
      quantity: 1,
      length: feet(5),
      comment: "Back of Landing",
    });

    expect(result.items[2]).toMatchObject({
      shape: "C",
      size: "C12X20.7",
      quantity: 2,
      length: feet(5),
      comment: "Sides of Landing",
    });

    expect(result.items[3]).toMatchObject({
      shape: "C",
      size: "C8X11.5",
      quantity: 1,
      length: feet(5),
      comment: "Front of Landing",
    });

    // Cross members: floor(width/2ft) = floor(5/2) = 2
    expect(result.items[4]).toMatchObject({
      shape: "L",
      size: "L3X3X1/4",
      quantity: 2,
      length: feet(5),
      comment: "Cross Members",
    });

    // Default flooring is "deck"
    expect(result.items[5]).toMatchObject({
      shape: "DK",
      size: "1.5B",
      comment: "Landing Deck",
    });

    // Default connection is "clips"
    expect(result.items[6]).toMatchObject({
      shape: "L",
      comment: "Angle Clips",
    });
  });

  it("switches floor material when flooring is overridden", () => {
    const result = evaluatePA(landingChannel, {
      widthOfLanding: feet(5),
      depthOfLanding: feet(5),
      flooring: "floor-plate",
    });
    const floor = result.items.find((item) => item.comment === "Landing Floor Plate");
    expect(floor).toBeDefined();
    expect(floor).toMatchObject({ shape: "PL", size: "PL1/4" });
  });

  it("drops angle clips when connection is welded", () => {
    const result = evaluatePA(landingChannel, {
      widthOfLanding: feet(5),
      depthOfLanding: feet(5),
      connectionType: "welded",
    });
    expect(result.items.find((item) => item.comment === "Angle Clips")).toBeUndefined();
  });
});

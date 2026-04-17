import { describe, expect, it } from "vitest";
import { evaluatePA } from "../engine/runtime";
import { ftIn, inches } from "../engine/units";
import { stairChannel } from "./stair-channel";

describe("stair-channel", () => {
  it("evaluates with only the drawing-readable inputs (hidden vars fall back to defaults)", () => {
    const result = evaluatePA(stairChannel, {
      numTreads: 14,
      numRisers: 15,
      stairWidth: ftIn(3, 6),
    });
    expect(result.warnings).toEqual([]);
    expect(result.items.length).toBe(6);
  });

  it("produces the expected material list for a typical commercial flight", () => {
    const result = evaluatePA(stairChannel, {
      numTreads: 14,
      numRisers: 15,
      stairWidth: ftIn(3, 6),
    });

    // Main piece header
    expect(result.items[0]).toMatchObject({
      mainPiece: true,
      shape: "CO",
      quantity: 1,
      description: "Stair",
    });

    // Stringers: two, default C12X20.7, length ≈ √(height² + run²) + 1"
    const stringers = result.items[1];
    expect(stringers).toMatchObject({
      shape: "C",
      size: "C12X20.7",
      grade: "A36",
      quantity: 2,
      laborCode: "M",
      comment: "Stringer",
    });
    const expectedHeight = 15 * 6.75;
    const expectedRun = 14 * 11;
    const expectedStringer =
      Math.sqrt(expectedHeight ** 2 + expectedRun ** 2) + 1;
    expect(stringers.length).toBeCloseTo(expectedStringer, 4);

    // Jacks: two per tread
    expect(result.items[2]).toMatchObject({
      shape: "L",
      size: "L3X3X1/4",
      quantity: 28,
      comment: "Jacks",
    });

    // Tread pans: one per tread, width of the stair, depth of a tread run
    expect(result.items[3]).toMatchObject({
      shape: "PL",
      size: "PL14GA",
      quantity: 14,
      length: ftIn(3, 6),
      width: inches(11),
      comment: "Tread Pans",
    });

    expect(result.items[4]).toMatchObject({
      shape: "PL",
      size: "PL3/8",
      comment: "Caps",
    });
    expect(result.items[5]).toMatchObject({
      shape: "L",
      size: "L2X2X1/4",
      comment: "Clips",
    });
  });

  it("allows per-assembly override of a hidden company default", () => {
    const result = evaluatePA(stairChannel, {
      numTreads: 14,
      numRisers: 15,
      stairWidth: ftIn(3, 6),
      stringerSize: "C15X33.9",
    });
    expect(result.items[1]).toMatchObject({
      shape: "C",
      size: "C15X33.9",
    });
  });

  it("bumps stringer length by 5\" and relabels when dogleg is yes", () => {
    const straight = evaluatePA(stairChannel, {
      numTreads: 14,
      numRisers: 15,
      stairWidth: ftIn(3, 6),
    });
    const dogleg = evaluatePA(stairChannel, {
      numTreads: 14,
      numRisers: 15,
      stairWidth: ftIn(3, 6),
      dogleg: "yes",
    });
    // dogleg adds 6" vs the straight 1" allowance → net +5".
    expect(
      (dogleg.items[1].length ?? 0) - (straight.items[1].length ?? 0),
    ).toBeCloseTo(5, 4);
    expect(dogleg.items[1].comment).toBe("Stringer (doglegged)");
    expect(straight.items[1].comment).toBe("Stringer");
  });

  it("produces a grating tread row when treadType is grating", () => {
    const result = evaluatePA(stairChannel, {
      numTreads: 14,
      numRisers: 15,
      stairWidth: ftIn(3, 6),
      treadType: "grating",
    });
    expect(result.items[3]).toMatchObject({
      shape: "GR",
      grade: "A1011",
      quantity: 14,
      laborCode: "GG",
      comment: "Grating Treads",
    });
  });

  it("produces a checker-plate tread row when treadType is checker-plate", () => {
    const result = evaluatePA(stairChannel, {
      numTreads: 14,
      numRisers: 15,
      stairWidth: ftIn(3, 6),
      treadType: "checker-plate",
    });
    expect(result.items[3]).toMatchObject({
      shape: "PL",
      grade: "A36",
      quantity: 14,
      laborCode: "JJ",
      comment: "Checker Plate Treads",
    });
  });

  it("scales stringer length linearly with number of risers", () => {
    const small = evaluatePA(stairChannel, {
      numTreads: 10,
      numRisers: 11,
      stairWidth: ftIn(3, 6),
    });
    const big = evaluatePA(stairChannel, {
      numTreads: 20,
      numRisers: 21,
      stairWidth: ftIn(3, 6),
    });
    // Strictly longer stringer for the taller stair.
    expect((big.items[1].length ?? 0) > (small.items[1].length ?? 0)).toBe(true);
  });
});

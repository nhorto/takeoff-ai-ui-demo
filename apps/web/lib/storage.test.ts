import { describe, expect, it } from "vitest";
import { migrateV1, migrateV2ToV3 } from "./storage";

type V2Input = Parameters<typeof migrateV2ToV3>[0];

function makeV2(
  flights: Array<{
    landingValues: Record<string, number | string | null> | null;
  }>,
): V2Input {
  return {
    version: 2,
    project: {
      id: "project-1",
      name: "Test Project",
      summary: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      stairs: [
        {
          id: "stair-1",
          name: "Stair A",
          inputMode: "per-flight",
          flights: flights.map((f, i) => ({
            id: `flight-${i + 1}`,
            order: i + 1,
            stairValues: { numTreads: 12 },
            landingValues: f.landingValues,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          })),
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    ui: {
      selectedStairId: "stair-1",
      selectedFlightId: "flight-1",
      expandedStairIds: ["stair-1"],
      expandedFlightIds: [],
      aiPanelOpen: true,
    },
    drafts: {},
  };
}

describe("migrateV2ToV3", () => {
  it("wraps inline landingValues as a LandingAssignment referencing Default Landing", () => {
    const v2 = makeV2([
      { landingValues: { widthOfLanding: 60, depthOfLanding: 60 } },
    ]);
    const v3 = migrateV2ToV3(v2);

    expect(v3.version).toBe(3);
    expect(v3.project.landingTemplates).toHaveLength(1);
    expect(v3.project.landingTemplates[0].name).toBe("Default Landing");

    const flight = v3.project.stairs[0].flights[0];
    expect(flight.landing).not.toBeNull();
    expect(flight.landing?.templateId).toBe(
      v3.project.landingTemplates[0].id,
    );
    expect(flight.landing?.values).toEqual({
      widthOfLanding: 60,
      depthOfLanding: 60,
    });
  });

  it("keeps landing as null for flights with no landingValues", () => {
    const v2 = makeV2([{ landingValues: null }]);
    const v3 = migrateV2ToV3(v2);
    expect(v3.project.stairs[0].flights[0].landing).toBeNull();
  });

  it("seeds empty railTemplates and ladders arrays", () => {
    const v3 = migrateV2ToV3(makeV2([{ landingValues: null }]));
    expect(v3.project.railTemplates).toEqual([]);
    expect(v3.project.ladders).toEqual([]);
  });

  it("seeds empty rails array on every flight", () => {
    const v3 = migrateV2ToV3(
      makeV2([
        { landingValues: null },
        { landingValues: { widthOfLanding: 48 } },
      ]),
    );
    for (const flight of v3.project.stairs[0].flights) {
      expect(flight.rails).toEqual([]);
    }
  });

  it("preserves ui state and defaults missing expandedFlightIds", () => {
    const v2 = makeV2([{ landingValues: null }]);
    v2.ui.expandedFlightIds = undefined as unknown as string[];
    const v3 = migrateV2ToV3(v2);
    expect(v3.ui.expandedFlightIds).toEqual([]);
    expect(v3.ui.selectedStairId).toBe("stair-1");
  });
});

describe("migrateV1 → migrateV2ToV3 chain", () => {
  it("upgrades a v1 blob through v2 into v3", () => {
    const v1 = {
      version: 1,
      project: {
        id: "project-1",
        name: "Old",
        summary: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        stairs: [
          {
            id: "stair-1",
            name: "Stair A",
            inputMode: "per-flight",
            flights: [
              {
                id: "flight-1",
                order: 1,
                stairValues: {},
                landingValues: { widthOfLanding: 48 },
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      ui: { selectedStairId: "stair-1" },
      drafts: {},
    };

    const v2 = migrateV1(JSON.stringify(v1)) as V2Input;
    expect(v2).not.toBeNull();
    expect(v2.version).toBe(2);

    const v3 = migrateV2ToV3(v2);
    expect(v3.version).toBe(3);
    expect(v3.project.stairs[0].flights[0].landing?.values).toEqual({
      widthOfLanding: 48,
    });
    expect(v3.project.landingTemplates[0].name).toBe("Default Landing");
  });

  it("returns null for non-v1 input", () => {
    expect(migrateV1(JSON.stringify({ version: 2 }))).toBeNull();
    expect(migrateV1("not json")).toBeNull();
  });
});

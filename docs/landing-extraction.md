# Landing Extraction

## Overview

This document describes the requirements and approach for extracting landing information from stair drawings. This is a separate concern from the image+text coordinate approach (see `docs/image-text-coordinate-approach.md`) but depends on the same view-aware reasoning capabilities.

## What Needs to Be Extracted

Per stair:
1. **Number of landings** — how many horizontal platforms exist between flights
2. **Landing dimensions** — width and depth of each landing

## The Challenge

### Information Is Split Across Views

Landing information is distributed across different drawing views on the sheet:

- **Section view** (main stair overview): Shows all landings as horizontal platforms between flights. This is where you can **count** the total number of landings. Each landing appears at a floor level or intermediate level between flights.

- **Plan views** (per-level views): Show the top-down layout of each level. This is where **landing dimensions** (width, depth) are called out, along with stair width, door clearances, and other details.

### Fewer Landings in Plan Views

The plan views may show **fewer landings than what the section view shows**. This is because:
- Each plan view shows only one level
- Some intermediate landings between floors may not have their own dedicated plan view
- The section view shows the complete vertical stack, including all intermediate landings

**The section view is the source of truth for landing COUNT.** Plan views are the source of truth for landing DIMENSIONS (when available).

### Missing Dimensions

Not all landing dimensions are explicitly called out on the drawings. Common scenarios:
- Landing width may match stair width (implied, not labeled separately)
- Landing depth may not be dimensioned if it's a standard size
- Some landings are "typical" — one is dimensioned and the rest are assumed to match
- In some cases, no landing dimensions are shown at all

**When dimensions are missing, the agent MUST:**
1. State clearly which dimensions are assumed vs. measured from the drawing
2. Use reasonable assumptions based on what IS shown (e.g., if stair width is 4'-0" and landing width isn't labeled, assume landing width matches stair width)
3. Flag every assumption to the user with an explicit note like: "ASSUMPTION: Landing depth assumed to be 4'-0" to match stair width — not dimensioned on drawing"

## How This Relates to the Image+Text Approach

The image+text coordinate approach (sending both the page image and text with spatial coordinates) directly enables landing extraction:

1. The LLM sees the **section view** in the image and can count landings visually
2. The text coordinates let the LLM identify which **plan views** have dimension callouts
3. The LLM can cross-reference: "I see 8 landings in the section view. The Level 03 plan view shows a landing that is 5'-6" x 4'-0". I'll use that for the landings at this level."

Without view-aware reasoning, the agent would either:
- Count landings from a plan view (wrong — undercounts)
- Miss dimensions entirely (only looking at section view which doesn't have them)

## Agent Prompting

The agent needs specific guidance on landing extraction:

> ### Landing Counting and Dimensions
>
> **Counting landings:** Use the SECTION VIEW (main stair overview) to count the total number of landings. A landing is any horizontal platform between stair flights — this includes:
> - Floor-level landings (at each building level)
> - Intermediate/half landings (between floors where the stair turns)
>
> Count every horizontal platform visible in the section view. Do NOT count landings from plan views — they only show one level each and will undercount.
>
> **Landing dimensions:** Look at the PLAN VIEWS for each level to find landing dimensions. Common callouts include:
> - Landing width (often matches stair width)
> - Landing depth (measured perpendicular to the direction of travel)
> - "TYP" notation (meaning this dimension applies to similar landings)
>
> **When dimensions are not shown:**
> - If a "TYP" landing is dimensioned once, apply that dimension to all similar landings
> - If landing width is not shown, assume it matches the stair width (if known)
> - If landing depth is not shown, note it as unknown and flag to the user
> - ALWAYS clearly mark which values are measured vs. assumed
> - ALWAYS flag assumptions to the user

## Output Format

The agent should report landings in a structured format:

```
LANDINGS:
  Total count: 8 (from section view)

  Landing 1 (Level 00 to Level 01, intermediate):
    Width: 4'-0" (from Level 01 plan view)
    Depth: 5'-6" (from Level 01 plan view)
  
  Landing 2 (Level 01):
    Width: 4'-0" (from Level 01 plan view)
    Depth: 4'-0" (ASSUMPTION — not dimensioned, assumed to match stair width)
  
  ...
  
  ⚠️ ASSUMPTIONS MADE:
  - Landing 2 depth assumed 4'-0" (not dimensioned on drawing)
  - Landings 5-7 dimensions assumed typical per Landing 1 (TYP notation)
```

## Open Questions

1. **How to handle multi-page stairs**: A stair tower that spans multiple drawing sheets may have the section view on one page and plan views on other pages. The agent needs to aggregate landing counts across pages while pulling dimensions from whichever page has the relevant plan view.

2. **Intermediate vs. floor landings**: Should the output distinguish between floor-level landings and intermediate half-landings? The section view shows both, but they may have different dimension requirements.

3. **Landing shape**: Some landings are L-shaped or irregularly shaped (especially at levels where doors or corridors connect). How should these be reported — as a single dimension pair, or with notes about the shape?

These questions should be resolved through testing with actual drawing sets and user feedback.

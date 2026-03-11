---
name: ConstructionTakeoff
description: Professional construction document quantity takeoff and coordination review for Division 5500 (Metal Fabrications/Stairs). Creates accurate contractor-style scope documents with detailed flight/tread counts, riser verification, and cross-discipline coordination checks. Follows professional estimator methodology. USE WHEN user requests quantity takeoff, construction estimating, stair takeoff, coordination review, QC review of construction documents, Division 5500 scope, or construction document analysis.
---

# ConstructionTakeoff

> **LEGACY SINGLE-AGENT SKILL.** In the orchestrated multi-agent flow, this file is NOT loaded. Phase-specific skills (`DiscoveryPhase.md`, `CountingPhase.md`, `CompilationPhase.md`) are used instead. This file is retained as domain knowledge reference material.

**Professional-grade construction document analysis for accurate quantity takeoffs and coordination reviews.**

This skill replicates the work of a professional construction estimator and QC coordinator, producing contractor-ready scope documents with verified quantities and coordination issue identification.

---

## ⚠️ CRITICAL: READ FROM DRAWINGS - DO NOT ESTIMATE

**The purpose of this skill is to READ the drawings and extract accurate data.**
If you estimate values instead of reading them, the estimator might as well do it themselves.

### Rule #1: READ FIRST, ASSUME ONLY AS LAST RESORT

For EVERY value in the takeoff:
1. **FIRST** - Look for the value on the drawings (plans, sections, details, schedules)
2. **SECOND** - If found, record it WITH the sheet reference (e.g., "13 risers @ 7" - A0505")
3. **ONLY IF NOT FOUND** - Mark as assumption with justification: "NOT SHOWN - Assumed [value] based on [reason]"

### What MUST Be Read From Drawings (Not Estimated):

| Data | Where to Find It | DO NOT |
|------|------------------|--------|
| Riser counts | Section views, stair callouts | Estimate "~10 per flight" |
| Riser heights | Section callouts (e.g., "13R @ 7"") | Assume uniform |
| Tread counts | Section views, flight labels | Use averages |
| Stair widths | Plan view dimensions | Guess from scale |
| Landing sizes | Plan view dimensions | Estimate visually |
| Stringer sizes | Detail sheets (A0510-A0512) | Assume "typical" |
| Tread gauge | Detail sheets, specifications | Default to 14ga |
| Rail pipe size | Detail sheets (A0511) | Assume 1-1/2" |
| Post spacing | Railing elevations, details | Use formula |

### What MAY Be Assumed (Only If Not On Drawings):

- Steel grades (A36, A992, A53) - if not specified in structural notes
- Connection hardware quantities - typically not shown
- Picket counts - if spacing not dimensioned

### When You Cannot Read a Value:

1. **STOP** - Do not guess
2. **STATE** exactly what you cannot read and which sheet you checked
3. **ASK** the user if they want you to assume or if they can provide clarification
4. **DOCUMENT** in assumptions section: "Value not found on sheets [X, Y, Z] - Assumed [value]"

### When to Use `ask_user`:

Use `ask_user` ONLY for genuine ambiguities — unclear dimensions, conflicting information, or missing data you cannot resolve from the drawings. **Do NOT ask about scope or detail level** when the user has already stated their request. If the user says "do a takeoff", proceed with a full detailed takeoff immediately. Do not present options like "A) full, B) sample, C) quick" — this wastes time and causes duplicate work.

### ⚠️ RISER HEIGHTS - CRITICAL FOR CODE COMPLIANCE

**You MUST read the actual riser callouts from EVERY flight:**
1. Find the callout (e.g., "13 RISERS @ 7 3/8"") on the section view
2. Record the EXACT height shown for each flight
3. Compare heights across all flights in the stair
4. Flag any variation exceeding 3/8" as 🔴 CODE VIOLATION (IBC 1011.5.2)

**Estimating "~10 treads per flight" is NOT acceptable** - it masks code violations and defeats the purpose of the takeoff.

---

## Methodology Reference

This skill provides domain knowledge — what to look for, code requirements, and output format. In the multi-agent flow, each phase skill contains its own step-by-step procedures.

---

## Primary Focus: Quantity Takeoff

The **QuantityTakeoff** workflow is the core deliverable. It produces:

### Output Format: CSV Bill of Materials (for PowerFab Import)

The takeoff outputs a **CSV file** with line-item bill of materials that can be imported into PowerFab or similar estimating software.

**CSV Columns:**
```
Item,Sequence,Stair,Category,Component,Qty,Shape,Size,Length,Grade,Notes
```

**Example Output:**
```csv
Item,Sequence,Stair,Category,Component,Qty,Shape,Size,Length,Grade,Notes
10,A,Stair 1,Stringer,Stringer,8,MC,12 x 10.6,14'-0,A36,
20,A,Stair 1,Stringer,Tread,56,PL,14ga x 24,4'-0,A36,
30,A,Stair 1,Landing,Side Channel,6,MC,12 x 10.6,5'-0,A36,
40,A,Stair 1,Landing,Back Channel,3,MC,12 x 10.6,10'-0,A36,
50,A,Stair 1,Landing,Header,6,W,10 x 12,10'-0,A992,
60,A,Stair 1,Rail,Top Rail,4,HSSR,1 1/2 x 0.12,14'-0,A500,
70,A,Stair 1,Rail,Grab Rail,4,HSSR,1 1/2 x 0.12,18'-0,A500,
80,A,Stair 1,Rail,Post,20,HSSR,1 1/2 x 0.12,3'-6,A500,
```

**What IS Extracted (from drawings):**
- Stringers (count, size, length from rise)
- Treads (count, gauge, width)
- Landing channels (side, back, headers)
- Rail components (top rail, grab rail, posts)

**What is NOT Extracted (requires parametric templates or detail takeoff):**
- Clip angles, deck support angles
- Pickets and picket counts
- Hardware (bolts, nuts, washers)
- Hanger assemblies
- Detailed labor codes and pricing

The CSV can be imported into PowerFab, where estimators add pricing, labor codes, and any additional components not visible on drawings.

### Methodology Overview (From Professional Estimator)

> **NOTE:** This is a high-level overview. In the multi-agent flow, the phase skills (DiscoveryPhase.md, CountingPhase.md, CompilationPhase.md) contain the detailed step-by-step procedures for each phase.

**Step 1: Read Detail Sheets**
- Understand HOW it's built (materials, connections, rail details)
- Note specifications (055113 Metal Pan Stairs, 055213 Railings, etc.)
- Identify material types (bent plate, checker plate, pipe sizes)
- **Zoom in on details only when the overview is insufficient:** Use `extract_pdf_region` to crop areas with small text, dimension strings, or material callouts that aren't legible in the full-page overview. Do NOT crop every detail page — only crop when you can identify specific text you need but can't read.

**Step 2: Go to Plan/Section Sheets - READ ACTUAL CALLOUTS**
- Count FLIGHTS per level
- **READ the actual riser/tread callouts** (e.g., "13 RISERS @ 7"") - DO NOT estimate
- **Zoom in to read dimension callouts only if you cannot read them from the overview:** If riser counts, heights, or tread dimensions are too small to read in the full-page view, use `extract_pdf_region` to crop the specific area where the callout appears.
- Count TREADS in each flight ("the heavy lifting")
- Record the **exact riser height** shown for each flight
- Measure or note LANDING sizes
- Record stair widths

**⚠️ COUNTING TREADS: Plan First, Crop in Parallel**

When counting treads visually from section views, **plan ALL crops first, then execute them in parallel**:

**Step 1: View and Plan**
1. Extract the overview page: `extract_pdf_pages([252])`
2. Identify ALL flight locations that need counting
3. **Write your crop plan to working notes BEFORE cropping:**
   ```
   Page 252 crop plan:
   - Flight 1: pixels (100, 200, 600, 400) — count treads
   - Flight 2: pixels (100, 650, 600, 400) — count treads
   - Flight 3: pixels (100, 1100, 600, 400) — count treads
   ```

**Step 2: Execute ALL Crops in ONE Turn**
```
// ONE turn with ALL crops (parallel execution):
extract_pdf_region(252, crop={x: 100, y: 200, width: 600, height: 400}) AND
extract_pdf_region(252, crop={x: 100, y: 650, width: 600, height: 400}) AND
extract_pdf_region(252, crop={x: 100, y: 1100, width: 600, height: 400})
```

**Step 3: Analyze and Record**
- Count treads in each crop result
- Write findings to working notes
- Move to next page

**WRONG (slow, expensive):**
```
Turn 1: extract_pdf_region(252, crop=flight1) → count →
Turn 2: extract_pdf_region(252, crop=flight2) → count →
Turn 3: extract_pdf_region(252, crop=flight3) → count
= 3 API round trips, no notes written
```

**RIGHT (fast, efficient):**
```
Turn 1: PLAN all crops, WRITE plan to notes
Turn 2: EXECUTE all 3 crops in parallel
Turn 3: ANALYZE results, WRITE findings to notes
= 3 API round trips, but with discipline and parallel execution
```

**Why pixel coordinates matter:** Named regions (top-left, bottom-half, etc.) give you fixed portions of the page. Pixel coordinates let you target exactly the stair flight you need, giving you maximum zoom on the specific area. A 400×400 pixel crop of a single flight gives you ~4x better resolution than a quadrant crop.

**Cost Reality:** Each sequential crop = one API round trip. 20 sequential crops = 20 round trips. 20 parallel crops = 1 round trip. Plan first, batch always.

**Step 3: Verify Code Compliance - COMPARE RISER HEIGHTS**
- **List all riser heights found** across each stair (e.g., 6 7/8", 7", 7 3/8")
- Check for variation exceeding 3/8" (IBC 1011.5.2) - this is a CODE VIOLATION
- Verify tread depths are consistent
- Flag any code violations as 🔴 CRITICAL issues
- **DO NOT skip this step** even if just doing quantity takeoff

**Step 4: Cross-Check with Structural**
- Verify stair openings match architectural
- Check if structural framing supports shown stair locations
- Look for dimensional conflicts

**Step 5: Compile Quantities**
- Total flights per stair
- Average risers per flight
- Total tread count
- Landing count and sizes
- Reference drawing sheets for verification

---

## Secondary Focus: Coordination Review

The **CoordinationReview** workflow produces:

### Output Categories

**✅ CLEAN/COORDINATED ITEMS**
- Items that match across disciplines
- Code-compliant elements
- Complete and clear details

**🔴 CRITICAL ISSUES**
- Code violations (especially riser height variations)
- Architectural/structural conflicts
- Safety hazards
- Permit-blocking issues

**⚠️ COORDINATION VERIFICATION NEEDS**
- Items requiring clarification
- Potential conflicts needing investigation
- Missing information

**❓ QUESTIONS FOR DESIGN TEAM**
- Formatted as RFIs (Request for Information)
- Specific sheet references
- Clear description of issue

---

## PDF Sheet Identification

Large construction document PDFs (often 300+ pages, 100+ MB) require strategic extraction.

### Target Sheets for Division 5500 (Stairs)
- Architectural: A0500-A0512 series (Stair Plans & Details)
- Structural: S0500 series (Structural details)
- Structural: S0100 series (Foundation/Framing plans)
- Structural: S0001 (Structural notes)

**NOTE:** Sheet locations vary widely between projects. The Electron app's PDF tools handle page extraction — use `get_page_text` and `search_pdf_text` to locate relevant sheets.

---

## Code Compliance Checks

### IBC Stair Requirements (Section 1011)

**Riser Height (IBC 1011.5.2)**
- Maximum variation: 3/8" within any flight
- Flag if drawings show: 7 3/8" and 6 7/8" risers (1/2" variation = VIOLATION)

**Tread Depth (IBC 1011.5.3)**
- Minimum: 11" for most occupancies
- Maximum variation: 3/8" within any flight

**Stair Width**
- Verify clear width meets code for occupancy type
- Check if railings encroach on required width

---

## Examples

**Example 1: Basic Quantity Takeoff**
```
User uploads PDF and requests a takeoff
→ Discovery phase: Scans PDF, identifies stair sheets and specs
→ Counting phase: Parallel agents count each stair independently
→ Compilation phase: Generates CSV and summary
→ Produces: takeoff.csv, takeoff_summary.txt, summary.md
```

**Example 2: Uncertain Area - Asking for Help**
```
Counting agent finds variable riser heights on Stair 5:
- Some flights: 11 treads @ 6 7/8" risers
- Some flights: 13 treads @ 7 3/8" risers
→ Uses ask_user to flag the discrepancy
→ Waits for guidance before finalizing count
```

---

## Disciplines Covered

### Primary: Division 5500 (Metal Fabrications)
- Metal pan stairs (Spec 055113)
- Pipe and tube railings (Spec 055213)
- Steel supports and connections
- Landing plates and checkered plate

### Cross-Reference Disciplines
- **Structural**: Stair openings, support framing, connections
- **Architectural**: Space planning, finishes, dimensions
- **Civil**: Site grading affecting stairs (if exterior stairs)
- **Landscape**: Coordination with exterior stairs

---

## Output Files

The Electron app manages session directories and output file paths. Agents write outputs to the session directory using `write_file`.

**Final deliverables:**
- **CSV File** (`takeoff.csv`) — Line-item bill of materials for PowerFab import
- **Text Summary** (`takeoff_summary.txt`) — Professional takeoff summary with code compliance, assumptions, and coordination notes
- **Markdown Summary** (`summary.md`) — Brief stair table and specs overview

---

## Key Principles

1. **ACCURACY OVER SPEED** - Never rush or guess
2. **ASK WHEN UNSURE** - User would rather answer questions than get wrong numbers
3. **DOCUMENT EVERYTHING** - Include sheet references for all quantities
4. **FLAG CODE ISSUES** - Code violations are critical coordination problems
5. **FOLLOW THE METHODOLOGY** - Read details first, then count (like professional estimators do)

---

## Related Files

### Phase Skills (used by orchestrated multi-agent flow)
- `skills/DiscoveryPhase.md` - Scan PDF, identify sheets and specs
- `skills/CountingPhase.md` - Count one stair, output JSON
- `skills/CompilationPhase.md` - Generate final CSV and summary

---

**This skill contains domain knowledge for Division 5500 construction takeoffs — what to look for, code requirements, and professional methodology.**

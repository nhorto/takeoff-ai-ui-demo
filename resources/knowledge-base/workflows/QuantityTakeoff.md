# QuantityTakeoff Workflow

**PRIMARY DELIVERABLE: CSV Bill of Materials for PowerFab Import**

This workflow extracts stair quantities from construction drawings and outputs a CSV file that can be imported into PowerFab or similar estimating software.

---

## ⚠️ CRITICAL RULE: NEVER GUESS

If you cannot clearly determine a quantity:
1. **STOP** - Do not make up numbers
2. **STATE** what you cannot determine
3. **ASK** the user for clarification
4. **DOCUMENT** the uncertainty in the Notes column

**Example:**
```
❓ UNCERTAINTY: Stair 3 Level 05 landing size - Sheet A0503 is unclear.
   Appears to be either 5'-0" x 10'-0" or 5'-0" x 11'-0". Please verify.
```

---

## Output Format: CSV File

The takeoff produces a CSV file with these columns:

| Column | Description | Example |
|--------|-------------|---------|
| Item | Line number (10, 20, 30...) | 10 |
| Sequence | Stair letter (A, B, C...) | A |
| Stair | Stair name | Stair 1 |
| Category | Component category | Stringer, Landing, Rail |
| Component | Specific component type | Side Channel, Tread, Post |
| Qty | Quantity | 8 |
| Shape | Material shape | MC, PL, L, W, HSSR |
| Size | Dimension/size | 12 x 10.6, 14ga x 24 |
| Length | Component length | 14'-0 |
| Grade | Material grade | A36, A992, A500 |
| Notes | Uncertainties, references | ❓ Verify sheet A0503 |

---

## Step 1: Understand the Request

**Ask clarifying questions if needed:**
- Which stair(s) to analyze? (All stairs? Specific stair numbers?)
- Output file location? (Default: `/tmp/[ProjectName]_takeoff.csv`)
- Any specific concerns? (Code compliance? Material assumptions?)

---

## Step 2: Locate and Extract Relevant Sheets

### If PDF is Large (>50MB or >50 pages):
**Invoke ExtractSheets workflow first** to create manageable files.

### Identify Sheet Numbers:
For Division 5500 (Stairs), you typically need:

**Architectural:**
- **A0500-A0512 series** - Stair plans, sections, and details
  - A0500-A0508: Individual stair plans (Stair 1, 2, 3, etc.)
  - A0510-A0512: Typical stair details (connections, materials, railings)

**Structural (for coordination):**
- **S0001**: Structural notes and general requirements
- **S0100 series**: Foundation and framing plans showing stair openings
- **S0500 series**: Structural stair details (if present)

---

## Step 3: Read Detail Sheets FIRST - Extract Material Specifications

**Before counting anything, understand HOW it's built and WHAT materials are used.**

Read the detail sheets (A0510-A0512 typical) and extract these material specifications:

### Stringer Materials (Record for CSV output):
| Component | Typical Shape | Look For | Default If Not Shown |
|-----------|---------------|----------|---------------------|
| Stringer | MC (Channel) | "MC 12 x 10.6" or similar | MC 12 x 10.6 |
| Stringer Grade | - | "A36" or similar | A36 |

### Tread Materials:
| Component | Typical Shape | Look For | Default If Not Shown |
|-----------|---------------|----------|---------------------|
| Tread | PL (Plate) | "14 GA", "12 GA", "10 GA" | 14ga (light), 12ga (med), 10ga (heavy) |
| Tread Width | - | Stair clear width | From plan sheets |
| Tread Grade | - | Usually not specified | A36 |

**Tread Gauge Selection (from parametric template):**
- Width ≤ 56": Use 14ga (light pan)
- Width 56" - 66": Use 12ga (medium pan)
- Width ≥ 66": Use 10ga (heavy pan)

### Landing Materials:
| Component | Typical Shape | Look For | Default If Not Shown |
|-----------|---------------|----------|---------------------|
| Side/Back Channel | MC | Same as stringer | MC 12 x 10.6, A36 |
| Header | W (Wide Flange) | "W10 x 12" or similar | W 10 x 12, A992 |
| Deck Plate | PL | "12 GA DECK" | 12ga, AISI 1008/1010 |

### Rail Materials:
| Component | Typical Shape | Look For | Default If Not Shown |
|-----------|---------------|----------|---------------------|
| Top Rail | HSSR (Round Tube) | "1-1/2" DIA" or "1.5 OD" | HSSR 1 1/2 x 0.12 |
| Grab Rail | HSSR | Same as top rail | HSSR 1 1/2 x 0.12 |
| Posts | HSSR | Same or heavier | HSSR 1 1/2 x 0.12 |
| Rail Grade | - | "A500" or similar | A500 |

### Record Material Specs:
Create a reference table for use during takeoff:
```
PROJECT MATERIAL SPECIFICATIONS (from Detail Sheets)
Sheet Reference: [A0510, A0511, etc.]

Stringers: MC 12 x 10.6, A36
Treads: PL [gauge] x [width], A36
Landing Channels: MC 12 x 10.6, A36
Landing Headers: W 10 x 12, A992
Rails: HSSR 1 1/2 x 0.12, A500
Rail Height: [34" - 38" typical]
```

**If materials are not specified on details:**
- Use defaults from table above
- Add note in CSV: "❓ Material assumed - verify spec"

---

## Step 4: Analyze Each Stair - The Heavy Lifting

For each stair, read its plan/section sheet (A0500, A0501, A0502, etc.)

### 4A: Count Flights

A "flight" is a continuous run of stairs between landings.

**Example from Stair 2 (Sheet A0502):**
```
Level 00 to Level 01: 1 flight (13 treads)
Level 01 to Level 02: 2 flights (13 treads each, scissor configuration)
Level 02 to Level 03: 2 flights (13 treads each)
...
```

Count systematically level-by-level.

### 4B: Count Treads in Each Flight

**This is "the heavy lifting" - count every tread.**

Look for notation like:
- "13 TREADS @ 11"" = 13 treads, each 11 inches deep
- "12 TREADS @ 11"" = 12 treads

**Method:**
1. Start at bottom flight, count: 1, 2, 3, 4... 13 treads
2. Move to next flight, count: 1, 2, 3, 4... 12 treads
3. Continue through all flights
4. Keep running total

**If tread counts vary between flights:**
- Note the variation
- Calculate average for summary
- Document the range in notes

### 4C: Verify Riser Heights (CODE CRITICAL)

Look for riser height notation:
- "14 EQ RSRS" = 14 equal risers
- "7'-6"" with 14 risers = 7'-6" ÷ 14 = ~6.43" per riser

**Check for CODE VIOLATION:**
- **IBC 1011.5.2**: Maximum 3/8" variation within a flight
- If you see "6 7/8"" and "7 3/8"" risers: 7 3/8" - 6 7/8" = 1/2" = **CODE VIOLATION**

**If you find a code violation:**
```
🔴 CRITICAL - CODE VIOLATION: Stair 5 (Sheet A0505.1-A0505.2)
   Riser heights vary from 6 7/8" to 7 3/8" (1/2" variation)
   IBC 1011.5.2 allows maximum 3/8" variation
   IMPACT: This will not pass building inspection
   ACTION REQUIRED: Architect must revise to uniform riser heights
```

### 4D: Measure Stair Width

Look for:
- Clear width dimension (usually 4'-0", 4'-6", 5'-0")
- "4'-0" CLR" = 4 feet clear width
- Check if width is consistent or varies

### 4E: Count and Measure Landings

**Count intermediate landings** between flights.

Look for:
- Landing dimensions: "5'-0" x 10'-0"" = 5 foot by 10 foot
- Number of landings per level
- Special landing conditions (doors opening onto landings)

**Method:**
- Count landings level-by-level
- Note dimensions (some may vary)
- Common sizes: 5'x10', 5'x11', 6'x11', etc.

### 4F: Check Section View

The vertical section (usually on same sheet) shows:
- Overall stair run from bottom to top
- Floor-to-floor heights
- Verify your flight counts match the section
- Look for any special conditions (short flights, transitions)

---

## Step 5: Compile Quantities Per Stair - Calculate BOM Line Items

For each stair, calculate the bill of materials using these formulas:

### 5A: Stringer Components

| Component | Formula | Example |
|-----------|---------|---------|
| Stringer Qty | Flights × 2 | 24 flights × 2 = 48 stringers |
| Stringer Length | Stair rise (floor-to-floor for that flight) | 12'-0 |

### 5B: Tread Components

| Component | Formula | Example |
|-----------|---------|---------|
| Tread Qty | Total treads counted from all flights | 288 treads |
| Tread Size | [gauge from details] x [stair width in inches] | 14ga x 48 |
| Tread Length | Stair width | 4'-0 |

### 5C: Landing Components

| Component | Formula | Example |
|-----------|---------|---------|
| Side Channels Qty | Landings × 2 | 15 landings × 2 = 30 |
| Side Channel Length | Landing depth | 5'-0 |
| Back Channels Qty | Landings × 1 | 15 landings × 1 = 15 |
| Back Channel Length | Landing width | 10'-0 |
| Headers Qty | Landings × 2 (typical) | 15 × 2 = 30 |
| Header Length | Landing width | 10'-0 |

**Header count note:** Headers typically run at front and back of landing. For deep landings (>8'), may have intermediate headers.

### 5D: Rail Components

| Component | Formula | Example |
|-----------|---------|---------|
| Top Rail Qty | Rail sections (usually = flights) | 24 flights = 24 top rails |
| Top Rail Length | Stair rise (same as stringer) | 12'-0 |
| Grab Rail Qty | Rail sections | 24 |
| Grab Rail Length | Stair rise + 4' extensions | 16'-0 |
| Post Qty | CEILING(rail length / 4') + 1, per section | 4 posts per 12' section × 24 = 96 |
| Post Length | Rail height | 3'-6 |

### 5E: Create Working Summary

Before generating CSV, summarize each stair:
```
STAIR 2 (Sequence B) - Sheet A0502
══════════════════════════════════════════════════════
MEASURED FROM DRAWINGS:
  Flights: 24
  Stair Width: 48" (4'-0")
  Total Treads: 288 (counted)
  Avg Rise per Flight: 12'-0
  Landings: 15 @ 5'-0" x 10'-0"
  Rail Sections: 24

CALCULATED BOM:
  Stringers: 48 × MC 12x10.6 @ 12'-0
  Treads: 288 × PL 14ga x 48 @ 4'-0
  Side Channels: 30 × MC 12x10.6 @ 5'-0
  Back Channels: 15 × MC 12x10.6 @ 10'-0
  Headers: 30 × W 10x12 @ 10'-0
  Top Rails: 24 × HSSR 1.5x0.12 @ 12'-0
  Grab Rails: 24 × HSSR 1.5x0.12 @ 16'-0
  Posts: 96 × HSSR 1.5x0.12 @ 3'-6

CODE COMPLIANCE: ✅ CLEAN
NOTES: Scissor configuration, full building height
══════════════════════════════════════════════════════
```

---

## Step 6: Generate the CSV File

Convert the working summaries into CSV format and write to file.

### 6A: CSV Structure

**File Header:**
```csv
Item,Sequence,Stair,Category,Component,Qty,Shape,Size,Length,Grade,Notes
```

**Line Item Numbering:**
- Start each stair at 10, 20, 30...
- Increment by 10 for each line
- This allows inserting lines later if needed

### 6B: Example CSV Output

```csv
Item,Sequence,Stair,Category,Component,Qty,Shape,Size,Length,Grade,Notes
10,A,Stair 1,Stringer,Stringer,8,MC,12 x 10.6,14'-0,A36,
20,A,Stair 1,Stringer,Tread,56,PL,14ga x 48,4'-0,A36,
30,A,Stair 1,Landing,Side Channel,6,MC,12 x 10.6,5'-0,A36,
40,A,Stair 1,Landing,Back Channel,3,MC,12 x 10.6,10'-0,A36,
50,A,Stair 1,Landing,Header,6,W,10 x 12,10'-0,A992,
60,A,Stair 1,Rail,Top Rail,4,HSSR,1 1/2 x 0.12,14'-0,A500,
70,A,Stair 1,Rail,Grab Rail,4,HSSR,1 1/2 x 0.12,18'-0,A500,
80,A,Stair 1,Rail,Post,20,HSSR,1 1/2 x 0.12,3'-6,A500,
90,B,Stair 2,Stringer,Stringer,48,MC,12 x 10.6,12'-0,A36,
100,B,Stair 2,Stringer,Tread,288,PL,14ga x 48,4'-0,A36,
110,B,Stair 2,Landing,Side Channel,30,MC,12 x 10.6,5'-0,A36,
120,B,Stair 2,Landing,Back Channel,15,MC,12 x 10.6,10'-0,A36,
130,B,Stair 2,Landing,Header,30,W,10 x 12,10'-0,A992,
140,B,Stair 2,Rail,Top Rail,24,HSSR,1 1/2 x 0.12,12'-0,A500,
150,B,Stair 2,Rail,Grab Rail,24,HSSR,1 1/2 x 0.12,16'-0,A500,
160,B,Stair 2,Rail,Post,96,HSSR,1 1/2 x 0.12,3'-6,A500,
```

### 6C: Write CSV File

Use the Write tool to create the CSV file:
```
/tmp/[ProjectName]_takeoff.csv
```

Or if user specified a different location, use that path.

### 6D: Components NOT in CSV (Document Separately)

These components require parametric templates or detailed takeoff and are NOT included in the CSV:

```
NOT EXTRACTED - REQUIRES POWERFAB PARAMETRIC EXPANSION:
═══════════════════════════════════════════════════════
LANDING COMPONENTS:
  - Clip angles (L 3x3x1/4)
  - Deck support angles
  - Deck plates
  - Hanger assemblies (threaded rod, washers, nuts, stiffeners, kickers)

RAIL COMPONENTS:
  - Bottom rail segments
  - Pickets (calculated from spacing)
  - Wall rail brackets
  - Post base plates

HARDWARE:
  - All bolts, nuts, washers
  - Anchor bolts
  - Weld consumables

Note: These will be calculated by PowerFab when you input the
landing dimensions and rail lengths from this takeoff.
═══════════════════════════════════════════════════════
```

---

## Step 7: Document Issues and Uncertainties

### Critical Issues (🔴):
```
🔴 CRITICAL ISSUES:

1. Stair 5 - CODE VIOLATION (Sheet A0505.1-A0505.2)
   Issue: Variable riser heights (6 7/8" to 7 3/8" = 1/2" variation)
   Code: IBC 1011.5.2 allows maximum 3/8" variation
   Impact: Will not pass building inspection
   Action: Architect must revise to uniform riser heights
   Affects: Estimated 21 flights, could impact structural opening dimensions
```

### Warnings (⚠️):
```
⚠️ COORDINATION VERIFICATION NEEDED:

1. Stair 4 - Variable Tread Notation (Sheet A0504.1)
   Issue: Shows "15 RISERS @ 6 7/8"" in one location, "12 RISERS @ 6 7/8"" in another
   Question: Are these different flights, or is there an error?
   Action: Verify with architect which is correct
```

### Uncertainties (❓):
```
❓ AREAS REQUIRING CLARIFICATION:

1. Stair 3 Landing Dimensions (Sheet A0503, Level 05)
   Cannot clearly determine: Landing appears to be 5'-0" x 10'-0" or possibly 5'-0" x 11'-0"
   Sheet reference: A0503, Level 05 plan view
   Request: Please verify dimension from architect

2. Stair 6 Material Specification
   Cannot clearly determine: Tread material callout is unclear on detail
   Sheet reference: Detail 3/A0511
   Assumption: Using standard checkered plate per typical detail 1/A0511
   Request: Confirm material specification
```

---

## Step 8: Cross-Check with Existing Data (If Provided)

If user provided an Excel file or previous takeoff:

**Compare quantities:**
```
COMPARISON TO CONTRACTOR'S EXCEL:

Item B (Stair 2):
- Contractor Excel: 24F, 48w, 12RE, (15) ldg. 5x10
- My Count: 24F, 48w, ~12RE average, ~15 landings
- Status: ✅ MATCH - Quantities align

Item F (Stair 5):
- Contractor Excel: 21F, 54w, 11RE, (16) ldg. 6x11
- My Count: 21F, 54w, variable RE (11-13), ~16 landings
- Status: ⚠️ DISCREPANCY - Contractor assumed uniform 11 RE, but drawings show variable
- Issue: Contractor's pricing based on uniform risers, but drawings show non-compliant variation
- Impact: If drawings get corrected, quantities may change slightly
```

---

## Step 9: Quality Check Your Work

Before delivering the takeoff, verify:

### CSV Quality:
- [ ] All stairs from the drawings are included
- [ ] CSV header row is correct
- [ ] Line item numbers increment properly (10, 20, 30...)
- [ ] Sequence letters match stair numbers (A=Stair 1, B=Stair 2...)
- [ ] Quantities make sense (stringers = flights × 2, etc.)
- [ ] Material sizes match what was found on detail sheets
- [ ] Lengths are in consistent format (e.g., 14'-0 not 14 ft)
- [ ] Grades are specified (A36, A992, A500)

### Calculations Check:
- [ ] Stringer count = flights × 2
- [ ] Tread count matches counted treads from drawings
- [ ] Side channels = landings × 2
- [ ] Back channels = landings × 1
- [ ] Post count is reasonable (rail length / 4' spacing)

### Documentation:
- [ ] Any code violations are flagged as 🔴 CRITICAL in text summary
- [ ] Any uncertainties are documented as ❓ in Notes column
- [ ] Sheet references available for verification
- [ ] "Not extracted" components clearly listed

---

## Step 10: Deliver the Takeoff

Provide TWO outputs:

### 10A: CSV File (for PowerFab Import)

Write the CSV file to the specified location:
```
✅ CSV file written: /tmp/[ProjectName]_takeoff.csv
   Lines: [count]
   Stairs: [list]
```

### 10B: Text Summary (for Coordination Review)

Provide a text summary with:

1. **Takeoff Summary** - What's in the CSV
2. **Critical Issues** (🔴 Code violations, safety issues)
3. **Coordination Warnings** (⚠️ Items needing verification)
4. **Uncertainties** (❓ What you couldn't determine - with sheet references)
5. **Components Not Extracted** - What PowerFab will need to calculate
6. **Sheet Reference List** (All sheets reviewed)

**Example closing:**
```
═══════════════════════════════════════════════════════════════════════════════
TAKEOFF COMPLETE

CSV OUTPUT: /tmp/OhioHealth_Womens_Center_takeoff.csv
  - 160 line items across 7 stairs

SUMMARY:
  Stairs Analyzed: 7 (Stair 1-7)
  Total Stringers: 184 pcs
  Total Treads: 1,300 pcs
  Total Landings: 68
  Total Rail Sections: 96

COMPONENTS IN CSV (ready for PowerFab import):
  ✅ Stringers (MC channels)
  ✅ Treads (plate with gauge)
  ✅ Landing channels (side, back)
  ✅ Landing headers (W beams)
  ✅ Rail components (top rail, grab rail, posts)

COMPONENTS NOT IN CSV (PowerFab will calculate):
  ❌ Clip angles, deck support
  ❌ Deck plates
  ❌ Hangers (rod, washers, nuts, stiffeners)
  ❌ Pickets
  ❌ Hardware

CRITICAL ACTIONS REQUIRED:
  1. 🔴 Resolve Stair 5 code violation (riser height variation)
  2. ⚠️ Verify Stair 4 tread count discrepancy
  3. ❓ Clarify Stair 3 Level 05 landing dimension

SHEETS REVIEWED:
  - A0500-A0508 (Stair plans)
  - A0510-A0512 (Details)

NEXT STEPS:
  1. Import CSV into PowerFab
  2. PowerFab will calculate remaining components from parametric templates
  3. Estimator adds pricing and labor codes
  4. Resolve coordination issues noted above

Prepared by: Claude Code
Date: [Date]
═══════════════════════════════════════════════════════════════════════════════
```

---

## Remember: Accuracy Over Speed

- If you can't read a dimension → **ASK**
- If counts don't match between sheets → **FLAG IT**
- If code compliance is questionable → **CALL IT OUT**
- If you're making an assumption → **STATE IT**

**The user would rather have a takeoff with 5 questions than a takeoff with 5 wrong numbers.**

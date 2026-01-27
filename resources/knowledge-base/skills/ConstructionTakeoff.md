---
name: ConstructionTakeoff
description: Professional construction document quantity takeoff and coordination review for Division 5500 (Metal Fabrications/Stairs). Creates accurate contractor-style scope documents with detailed flight/tread counts, riser verification, and cross-discipline coordination checks. Follows professional estimator methodology. USE WHEN user requests quantity takeoff, construction estimating, stair takeoff, coordination review, QC review of construction documents, Division 5500 scope, or construction document analysis.
---

# ConstructionTakeoff

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

### ⚠️ RISER HEIGHTS - CRITICAL FOR CODE COMPLIANCE

**You MUST read the actual riser callouts from EVERY flight:**
1. Find the callout (e.g., "13 RISERS @ 7 3/8"") on the section view
2. Record the EXACT height shown for each flight
3. Compare heights across all flights in the stair
4. Flag any variation exceeding 3/8" as 🔴 CODE VIOLATION (IBC 1011.5.2)

**Estimating "~10 treads per flight" is NOT acceptable** - it masks code violations and defeats the purpose of the takeoff.

---

## Workflow Procedures (MUST LOAD BEFORE STARTING WORK)

This skill provides domain knowledge — what to look for, code requirements, and output format. The **detailed step-by-step procedures** for how to execute the work are in separate workflow files.

**You MUST load the appropriate workflow using `read_documentation` before beginning any task.** The methodology summary later in this file is a high-level overview only — the workflow files contain the full procedures.

### How to load a workflow:

Use the `read_documentation` tool with the file path:

- `read_documentation("workflows/QuantityTakeoff.md")` — 548-line detailed counting procedure: per-stair data collection steps, CSV output column definitions, how to count flights/treads/risers, how to compile the bill of materials. **Load this for any takeoff task.**
- `read_documentation("workflows/CoordinationReview.md")` — Cross-discipline conflict checking procedure: what to compare across architectural/structural/civil, RFI format, how to categorize findings. **Load this when reviewing coordination.**
- `read_documentation("workflows/FullAnalysis.md")` — Combined takeoff + coordination in one pass: orchestrates both workflows together. **Load this when user wants complete document analysis.**
- `read_documentation("workflows/ExtractSheets.md")` — How to identify and extract relevant pages from large PDFs (100+ pages): locating sheet indices, identifying target sheets by division. **Load this when working with large PDFs.**

### Which workflow to load (based on user request):

| User wants | Workflow to load |
|------------|-----------------|
| Quantity takeoff, stair count, estimate quantities | `workflows/QuantityTakeoff.md` |
| Coordination review, QC review, find conflicts | `workflows/CoordinationReview.md` |
| Full analysis, complete review, takeoff + coordination | `workflows/FullAnalysis.md` |
| Extract sheets from large PDF, find specific pages | `workflows/ExtractSheets.md` |

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

> **NOTE:** This is a high-level overview. The full step-by-step procedure with detailed instructions is in the workflow files. Load the appropriate workflow using `read_documentation` before starting work.

**Step 1: Read Detail Sheets**
- Understand HOW it's built (materials, connections, rail details)
- Note specifications (055113 Metal Pan Stairs, 055213 Railings, etc.)
- Identify material types (bent plate, checker plate, pipe sizes)

**Step 2: Go to Plan/Section Sheets - READ ACTUAL CALLOUTS**
- Count FLIGHTS per level
- **READ the actual riser/tread callouts** (e.g., "13 RISERS @ 7"") - DO NOT estimate
- Count TREADS in each flight ("the heavy lifting")
- Record the **exact riser height** shown for each flight
- Measure or note LANDING sizes
- Record stair widths

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

## PDF Extraction Workflow

Large construction document PDFs (often 300+ pages, 100+ MB) require strategic extraction.

### Process

**Step 1: Locate Sheet Index OR Search for Sheet Numbers**

Option A - Find Index (if available):
- Check first 10-20 pages for drawing index/sheet list
- Index lists all sheet numbers with page numbers

Option B - Search using pdftotext (faster for large PDFs):
```bash
# Search for stair sheets (A05xx) across page ranges
pdftotext -f 1 -l 30 "input.pdf" - | grep -i -E "(stair|A05)"

# Find which page ranges contain A05xx sheets
for range in "80-100" "100-120" "120-140" "140-160" "160-180" "180-200" "200-220" "220-240" "240-260"; do
  start=$(echo $range | cut -d- -f1)
  end=$(echo $range | cut -d- -f2)
  echo "=== Pages $range ==="
  pdftotext -f $start -l $end "input.pdf" - 2>/dev/null | grep -o "A05[0-9][0-9]" | sort -u
done
```

**NOTE:** Sheet locations vary widely between projects. Don't assume A05xx sheets are in a specific page range - always search first.

**Step 2: Identify Target Sheets**
- For Division 5500 (Stairs):
  - Architectural: A0500-A0512 series (Stair Plans & Details)
  - Structural: S0500 series (Structural details)
  - Structural: S0100 series (Foundation/Framing plans)
  - Structural: S0001 (Structural notes)

**Step 3: Extract Individual Pages as PNG for Reading**
```bash
# Extract specific page as PNG (better for visual reading)
gs -sDEVICE=png16m -dNOPAUSE -dBATCH -dSAFER -r150 \
   -dFirstPage=X -dLastPage=X \
   -sOutputFile=/tmp/ProjectName_Analysis/pX.png "input.pdf"
```

**Step 4: Extract Page Ranges as PDF (for archiving)**
```bash
gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH -dSAFER \
   -dFirstPage=X -dLastPage=Y \
   -sOutputFile=output.pdf input.pdf
```

**Step 4: Organize Extracted Files**
```
/tmp/[ProjectName]_Analysis/
├── Architectural_Stairs/
│   ├── A0500-A0501_Stairs.pdf
│   ├── A0502-A0503_Stairs.pdf
│   └── A0510-A0512_Details.pdf
├── Structural/
│   ├── S0001_Notes.pdf
│   ├── S0100_Foundations.pdf
│   └── S0101_Framing.pdf
└── README.md (extraction log)
```

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
User: "Do a quantity takeoff for the stairs in C:\Projects\Building_Plans.pdf"
→ Invokes ExtractSheets workflow (if PDF is large)
→ Invokes QuantityTakeoff workflow
→ Reads detail sheets (A0510-A0512) to extract material specifications
→ Reads plan sheets (A0500-A0508) to count flights and treads
→ Counts every tread in every flight ("the heavy lifting")
→ Calculates BOM quantities (stringers, treads, landing channels, rails)
→ Produces CSV file for PowerFab import:
  C:\Projects\Building_Plans_takeoff.csv  (SAME DIRECTORY as input PDF)
  - 160 line items across 7 stairs
  - Stringers, treads, landing components, rail components
→ Produces text summary:
  C:\Projects\Building_Plans_takeoff_summary.txt
  - Quantities summary
  - Code compliance status
  - Coordination issues
  - Components NOT extracted (for PowerFab to calculate)
→ Notes any uncertainties in CSV Notes column
```

**Example 2: QC Coordination Review**
```
User: "Review these construction docs for coordination issues, focusing on Division 5500"
→ Invokes FullAnalysis workflow (combines takeoff + coordination)
→ Extracts relevant sheets (architectural, structural)
→ Performs quantity takeoff (primary deliverable)
→ Cross-checks architectural vs structural:
  - Stair locations match?
  - Opening dimensions match?
  - Structural support adequate?
→ Checks code compliance (riser heights, tread depths)
→ Produces report with:
  ✅ Clean items (Stairs 1, 2, 3, 6, 7)
  🔴 Critical issues (Stair 5: Code violation - riser heights vary by 1/2")
  ⚠️ Verification needs (Check structural opening for Stair 4)
  ❓ Questions (RFI: Clarify landing support at Level 03)
```

**Example 3: Large PDF with Index**
```
User: "This is a 350MB PDF at C:\Downloads\BigProject.pdf - can you do a takeoff?"
→ Invokes ExtractSheets workflow first
→ Reads first 10 pages to locate sheet index
→ Identifies relevant pages:
  - A0500-A0512 (Architectural Stairs): Pages 250-266
  - S0100 series (Structural): Pages 18-80
→ Uses ghostscript to extract only needed pages
→ Organizes temp files into /tmp/BigProject_Analysis/ directory
→ Then proceeds with QuantityTakeoff workflow on extracted files
→ Produces CSV file: C:\Downloads\BigProject_takeoff.csv (same dir as input)
→ Produces summary: C:\Downloads\BigProject_takeoff_summary.txt
```

**Example 4: Uncertain Area - Asking for Help**
```
User: "Do a takeoff for Stair 5"
→ Invokes QuantityTakeoff workflow
→ Reads sheet A0505.1
→ Counts flights: 21 flights ✅
→ Counts treads: Varies - sees "11 treads", "12 treads", "13 treads"
→ Reads riser heights: Shows "6 7/8", "7", "7 3/8" - INCONSISTENT
→ **STOPS and asks user:**
  "❓ UNCERTAINTY: Stair 5 (sheet A0505.1-A0505.2) shows variable tread counts
   and riser heights across different flights. I can see:
   - Some flights: 11 treads @ 6 7/8" risers
   - Some flights: 12 treads @ 7" risers
   - Some flights: 13 treads @ 7 3/8" risers

   This creates two issues:
   1. Which tread count should I use for the takeoff?
   2. The riser variation (1/2") exceeds IBC code (max 3/8")

   Should I:
   A) Use the most common count and flag as code violation?
   B) Calculate an average and note the variation?
   C) List all variations and request clarification from architect?

   Please advise how you'd like me to document this."
→ Waits for user guidance before proceeding
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

## File Organization

### Working/Intermediate Files → `/tmp/`

**ALL intermediate files during analysis should use `/tmp/`:**
- Extracted PDF pages
- Converted PNG images for reading
- Draft notes and working files
- Temporary analysis files

```
/tmp/[ProjectName]_Analysis/
├── Architectural_Stairs/
│   ├── page_250.png
│   ├── page_251.png
│   └── ...
├── Structural/
├── takeoff_draft.md
└── README.md (extraction log with page numbers)
```

These files are temporary and do not need to persist after the session.

---

### Final Output Files → Same Directory as Input PDF

**ONLY the final deliverables** should be saved to the **same directory as the input PDF**:

**1. CSV File (for PowerFab Import):**
```
[InputPDF_Directory]/[ProjectName]_takeoff.csv
- Line-item bill of materials
- Columns: Item, Sequence, Stair, Category, Component, Qty, Shape, Size, Length, Grade, Notes
- Includes: Stringers, treads, landing channels, headers, rail components
```

**2. Text Summary (for Coordination Review):**
```
[InputPDF_Directory]/[ProjectName]_takeoff_summary.txt

REQUIRED SECTIONS (in this order):
1. Project Information (name, date, architect)
2. Stair Summary (table of all stairs with flights/treads)
3. Quantities Totals
4. 🔴 CODE COMPLIANCE STATUS (critical issues first)
5. ⚠️ COORDINATION NOTES
6. 📋 ASSUMPTIONS MADE ← MANDATORY - List ALL assumptions
7. Items NOT included (for PowerFab to calculate)
8. Sheet References
9. Disclaimer
```

**📋 ASSUMPTIONS SECTION IS MANDATORY** - Must include:
- Material assumptions (steel grades, sizes not verified on drawings)
- Quantity assumptions (estimated vs. counted values)
- Dimension assumptions (landing sizes, stair widths if estimated)
- Any values not directly read from the drawings

**Example:** If input is `C:\Users\nick\Downloads\Project_Drawings.pdf`, save outputs to:
- `C:\Users\nick\Downloads\Project_Drawings_takeoff.csv`
- `C:\Users\nick\Downloads\Project_Drawings_takeoff_summary.txt`

---

## Key Principles

1. **ACCURACY OVER SPEED** - Never rush or guess
2. **ASK WHEN UNSURE** - User would rather answer questions than get wrong numbers
3. **DOCUMENT EVERYTHING** - Include sheet references for all quantities
4. **FLAG CODE ISSUES** - Code violations are critical coordination problems
5. **FOLLOW THE METHODOLOGY** - Read details first, then count (like professional estimators do)

---

## Related Files

### Workflow Documentation (load via `read_documentation`)
- `workflows/QuantityTakeoff.md` - Main takeoff process (step-by-step counting)
- `workflows/CoordinationReview.md` - Cross-discipline coordination checks
- `workflows/FullAnalysis.md` - Combined takeoff + coordination
- `workflows/ExtractSheets.md` - PDF extraction using index and ghostscript

---

**This skill transforms large construction document PDFs into accurate, contractor-ready quantity takeoffs with coordination issue identification - following the exact methodology professional estimators use.**

# CoordinationReview Workflow

**Purpose: Cross-discipline coordination review for Division 5500 (Stairs/Railings)**

**Focus:** Finding conflicts between architectural, structural, civil, and landscape documents.

---

## Philosophy

"Many times structural do not match architectural." - User

This workflow identifies mismatches that cause:
- Field coordination problems
- RFIs during construction
- Change orders
- Construction delays
- Code violations

---

## Step 1: Understand Scope of Review

**Primary Discipline:** Architectural (Division 5500 - Stairs/Railings)

**Cross-Check Disciplines:**
- **Structural**: Stair openings, support framing, connections, loading
- **Architectural**: Space planning, dimensions, finishes, code compliance
- **Civil** (if applicable): Site grading, exterior stair connections
- **Landscape** (if applicable): Coordination with exterior stairs

---

## Step 2: Gather Required Sheets

### Architectural Sheets:
- A0500-A0508: Stair plans and sections
- A0510-A0512: Stair details
- A0100 series: Overall floor plans (for context)

### Structural Sheets:
- S0001: Structural notes
- S0100 series: Foundation plans showing stair support
- S0101-S0102 series: Framing plans showing stair openings
- S0500 series: Structural stair details (if present)

### Civil/Landscape (if exterior stairs):
- C series: Site grading plans
- L series: Landscape plans adjacent to stairs

---

## Step 3: Create Coordination Matrix

Use this systematic approach to check each stair:

### For Each Stair, Verify:

#### 3A: Location Agreement
- [ ] Stair location on architectural floor plans matches structural framing plans
- [ ] Grid line references consistent between disciplines
- [ ] Dimensions from reference points match

**Check:**
```
Architectural (A0100.C): "Stair 2 between grid lines C6-D6"
Structural (S0101.B): Does framing show opening at C6-D6?
```

#### 3B: Opening Dimensions
- [ ] Stair opening length on architectural matches structural
- [ ] Stair opening width on architectural matches structural
- [ ] Any dimensional conflicts?

**Check:**
```
Architectural (A0502): Stair 2 overall run shows 11'-11" + landing + 11'-11"
Structural (S0101.B): Does opening dimension accommodate this?
```

#### 3C: Support/Bearing
- [ ] Structural shows adequate support at stair landings
- [ ] Beam/column locations don't conflict with stair path
- [ ] Landing support method clear

**Common issues:**
- Landing shown on architectural but no structural support indicated
- Beam conflicts with headroom
- Column in middle of stair path

#### 3D: Floor Elevations
- [ ] Floor elevations match between architectural and structural
- [ ] Verify finished floor heights vs structural slab heights
- [ ] Account for floor finishes (tile, carpet, etc.)

**Check:**
```
Architectural: Level 01 = 100'-0"
Structural: Level 01 Top of Slab = 99'-9" (allows for 3" finish)
  → OK if 3" finish specified
  → PROBLEM if elevations assumed to be same
```

#### 3E: Loading Conditions
- [ ] Structural notes indicate live load for stairs (typically 100 psf)
- [ ] If heavy rail or glass specified, structural designed for it?
- [ ] Seismic detailing adequate for connections?

---

## Step 4: Code Compliance Review

### IBC Requirements (Chapter 10):

#### 4A: Riser Heights
**IBC 1011.5.2:** Maximum 3/8" variation within any flight

**Check each stair for:**
- Uniform riser heights
- No variation greater than 3/8"
- Risers calculated correctly for floor-to-floor height

**Example Check:**
```
Stair 5 (Sheet A0505.1):
Floor-to-floor: 15'-4" (184 inches)
Shown: "11 treads" → This means 12 risers (one more riser than treads)
Calculated riser: 184" ÷ 12 = 15.33" → TOO HIGH (max is usually 7")

Something is wrong. Check notation more carefully.

Actually shows: Some flights "11 RISERS" others "12 RISERS" others "13 RISERS"
AND: Different riser heights "6 7/8"", "7"", "7 3/8""

🔴 CRITICAL CODE VIOLATION: Multiple issues
   1. Riser height variation: 7 3/8" - 6 7/8" = 1/2" (exceeds 3/8" max)
   2. Inconsistent riser counts suggest calculation errors
```

#### 4B: Tread Depths
**IBC 1011.5.3:** Minimum 11" for most occupancies, max 3/8" variation

**Check:**
- All treads shown at 11" (typical)
- Consistent throughout each flight

#### 4C: Stair Width
**IBC 1011.2:** Minimum width based on occupancy and occupant load

**Check:**
- Verify stair width meets code for building type
- Width doesn't reduce below minimum when railings added
- Consistent width throughout (no pinch points)

#### 4D: Headroom
**IBC 1011.3:** Minimum 6'-8" clear headroom

**Check:**
- Structural beams don't reduce headroom below 6'-8"
- Particularly critical at landings where beams often frame

---

## Step 5: Identify and Categorize Issues

### 🔴 CRITICAL ISSUES (Must Fix Before Construction)

**Examples:**
- Code violations (riser height variation, inadequate width, insufficient headroom)
- Safety hazards
- Architectural shows stair but no structural support
- Dimensional conflicts preventing construction

**Documentation Format:**
```
🔴 CRITICAL ISSUE #1: Stair 5 Code Violation

Description: Riser heights vary from 6 7/8" to 7 3/8" (1/2" variation)

Code Reference: IBC 1011.5.2 (max 3/8" variation)

Sheet References:
- Architectural: A0505.1, A0505.2 (shows variable risers)
- Structural: S0101.C (framing plan Level 01)

Impact:
- Will not pass building inspection
- Must be corrected before permit approval
- May affect structural opening if riser count changes

Recommended Action:
- Issue RFI to architect to provide uniform riser heights
- Verify structural opening accommodates corrected geometry
- Update contractor's takeoff if quantities change
```

### ⚠️ COORDINATION WARNINGS (Should Verify)

**Examples:**
- Dimensions that don't clearly match but might be OK
- Missing information (not clear if it's an error or just not shown)
- Potential conflicts needing clarification

**Documentation Format:**
```
⚠️ WARNING #1: Stair 4 Riser Count Discrepancy

Description: Shows "15 RISERS @ 6 7/8"" in one location, "12 RISERS @ 6 7/8"" in another

Sheet References:
- A0504.1 (plan view shows "15 RISERS")
- A0504.1 (section view shows "12 RISERS")

Possible Explanations:
1. Different flights at different levels (need to verify which is which)
2. Notation error (one is wrong)
3. Change not coordinated (drawings partially updated)

Recommended Action:
- Clarify with architect which count is correct for each flight
- Verify with floor-to-floor heights and riser height
```

### ✅ CLEAN ITEMS (Verified and Coordinated)

**Examples:**
- Dimensions match between disciplines
- Adequate structural support shown
- Code-compliant details
- Clear and complete information

**Documentation Format:**
```
✅ CLEAN: Stair 1 (Sheet A0500)

Verified:
- Location on A0100.B matches structural framing plan S0101.B at grid lines
- Opening dimensions: 12'-0" x 8'-6" (architectural) matches structural opening (S0101.B)
- Adequate support shown for landings
- Riser heights uniform at 6 7/8" throughout (code compliant)
- Width 4'-0" clear (meets code)
- No headroom conflicts with structural beams

Status: Ready for construction, no coordination issues identified
```

---

## Step 6: Cross-Reference with Structural Calculations

If structural calculations are available (usually separate document):

**Check:**
- [ ] Stair loading assumptions match architectural details
- [ ] Deflection limits appropriate for stair type
- [ ] Connection details match between structural drawings and calculations
- [ ] Any special seismic detailing required and shown

**Common Disconnect:**
- Calculations assume one stair configuration
- Drawings show different configuration
- Need to verify which is correct

---

## Step 7: Generate Coordination Report

### Report Structure:

```
═══════════════════════════════════════════════════════════════════
CONSTRUCTION COORDINATION REVIEW
Division 5500: Stairs and Railings

Project: [Project Name]
Date: [Date]
Reviewed By: Claude Code + [User Name]
Disciplines Reviewed: Architectural, Structural

═══════════════════════════════════════════════════════════════════

EXECUTIVE SUMMARY:

Stairs Reviewed: 7 (Stair 1-7)
Overall Status:
- ✅ Clean: 5 stairs (1, 2, 3, 6, 7)
- ⚠️ Verification Needed: 1 stair (4)
- 🔴 Critical Issues: 1 stair (5)

Critical Actions Required:
1. Resolve Stair 5 code violation before permit approval
2. Clarify Stair 4 riser count discrepancy
3. Verify structural opening for Stair 5 after revision

═══════════════════════════════════════════════════════════════════

🔴 CRITICAL ISSUES (Must Resolve):

[Detailed critical issue descriptions with sheet references]

═══════════════════════════════════════════════════════════════════

⚠️ COORDINATION WARNINGS (Should Verify):

[Detailed warning descriptions with sheet references]

═══════════════════════════════════════════════════════════════════

✅ CLEAN ITEMS (Verified):

Stair 1 (Sheet A0500):
- Location coordinated between architectural and structural
- Dimensions match
- Code compliant
- No issues identified

Stair 2 (Sheet A0502):
- Location coordinated
- Opening dimensions match
- Adequate structural support
- Code compliant
- No issues identified

[Continue for all clean stairs...]

═══════════════════════════════════════════════════════════════════

SHEET REFERENCE SUMMARY:

Architectural Sheets Reviewed:
- A0500-A0508: Individual stair plans
- A0510-A0512: Typical details
- A0100.A-C: Overall floor plans

Structural Sheets Reviewed:
- S0001: Structural notes
- S0100.A-D: Foundation plans
- S0101.B-C, S0102.A: Framing plans

═══════════════════════════════════════════════════════════════════

RECOMMENDATIONS:

Immediate Actions (Pre-Permit):
1. 🔴 Issue RFI for Stair 5 code violation resolution
2. ⚠️ Clarify Stair 4 discrepancy via architect

Pre-Construction Actions:
1. Re-verify Stair 5 quantities after architect revises drawings
2. Update structural framing if opening dimensions change
3. Confirm all RFI responses incorporated into final drawings

Construction Phase Watch Items:
1. Verify actual floor-to-floor dimensions match drawings
2. Check that riser heights are built uniformly
3. Confirm structural support details before rough-in

═══════════════════════════════════════════════════════════════════

REPORT PREPARED BY: Claude Code
DATE: [Date]
STATUS: Ready for review and distribution
═══════════════════════════════════════════════════════════════════
```

---

## Step 8: Common Coordination Issues to Watch For

### Issue Type 1: "The Classic" - Beam Conflict
```
Architectural: Shows stair with 6'-10" headroom
Structural: Shows W18 beam (18" deep) crossing at that location
Result: 6'-10" - 18" = 5'-4" headroom → CODE VIOLATION (need 6'-8" min)
```

### Issue Type 2: "The Missing Support"
```
Architectural: Shows large landing at mid-level
Structural: No beam or column shown supporting that landing
Result: How is landing supported? Need clarification.
```

### Issue Type 3: "The Elevation Mix-Up"
```
Architectural: Level 01 = 100'-0" (finished floor)
Structural: Level 01 = 99'-9" (top of slab)
Stair designed from: Which elevation?
Result: 3" discrepancy in riser calculations if not coordinated
```

### Issue Type 4: "The Drawing Revision Lag"
```
Architectural: Stair moved 5 feet north (per latest revision)
Structural: Still shows opening at old location (not updated)
Result: Stair won't fit in structural opening as built
```

---

## Step 9: Output the Report

Provide the coordination report to the user in a format ready for:
- Distribution to project team
- Attachment to RFIs
- Reference during construction
- Quality control documentation

---

## Remember

- Coordination review is about **finding problems before construction**
- Better to over-report potential issues than miss a critical one
- Always provide sheet references so others can verify your findings
- Distinguish between "definitely wrong" (🔴) and "unclear, needs checking" (⚠️)
- Clean items (✅) are just as important to document - shows thoroughness

---

## Integration with Quantity Takeoff

**When running CoordinationReview after QuantityTakeoff:**

The coordination review may reveal that quantities need adjustment:

```
Coordination Issue → Quantity Impact:

Stair 5 Code Violation:
- Current takeoff: 21F, 11 RE average
- After fix (uniform risers): May change to 21F, 12 RE average
- Impact: Slight increase in tread count, affects material takeoff
- Action: Note in takeoff that quantities are "pending code compliance revision"
```

**Mark affected quantities as "PENDING COORDINATION"** until resolved.

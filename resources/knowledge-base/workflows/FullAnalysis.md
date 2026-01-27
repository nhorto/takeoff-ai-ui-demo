# FullAnalysis Workflow

**Purpose: Complete construction document analysis combining quantity takeoff + coordination review**

This workflow produces both deliverables in one pass:
1. **PRIMARY:** Accurate quantity takeoff (contractor scope format)
2. **SECONDARY:** Coordination review (conflict identification)

---

## When to Use This Workflow

Use **FullAnalysis** when:
- User wants "complete analysis" or "full review"
- User asks for "takeoff and coordination" together
- User says "analyze these construction documents"
- You're doing QC review that needs both quantities and coordination

Use separate workflows when:
- User specifically asks for just quantities → **QuantityTakeoff** only
- User specifically asks for just coordination → **CoordinationReview** only
- Time is limited → Do **QuantityTakeoff** first (higher priority)

---

## Step 1: Initial Setup

### 1A: Clarify Scope
Ask user to confirm:
- Which stairs to analyze? (All? Specific ones?)
- Primary focus is quantity takeoff - confirm this is understood
- Estimated time: Full analysis typically takes longer than individual workflows

### 1B: Check PDF Size
If PDF is large (>50MB or >100 pages):
→ **Invoke ExtractSheets workflow first**

### 1C: Create Working Directory
```bash
mkdir -p /tmp/[ProjectName]_Analysis/{Architectural_Stairs,Structural,Output}
```

---

## Step 2: Execute Quantity Takeoff (PRIMARY DELIVERABLE)

**Follow the complete QuantityTakeoff workflow:**

1. Read detail sheets (A0510-A0512) - Understand construction
2. Analyze each stair systematically
3. Count flights, treads, landings
4. Verify code compliance (riser heights)
5. Compile quantities per stair
6. Create output table

**Deliverable from this step:**
```
CONSTRUCTION QUANTITY TAKEOFF TABLE
[Excel-ready format with all quantities]
```

**⚠️ CRITICAL:** Do not proceed to coordination review until takeoff is complete and verified.

---

## Step 3: Execute Coordination Review (SECONDARY DELIVERABLE)

**Follow the CoordinationReview workflow:**

1. Gather structural sheets
2. Create coordination matrix
3. Check:
   - Location agreement
   - Opening dimensions
   - Support/bearing
   - Floor elevations
   - Loading conditions
4. Identify issues:
   - 🔴 Critical issues
   - ⚠️ Coordination warnings
   - ✅ Clean items
5. Generate coordination report

**Deliverable from this step:**
```
COORDINATION REVIEW REPORT
[Categorized issues with sheet references]
```

---

## Step 4: Cross-Reference Between Takeoff and Coordination

**Important:** Coordination issues may affect takeoff quantities.

### Check for Impacts:

**If coordination review found code violations:**
```
Example:
Stair 5 has code violation (riser height variation)
→ Architect will need to revise to uniform risers
→ Riser count may change
→ Quantities may change

Action: Flag affected quantities as "PENDING COORDINATION RESOLUTION"
```

**If coordination review found dimensional conflicts:**
```
Example:
Stair 4 architectural opening: 10'-0" x 20'-0"
Stair 4 structural opening: 9'-6" x 20'-0"
→ One of these is wrong
→ If architectural is wrong, stair dimensions may change
→ Quantities may change

Action: Note uncertainty in takeoff, require clarification
```

### Update Takeoff with Coordination Impacts:

```
QUANTITY TAKEOFF - UPDATED WITH COORDINATION IMPACTS:

ITEM F - Stair 5:
Quantities: 21F, 54w, 11RE, (16) 6x11
Status: ⚠️ PENDING - See Coordination Issue #1
Note: Quantities based on current drawings showing variable risers.
      After architect revises for code compliance, riser count may increase to 12 RE.
      Recommend final pricing after resolution.
```

---

## Step 5: Compile Integrated Report

Combine both deliverables into one comprehensive document:

```
═══════════════════════════════════════════════════════════════════════════════
CONSTRUCTION DOCUMENT ANALYSIS - DIVISION 5500 STAIRS AND RAILINGS
Complete Quantity Takeoff + Coordination Review

Project: [Project Name]
Date: [Date]
Reviewed By: Claude Code + [User Name]
Analysis Type: Full Analysis (Takeoff + Coordination)

═══════════════════════════════════════════════════════════════════════════════

PART 1: QUANTITY TAKEOFF (PRIMARY DELIVERABLE)

[Insert complete quantity takeoff table]

═══════════════════════════════════════════════════════════════════════════════

PART 2: COORDINATION REVIEW (SECONDARY DELIVERABLE)

SUMMARY:
- ✅ Clean Items: [Count]
- ⚠️ Coordination Warnings: [Count]
- 🔴 Critical Issues: [Count]

CRITICAL ISSUES:
[List all critical issues with sheet references]

COORDINATION WARNINGS:
[List all warnings with sheet references]

CLEAN ITEMS:
[List all clean/coordinated items]

═══════════════════════════════════════════════════════════════════════════════

PART 3: INTEGRATED FINDINGS

QUANTITIES AFFECTED BY COORDINATION ISSUES:

1. Stair 5 (Item F):
   Coordination Issue: Code violation - variable riser heights
   Quantity Impact: May increase from 11 RE average to 12 RE after correction
   Recommendation: Hold final pricing until code violation resolved
   Sheet References: A0505.1-A0505.2

2. Stair 4 (Item D):
   Coordination Issue: Riser count discrepancy between plan and section
   Quantity Impact: Uncertain - need clarification on correct count
   Recommendation: Issue RFI before finalizing takeoff
   Sheet References: A0504.1

═══════════════════════════════════════════════════════════════════════════════

PART 4: ACTION ITEMS

IMMEDIATE ACTIONS (Pre-Permit):
1. 🔴 CRITICAL: Issue RFI for Stair 5 code violation
   - Requires architect to revise riser heights
   - Blocks permit approval
   - Sheet Reference: A0505.1-A0505.2

2. ⚠️ COORDINATION: Clarify Stair 4 riser count discrepancy
   - Affects quantity takeoff accuracy
   - Sheet Reference: A0504.1

PRE-CONSTRUCTION ACTIONS:
1. Re-verify Stair 5 quantities after architect revises drawings
2. Update contractor takeoff if riser counts change
3. Confirm structural openings accommodate revised geometry

CONSTRUCTION PHASE WATCH ITEMS:
1. Verify actual floor-to-floor dimensions match drawings
2. Check riser heights are built uniformly (per code)
3. Confirm structural support details before rough-in

═══════════════════════════════════════════════════════════════════════════════

PART 5: DOCUMENTATION

SHEETS REVIEWED:

Architectural:
- A0500-A0508: Individual stair plans and sections
- A0510-A0512: Typical stair details
- A0100.A-C: Overall floor plans (context)

Structural:
- S0001: Structural notes
- S0100.A-D: Foundation plans
- S0101.B-C, S0102.A: Framing plans

SPECIFICATIONS REFERENCED:
- 055113: Metal Pan Stairs
- 055213: Pipe and Tube Railing

CODE REFERENCES:
- IBC Section 1011: Stair requirements
- IBC 1011.5.2: Riser height uniformity (max 3/8" variation)
- IBC 1011.5.3: Tread depth requirements

═══════════════════════════════════════════════════════════════════════════════

PART 6: UNCERTAINTIES AND QUESTIONS

❓ AREAS REQUIRING CLARIFICATION:

1. [List any quantities that could not be clearly determined]
2. [List any coordination items that need verification]
3. [List any assumptions made that should be confirmed]

═══════════════════════════════════════════════════════════════════════════════

REPORT STATUS: COMPLETE

Primary Deliverable (Quantity Takeoff): ✅ Complete with noted uncertainties
Secondary Deliverable (Coordination Review): ✅ Complete with action items

Next Steps:
1. Distribute report to project team
2. Issue RFIs for critical items
3. Update quantities after coordination resolutions
4. Proceed with final pricing after all RFIs answered

═══════════════════════════════════════════════════════════════════════════════

Prepared By: Claude Code
Date: [Date]
Version: 1.0 - Initial Analysis
Distribution: [User to specify - Architect, Engineer, Contractor, etc.]

═══════════════════════════════════════════════════════════════════════════════
```

---

## Step 6: Quality Check the Integrated Report

Before delivering, verify:

### Takeoff Quality:
- [ ] All stairs included
- [ ] All quantities have sheet references
- [ ] Code violations flagged
- [ ] Uncertainties documented
- [ ] Excel-ready format

### Coordination Quality:
- [ ] All disciplines cross-referenced
- [ ] Issues categorized properly (🔴 ⚠️ ✅)
- [ ] Sheet references for all findings
- [ ] Clear action items identified
- [ ] Impact to quantities noted

### Integration Quality:
- [ ] Coordination issues linked to affected quantities
- [ ] Action items prioritized
- [ ] Next steps clear
- [ ] Professional format ready for distribution

---

## Step 7: Deliver Integrated Report to User

Provide the complete report with:

**Deliverables:**
1. Integrated report (markdown format)
2. Summary of critical actions
3. List of uncertainties requiring user input
4. Recommendation for next steps

**Example delivery message:**
```
✅ FULL ANALYSIS COMPLETE

Analyzed: 7 stairs (Stair 1-7)
Reviewed: 15 architectural sheets, 8 structural sheets

PRIMARY DELIVERABLE - Quantity Takeoff:
- Complete Excel-ready takeoff table
- Total: ~111 flights, ~1,300 treads, ~68 landings
- Status: Complete with 2 items pending coordination resolution

SECONDARY DELIVERABLE - Coordination Review:
- Clean Items: 5 stairs (1, 2, 3, 6, 7)
- Coordination Warnings: 1 stair (4)
- Critical Issues: 1 stair (5 - CODE VIOLATION)

CRITICAL ACTIONS REQUIRED:
1. 🔴 Resolve Stair 5 code violation before permit approval
2. ⚠️ Clarify Stair 4 riser count discrepancy
3. Update quantities after resolutions

Full integrated report ready above. Would you like me to:
A) Export this to a specific format (PDF, Word, etc.)
B) Create RFI drafts for the critical items
C) Re-analyze specific stairs after revisions
D) Proceed with next phase of project
```

---

## Step 8: Follow-Up Actions

After delivering the integrated report:

### If User Has Questions:
- Answer specific questions about quantities
- Clarify coordination issues
- Explain code violations in more detail
- Walk through specific sheet references

### If Coordination Issues Get Resolved:
- Update quantities based on revised drawings
- Re-run analysis on affected stairs
- Document changes from original analysis
- Provide "Revision 1" of integrated report

### If User Wants to Proceed:
- Offer to help draft RFIs
- Offer to create summary for distribution
- Offer to track action item resolutions
- Offer to re-analyze after revisions

---

## Timing Considerations

**Typical Duration for Full Analysis:**

- Small project (2-3 stairs): ~30-45 minutes
- Medium project (5-7 stairs): ~60-90 minutes
- Large project (10+ stairs): ~2-3 hours

**If time is limited:**
1. Do **QuantityTakeoff** first (primary deliverable)
2. Flag that you'll follow up with coordination review
3. User gets actionable quantities immediately
4. Complete coordination review when time permits

---

## Remember

- **Quantity Takeoff is PRIMARY** - Never sacrifice accuracy for coordination review
- **Integration matters** - Coordination issues affect quantities
- **Document everything** - Sheet references, assumptions, uncertainties
- **Be professional** - This report may be distributed to entire project team
- **Stay organized** - Large analysis with lots of moving parts
- **ASK when unsure** - Better to get clarification than deliver wrong information

---

## Example Use Case: OhioHealth Women's Center

**User provided:**
- 348MB PDF, 298 pages
- Excel contractor scope file for comparison
- Focus on Division 5500 (Stairs)

**FullAnalysis workflow executed:**

1. **ExtractSheets**: Reduced 298 pages to ~30 relevant sheets
2. **QuantityTakeoff**: Analyzed 7 stairs, produced Excel-style takeoff
3. **CoordinationReview**: Cross-checked architectural vs structural
4. **Integration**: Found:
   - Stair 5 code violation (riser heights)
   - Excel assumed code-compliant, but drawings show violation
   - Quantities may change after revision
5. **Deliverable**: Complete integrated report with action items

**Result:** User got:
- Accurate takeoff table matching contractor's Excel format
- Identification of critical code violation before construction
- Clear action items for project team
- Professional report ready for distribution

This is the expected outcome of FullAnalysis workflow.

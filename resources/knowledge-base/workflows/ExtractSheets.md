# ExtractSheets Workflow

**Purpose: Extract relevant sheets from large construction document PDFs**

Construction documents are often 200-400 pages and 100-400MB. PDF reading tools have limits (typically 32MB for Claude Code). This workflow extracts only the needed pages.

---

## When to Use This Workflow

**Use ExtractSheets when:**
- PDF file size > 50MB
- PDF page count > 100 pages
- User says "large PDF", "full construction set", "permit set"
- You get an error trying to read the full PDF

**Skip ExtractSheets when:**
- PDF is already small (<20MB)
- PDF contains only relevant sheets already
- User has already extracted specific sheets

---

## Step 1: Check File Size and Page Count

```bash
# Get file size
ls -lh "[PDF_PATH]"

# Get page count (using pdfinfo if available, or pdftk)
pdfinfo "[PDF_PATH]" | grep "Pages:"
```

**If file is manageable (<32MB):**
- Skip extraction, proceed directly to reading
- Note: May still want to extract for organization

**If file is too large:**
- Proceed with extraction workflow

---

## Step 2: Locate the Sheet Index

The sheet index is typically in the **first 10-20 pages** of construction documents.

### Method A: Sample First Pages
```bash
# Extract first 10 pages to find index
gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH -dSAFER \
   -dFirstPage=1 -dLastPage=10 \
   -sOutputFile=/tmp/index_sample.pdf "[PDF_PATH]"
```

Then read `/tmp/index_sample.pdf` to locate the index.

### Method B: Search for Sheet Numbers
```bash
# Convert first 20 pages to text and search for patterns
pdftotext -f 1 -l 20 "[PDF_PATH]" - | grep -E "^[A-Z][0-9]{4}"
```

This finds lines starting with sheet patterns like "A0500", "S0100", etc.

---

## Step 3: Identify Target Sheet Ranges

### For Division 5500 (Stairs and Railings):

**Must-Have Sheets:**

**Architectural Stair Plans (A0500 series):**
- A0500-A0508: Individual stair plans and sections (Stair 1, 2, 3, etc.)
- A0510-A0512: Typical stair details (connections, materials, railings)

**Structural (for coordination):**
- S0001: Structural notes and general requirements
- S0100-S0102: Foundation and framing plans (show stair openings)
- S0500-S0502: Structural stair details (if present)

**Nice-to-Have Sheets (if time permits):**
- A0100 series: Overall floor plans showing stair locations
- Specifications: Division 05 section (if included in PDF)

### Example Index Reading

If you see:
```
A0500  STAIR 1 - PLANS AND SECTIONS         250
A0501  STAIR 2 - ORANGE TOWER                251
A0502  STAIR 2 - PLANS AND SECTIONS         252
A0503  STAIR 3 - PLANS AND SECTIONS         253
...
A0510  STAIR DETAILS                         260
A0511  STAIR DETAILS                         261
A0512  STAIR DETAILS                         262
```

You know:
- Architectural stairs: **Pages 250-262** (13 pages)

```
S0001  STRUCTURAL NOTES                      18
S0100.A FOUNDATION PLAN - LEVEL 00           19
S0100.C FOUNDATION PLAN - LEVEL 01           20
...
S0102  LEVEL 02 FRAMING PLAN                 30
```

You know:
- Structural: **Pages 18-30** (13 pages)

---

## Step 4: Extract Sheet Ranges

Use **ghostscript** to extract specific page ranges:

### Extract Architectural Stairs (Example: Pages 250-262)

```bash
# Create organized directory structure
mkdir -p /tmp/[ProjectName]_Analysis/Architectural_Stairs

# Extract stair plans in logical chunks
gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH -dSAFER \
   -dFirstPage=250 -dLastPage=251 \
   -sOutputFile=/tmp/[ProjectName]_Analysis/Architectural_Stairs/A0500-A0501_Stairs.pdf \
   "[PDF_PATH]"

gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH -dSAFER \
   -dFirstPage=252 -dLastPage=253 \
   -sOutputFile=/tmp/[ProjectName]_Analysis/Architectural_Stairs/A0502-A0503_Stairs.pdf \
   "[PDF_PATH]"

# Continue for remaining ranges...

# Extract detail sheets
gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH -dSAFER \
   -dFirstPage=260 -dLastPage=262 \
   -sOutputFile=/tmp/[ProjectName]_Analysis/Architectural_Stairs/A0510-A0512_Details.pdf \
   "[PDF_PATH]"
```

### Extract Structural Sheets (Example: Pages 18-30)

```bash
mkdir -p /tmp/[ProjectName]_Analysis/Structural

gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH -dSAFER \
   -dFirstPage=18 -dLastPage=25 \
   -sOutputFile=/tmp/[ProjectName]_Analysis/Structural/S0001-S0100_Notes_Foundation.pdf \
   "[PDF_PATH]"

gs -sDEVICE=pdfwrite -dNOPAUSE -dBATCH -dSAFER \
   -dFirstPage=26 -dLastPage=30 \
   -sOutputFile=/tmp/[ProjectName]_Analysis/Structural/S0101-S0102_Framing.pdf \
   "[PDF_PATH]"
```

---

## Step 5: Verify Extractions

```bash
# List extracted files with sizes
ls -lh /tmp/[ProjectName]_Analysis/Architectural_Stairs/
ls -lh /tmp/[ProjectName]_Analysis/Structural/

# Quick check: Convert first page of each to text to verify sheet numbers
pdftotext -f 1 -l 1 /tmp/[ProjectName]_Analysis/Architectural_Stairs/A0500-A0501_Stairs.pdf - | grep "A0500"
```

**Verification checklist:**
- [ ] All expected files created
- [ ] File sizes reasonable (<10MB each)
- [ ] Sheet numbers match expected ranges
- [ ] No empty PDFs (check file size > 100KB)

---

## Step 6: Document the Extraction

Create a README.md in the analysis directory:

```bash
cat > /tmp/[ProjectName]_Analysis/README.md << 'EOF'
# [Project Name] - Construction Document Extraction

**Source PDF:** [Full path to original PDF]
**Extraction Date:** [Date]
**Total Pages in Source:** [Page count]
**Purpose:** Division 5500 (Stairs/Railings) quantity takeoff and coordination review

## Extracted Files

### Architectural Stair Sheets
- `Architectural_Stairs/A0500-A0501_Stairs.pdf` - Stair 1 (Pages 250-251)
- `Architectural_Stairs/A0502-A0503_Stairs.pdf` - Stairs 2 & 3 (Pages 252-253)
- `Architectural_Stairs/A0504-A0505_Stairs.pdf` - Stairs 4 & 5 (Pages 254-255)
- `Architectural_Stairs/A0506-A0508_Stairs.pdf` - Stairs 6, 7, Misc (Pages 256-258)
- `Architectural_Stairs/A0510-A0512_Details.pdf` - Typical Details (Pages 260-262)

### Structural Sheets
- `Structural/S0001-S0100_Notes_Foundation.pdf` - Notes & Foundation Plans (Pages 18-25)
- `Structural/S0101-S0102_Framing.pdf` - Framing Plans (Pages 26-30)

## Page Number Reference

Use this to locate sheets in the original PDF if needed:

| Sheet Number | Description | Original Page |
|--------------|-------------|---------------|
| A0500 | Stair 1 Plans | 250 |
| A0501 | Orange Tower Stair | 251 |
| A0502 | Stair 2 Plans | 252 |
...

## Next Steps

1. Read detail sheets first (A0510-A0512) to understand construction
2. Analyze individual stair sheets (A0500-A0508) for quantities
3. Cross-reference structural sheets for coordination
4. Generate quantity takeoff table
5. Identify coordination issues

EOF
```

---

## Step 7: Organize File Structure

**Final directory structure should look like:**

```
/tmp/[ProjectName]_Analysis/
├── README.md                                    # Extraction log
├── Architectural_Stairs/
│   ├── A0500-A0501_Stairs.pdf                  # Stair 1
│   ├── A0502-A0503_Stairs.pdf                  # Stairs 2 & 3
│   ├── A0504-A0505_Stairs.pdf                  # Stairs 4 & 5
│   ├── A0506-A0508_Stairs.pdf                  # Stairs 6, 7, Misc
│   └── A0510-A0512_Details.pdf                 # Typical Details
├── Structural/
│   ├── S0001-S0100_Notes_Foundation.pdf        # Structural basis
│   └── S0101-S0102_Framing.pdf                 # Framing plans
└── [Later: output files from takeoff analysis]
```

---

## Step 8: Return Extraction Summary to User

```
✅ EXTRACTION COMPLETE

Source PDF: [Filename] ([Size], [Page count] pages)

Extracted Files:
- Architectural Stairs: 5 files (A0500-A0512 series)
- Structural: 2 files (S0001-S0102 series)

Location: /tmp/[ProjectName]_Analysis/

Ready to proceed with:
1. QuantityTakeoff workflow → Analyze all stairs for quantities
2. CoordinationReview workflow → Check architectural vs structural
3. FullAnalysis workflow → Complete takeoff + coordination

Which would you like to proceed with?
```

---

## Troubleshooting

### Issue: gs command not found
```
Error: gs: command not found
```

**Solution:** Install ghostscript
```bash
# Ubuntu/Debian/WSL
sudo apt-get update && sudo apt-get install -y ghostscript

# MacOS
brew install ghostscript
```

### Issue: Extracted PDF is too large
```
Problem: Extracted 20 pages but file is still 40MB
```

**Solution:** Extract smaller ranges (2-3 sheets at a time)
```bash
# Instead of pages 250-262 in one file, split into multiple:
gs ... -dFirstPage=250 -dLastPage=251 ... # Just 2 pages
gs ... -dFirstPage=252 -dLastPage=253 ... # Next 2 pages
```

### Issue: Can't find page numbers in index
```
Problem: Sheet index doesn't show page numbers
```

**Solution:** Sample pages to find sheet numbers
```bash
# Check every 10th page to locate sheet ranges
for page in 10 20 30 40 50 60 70 80 90 100; do
  echo "=== Page $page ==="
  pdftotext -f $page -l $page "[PDF]" - | head -20 | grep -E "[A-Z][0-9]{4}"
done
```

This helps you map: "Sheet A0500 appears around page 250"

---

## Tips for Efficiency

1. **Extract details first** (A0510-A0512) - These are small and help you understand the construction
2. **Group similar sheets** - Extract Stairs 1-3 together, Stairs 4-6 together, etc.
3. **Name files descriptively** - Use sheet numbers in filenames for easy reference
4. **Keep README updated** - Document page numbers so you can find sheets later
5. **Don't extract everything** - Only get sheets you need for the analysis

---

## After Extraction: Next Steps

Once extraction is complete, proceed to:

**For Quantity Takeoff:**
→ Invoke `QuantityTakeoff` workflow with extracted files

**For Coordination Review:**
→ Invoke `CoordinationReview` workflow with both architectural and structural files

**For Complete Analysis:**
→ Invoke `FullAnalysis` workflow to do both takeoff and coordination

---

## Remember

- Large PDFs are a fact of life in construction - extraction is a necessary step
- Organization now saves time later (good file names, README documentation)
- You can always go back to the original PDF if you need additional sheets
- Keep the /tmp directory clean - it's just working space

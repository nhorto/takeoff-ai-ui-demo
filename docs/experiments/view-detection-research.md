# View Detection Research: Automatic Layout Segmentation for Construction Drawing Sheets

## Date: April 9, 2026

## Table of Contents

**Part 1: Problem & Research**
1. [Problem Statement](#problem-statement) — What we're trying to solve and why it's hard
2. [Why This Matters](#why-this-matters) — Impact on accuracy and validation from AEC benchmarks
3. [Current Approach and Its Limitations](#current-approach-and-its-limitations) — Text-based clustering and where it fails
4. [Research Findings Overview](#research-findings-overview) — Summary of 4 parallel research tracks
5. [Key Academic Papers](#key-academic-papers) — Khan et al. (exact same problem), AEC-Bench, AECV-Bench
6. [ML-Based Layout Detection Models](#ml-based-layout-detection-models) — DocLayout-YOLO, Florence-2, YOLO, Grounding DINO
7. [Commercial APIs Evaluated](#commercial-apis-evaluated) — Google, Azure, AWS, Gemini, Roboflow, Werk24
8. [Algorithmic (Non-ML) Approaches](#algorithmic-non-ml-approaches) — Hough lines, contour detection, projection profiles, graph clustering

**Part 2: Experiments — What We Actually Tried**
9. [Zero-Shot View Detection Tests](#experimental-results-zero-shot-view-detection-tests-april-9-2026) — DocLayout-YOLO, Grounding DINO, Florence-2, contour detection, projection profiles (all failed)
10. [LLM-Based View Detection](#experimental-results-llm-based-view-detection-april-9-2026) — Claude Sonnet single-pass, padding, two-pass self-correction

**Part 3: Next Steps**
11. [Recommended Architecture](#recommended-architecture) — Cascading pipeline design
12. [Implementation Strategy](#implementation-strategy) — Phased rollout plan
13. [Cost and Performance Estimates](#cost-and-performance-estimates)
14. [Dataset Gap](#dataset-gap-no-public-training-data-exists) — No public dataset exists, distillation strategy
15. [Open Questions](#open-questions)
16. [References and Resources](#references-and-resources)

---

## Problem Statement

Construction drawing sheets contain multiple independent **views** arranged on a single page. A typical stair detail sheet might have:

- 1 **section view** (tall, narrow — full vertical cut showing all flights, risers, stringers)
- 1 **axonometric view** (3D perspective of the stair)
- 8-12 **plan views** (top-down view at each floor level, showing width, landings, rails)
- 1-3 **detail callouts** (enlarged connection details, tread profiles, etc.)

Each view is a self-contained drawing with its own title, annotations, and dimensions. The core problem is: **how do we automatically detect the bounding box of each view on the page so we can isolate and process them independently?**

This is NOT traditional OCR. It is **document layout segmentation** applied to technical drawings — detecting rectangular regions (views) and classifying them by type.

### What Makes This Hard

1. **No standard layout**: Every architectural firm arranges views differently. Some use explicit rectangular frame borders around each view. Some use only whitespace separation. Some mix both.
2. **Variable view sizes**: Section/axonometric views are tall and narrow. Plan views are roughly square. Detail callouts are small. They coexist on the same page.
3. **Dense content**: Dimension lines, leaders, extension lines, and hatching fill the space between views, sometimes creating visual bridges that blur view boundaries.
4. **Scale variation across firms**: Different CAD software, different drafting conventions, different title formats.

### What We Need as Output

For each page, the preprocessing pipeline should produce:

```
page-252/
  ├── overview.jpg                              # Full page image
  ├── overview.txt                              # All text on the page
  ├── stair-2-section-looking-east.jpg          # Cropped section view
  ├── stair-2-section-looking-east.txt          # Text within that view
  ├── stair-2-level-03-plan.jpg                 # Cropped plan view
  ├── stair-2-level-03-plan.txt                 # Text within that view
  ├── stair-2-level-05-plan.jpg
  ├── stair-2-level-05-plan.txt
  └── ...
```

Labeled files that the downstream agent can access directly — no clustering logic, no coordinate math, just "read the file for Stair 2 Level 03 plan."

---

## Why This Matters

### Retrieval is the Primary Bottleneck

**AEC-Bench** (Nomic AI, March 2026, arXiv:2603.29199) systematically benchmarked AI agents on real AEC (Architecture, Engineering, Construction) documents and found:

> "Retrieval is the primary bottleneck. Agents fail before reasoning because they cannot locate the relevant sheet/detail. Once correct context is retrieved, performance jumps."

This directly validates the view-aware preprocessing approach. If we solve view detection, we solve the retrieval bottleneck and the downstream counting agent gets well-organized, unambiguous input.

### VLMs Alone Cannot Do Precise Counting

**AECV-Bench** (Jan 2026, arXiv:2601.04819) — the first systematic benchmark for AEC drawing understanding — tested multimodal models on floor plan counting and document QA:

- Gemini 2.5 Pro led at 41% mean accuracy
- GPT-5 identified doors only 12% of the time
- No model is production-ready for autonomous drawing understanding

This confirms our hybrid approach (text extraction via pdfjs-dist + image for confirmation) is superior to relying on VLM vision alone for precise measurements.

### Impact on Accuracy

Our own eval results show the progression:

| Approach | Accuracy |
|----------|----------|
| Monolith (no view awareness) | 0-7% |
| Orchestrated (basic zone grouping) | 14-57% |
| Orchestrated + X-gap text clustering | 71-79% |
| **Orchestrated + proper view detection (projected)** | **85-95%+** |

The jump from 71-79% to 85-95%+ is the gap that proper view detection would close — eliminating annotation deduplication errors and ensuring per-level landing dimensions are correctly attributed.

---

## Current Approach and Its Limitations

### What We Have Now

Implemented in `eval/test-view-clustering.ts` and `src/main/core/tools.ts`:

1. **Title-Anchored Grid Clustering**: Detect view titles via regex, infer a grid from title positions, assign text items to grid cells.
2. **X-Gap Text Clustering**: Sort text items by X coordinate, find gaps > threshold, form clusters.
3. **Fallback Gap-Based Clustering**: If no titles found, use both X-gap and Y-gap analysis.

### Where It Fails

1. **Text-only clustering misses drawn content**: The clustering only uses text item positions from pdfjs-dist. Large drawing areas with no text annotations are invisible to this approach. In the page 256 clustering report, **435 text items went unassigned** — many because they fell in areas between the text-inferred grid cells.

2. **Title detection is fragile**: Relies on regex patterns that match specific title formats. Different firms use different conventions. Some views don't have titles at all.

3. **Manhattan layout assumption**: The grid-based approach assumes views are arranged in rows and columns. Real layouts are often irregular — a tall section view spanning the full page height alongside a 3x3 grid of plans, or L-shaped arrangements.

4. **No awareness of visual content**: Cannot detect views that are defined by their drawn content rather than text. A detail callout with minimal text but dense linework is invisible to text-only clustering.

5. **Single-strategy fragility**: One heuristic approach cannot handle the variety across architectural firms. Image 4's explicit frame borders need line detection. Image 1's whitespace-separated grid needs gap analysis. Different problems need different tools.

---

## Research Findings Overview

We researched four domains in parallel:

1. **ML-based layout detection models** (YOLO variants, DiT, Florence-2, etc.)
2. **Commercial/open APIs** (Google Document AI, Azure, Roboflow, Gemini, etc.)
3. **Algorithmic approaches** (whitespace analysis, Hough lines, contour detection, etc.)
4. **Academic research** on engineering drawing understanding

### Key Takeaways

- **No off-the-shelf solution exists** for detecting views on construction drawing sheets. All approaches require either fine-tuning or custom implementation.
- **No public dataset exists** with labeled view boundaries on multi-view construction drawing sheets. This is a gap in the field.
- **The YOLO + VLM pipeline is the winning pattern** — validated by Khan et al. (2026) on engineering drawings.
- **A cascading pipeline** (algorithmic fast-pass → ML model → LLM fallback) is the most robust architecture.
- **The "distillation" strategy** (use LLM to label data → train YOLO to replicate) is the smartest path to a production system.

---

## Key Academic Papers

### 1. Khan et al. — Multi-Stage Hybrid Framework (MOST RELEVANT)

**"A Multi-Stage Hybrid Framework for Automated Interpretation of Multi-View Engineering Drawings Using Vision Language Model"**
- arXiv: [2510.21862](https://arxiv.org/abs/2510.21862)
- Accepted: ICIEA 2026
- Authors: Nanyang Technological University (NTU) + SIMTech (A*STAR), Singapore

**This paper solves our exact problem on mechanical engineering drawings.** Their three-stage pipeline:

| Stage | Method | Purpose |
|-------|--------|---------|
| 1 | YOLOv11-det | Layout segmentation — detects individual views, title blocks, notes on the sheet |
| 2 | YOLOv11-obb | Annotation detection within each view (oriented bounding boxes) |
| 3 | Fine-tuned Donut VLM | Parse detected annotations into structured data |

#### Stage 1 Details (View Detection)

The YOLO model detects exactly **3 classes**:
1. **Views** — individual drawing views (front, top, section, isometric, etc.)
2. **Title Block** — the sheet's title block
3. **Notes** — text/notes regions

Training data: **1,000 manually annotated drawings** with 5,083 total labels:
- 3,498 View instances (~3.5 views per drawing on average)
- 458 Title Block instances
- 1,127 Notes instances

Accuracy (normalized confusion matrix):
- Views: **0.96**
- Title Block: **0.99**
- Notes: **0.98**

#### Stage 3 Details (VLM)

The VLM is **Donut** (Document Understanding Transformer, open-source at [github.com/clovaai/donut](https://github.com/clovaai/donut)), NOT Claude or GPT. Two instances:
- **Alphabetical Donut** (zero-shot): Parses title blocks and notes → F1: 0.672
- **Numerical Donut** (fine-tuned 30 epochs on RTX 5090): Parses dimensions, GD&T, surface roughness → F1: 0.963

The unified variant (Donut + OBB combined) achieved F1 = 0.973 with only 5.23% hallucination rate.

#### Code/Data/Model Availability

**NONE publicly released.** After thorough investigation:
- Training data (1,000 drawings): NOT available. Collected from "online repositories and internal archives."
- Trained YOLO models: NOT released. No GitHub repo from any author.
- No HuggingFace model or dataset.

#### Authors

| Author | Role | Affiliation |
|--------|------|-------------|
| Muhammad Tayyab Khan | 1st author, PhD student | SIMTech (A*STAR) + NTU |
| Zane Yong | Co-author | ARTC (A*STAR) |
| Lequn Chen | Co-author | SIMTech (A*STAR) |
| Wenhe Feng | Co-author | SIMTech (A*STAR) |
| Nicholas Yew Jin Tan | Co-author | SIMTech (A*STAR) |
| Seung Ki Moon | Advisor | NTU, School of Mechanical and Aerospace Engineering |

- Lab: Design Sciences Laboratory — `https://personal.ntu.edu.sg/skmoon/people.html`
- Khan Google Scholar: `https://scholar.google.com/citations?user=5L3OK2AAAAAJ`
- Zero citations as of April 2026 (very recent paper)

#### Key Takeaway

The paper validates the approach (YOLO for view detection, VLM for interpretation) but provides no reusable artifacts. We would need to create our own labeled dataset and train our own model. The good news: they proved it works with just 1,000 images and a simple 3-class scheme.

#### Limitation
Focused on mechanical engineering drawings (orthographic projections), not architectural/construction drawings. But the architecture transfers directly.

### 2. Khan et al. — From Drawings to Decisions

**"From Drawings to Decisions: A Hybrid Vision-Language Framework for Parsing 2D Engineering Drawings into Structured Manufacturing Knowledge"**
- arXiv: [2506.17374](https://arxiv.org/abs/2506.17374)
- Same research group

Uses YOLOv11-OBB for annotation localization + fine-tuned Donut VLM for structured output. Donut achieved 88.5% precision, 99.2% recall, F1 = 93.5%.

### 3. Fine-Tuning Florence-2 for Engineering Drawings

**"Fine-Tuning Vision-Language Model for Automated Engineering Drawing Information Extraction"**
- arXiv: [2411.03707](https://arxiv.org/abs/2411.03707)
- November 2024

Fine-tuned Florence-2 (0.23B params) on only 400 engineering drawings. Achieved 52.4% improvement in F1 and 43.15% reduction in hallucination vs. closed-source models. Demonstrates that small, fine-tunable models can work well on this domain with very limited training data.

### 4. AEC-Bench — Agentic Benchmark

**"AEC-Bench: A Benchmark for Evaluating Agentic AI Systems on AEC Document Understanding"**
- arXiv: [2603.29199](https://arxiv.org/abs/2603.29199)
- GitHub: [nomic-ai/aec-bench](https://github.com/nomic-ai/aec-bench)
- License: Apache 2.0

196 task instances across 9 task families on real AEC documents. Key finding: retrieval is the bottleneck, not reasoning. Directly validates view-aware preprocessing.

### 5. AECV-Bench — VLM Benchmark

**"AECV-Bench: Benchmarking Multimodal Models on AEC Drawing Understanding"**
- arXiv: [2601.04819](https://arxiv.org/abs/2601.04819)
- Website: [aecv-bench.com](https://aecv-bench.com/)

First systematic benchmark for AEC drawing understanding. Confirms VLMs struggle with precise spatial tasks on construction drawings.

### 6. Deep Learning for Engineering Drawing Review

**"Deep learning approaches for engineering diagram digitisation: A comprehensive review"**
- [Springer](https://link.springer.com/article/10.1007/s10462-024-10779-2) (2024)

Comprehensive survey of the field. Good starting point for understanding the landscape.

---

## ML-Based Layout Detection Models

### Tier 1: Best Options for Fine-Tuning

#### DocLayout-YOLO

- **Architecture**: YOLOv10-based with Global-to-Local Controllable Receptive Module
- **Pretrained classes**: Title, Plain Text, Figure, Table, etc. (10-27 classes depending on variant)
- **Performance**: 70.3-79.7% mAP on standard benchmarks
- **Speed**: 85.5 FPS — 14.3x faster than DiT-Cascade
- **Model size**: ~25-30M parameters
- **License**: **AGPL-3.0** (requires enterprise license for commercial SaaS use)
- **Install**: `pip install doclayout-yolo`
- **GitHub**: [opendatalab/DocLayout-YOLO](https://github.com/opendatalab/DocLayout-YOLO)
- **HuggingFace**: [opendatalab/DocLayout-YOLO](https://huggingface.co/spaces/opendatalab/DocLayout-YOLO)
- **Fine-tuning**: Standard YOLO training pipeline. Define custom classes, annotate in YOLO format, train. Could work with 200-500 annotated drawing sheets.
- **Why it's good**: Fastest inference, easiest to fine-tune, "Figure" category may partially detect drawing views already.

#### Florence-2

- **Architecture**: Vision-language foundation model (Microsoft, CVPR 2024)
- **Model size**: 0.23B and 0.77B variants — very small for a VLM
- **License**: **MIT** — fully permissive, no commercial restrictions
- **Key advantage**: Can be prompted for region detection tasks without fine-tuning. Also fine-tunable with LoRA on a single GPU.
- **Speed**: ~0.5-2 seconds per image
- **HuggingFace**: [microsoft/Florence-2-large](https://huggingface.co/microsoft/Florence-2-large)
- **Fine-tuning guide**: [HuggingFace blog](https://huggingface.co/blog/finetune-florence2)
- **Why it's good**: MIT license, small enough to self-host cheaply, shown to work on engineering drawings with only 400 training examples. Best option if AGPL is a blocker.

#### YOLOv11 (Ultralytics)

- **Model sizes**: 2.6M (nano) to 56.9M (extra-large) parameters
- **License**: **AGPL-3.0**
- **Why it's relevant**: Khan et al. used YOLOv11-det for their Stage 1 view detection and proved it works on multi-view engineering drawing sheets with ~1,000 training images.

### Tier 2: Worth Testing Zero-Shot

#### Grounding DINO

- **What**: Open-set object detection — text-prompted, zero-shot
- **How**: Prompt with "drawing view", "section view", "plan view" and it attempts to find them
- **License**: Apache-2.0
- **GitHub**: [IDEA-Research/GroundingDINO](https://github.com/IDEA-Research/GroundingDINO)
- **Why**: Free, no training data needed, fast to prototype. But accuracy on engineering drawings is untested.

#### Grounding DINO + SAM (Segment Anything)

- Combines detection with pixel-level segmentation masks
- Could identify view regions even with irregular boundaries
- Worth a quick experiment

### Tier 3: Less Suitable

| Model | Why Less Suitable |
|-------|-------------------|
| **DiT (Document Image Transformer)** | 304M params, 6 FPS (slow), Detectron2 pipeline complex to deploy |
| **LayoutLMv3** | Designed for NLP tasks (form understanding), not visual layout detection. Requires OCR input. Wrong tool. |
| **PaddleOCR PP-DocLayout** | Good technology but requires PaddlePaddle framework (not PyTorch). Ecosystem friction. |
| **Detectron2 + PubLayNet** | Aging technology, trained on scientific papers only, no relevance to drawings |
| **Docling (IBM)** | Business document parsing, wrong domain entirely |

---

## Commercial APIs Evaluated

### Not Suitable for This Problem

| API | Why |
|-----|-----|
| **Google Document AI** | Detects text blocks, tables, figures on business documents. Will NOT subdivide a drawing sheet into individual views. |
| **Azure AI Document Intelligence** | Same — general-purpose document model, no engineering drawing support. |
| **AWS Textract** | Explicitly benchmarked as **"failing completely on visual-spatial tasks like engineering drawings"** (BusinesswareTech benchmark). |
| **Autodesk/PlanGrid/Bluebeam APIs** | Project management tools, not computer vision. No drawing analysis capabilities. |

### Potentially Useful

#### Gemini Bounding Box Detection (Google Vertex AI)

- **What**: Gemini has an experimental bounding box detection feature — provide custom text instructions, get bounding boxes back
- **Cost**: ~$0.001-0.005 per page with Gemini 2.5 Flash ($0.15-0.30/MTok)
- **Latency**: 1-5 seconds
- **Why interesting**: Cheapest LLM-based option. May have better spatial understanding than Claude/GPT for bounding boxes since Google specifically built this feature.
- **Risk**: Experimental feature, accuracy on technical drawings unknown
- **Docs**: [Vertex AI Bounding Box Detection](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/bounding-box-detection)

#### Claude Vision / GPT-4o Vision (as layout detectors)

- **Approach**: Send low-res page image, ask for view bounding boxes as JSON
- **Cost**: $0.01-0.05 per page
- **Semantic understanding**: Excellent — these models understand what section views, plan views, and details are
- **Bounding box precision**: **Poor** — coordinates can be off by 10-20% of image dimension. Multiple studies confirm LLMs are not reliable for pixel-accurate bounding boxes.
- **Best use**: Classification and labeling of views (not primary detection)

#### Roboflow

- **What**: Platform for labeling data, training custom YOLO models, and deploying as hosted API
- **Why it's useful**: End-to-end pipeline for building a custom view detector
- **Workflow**: Label 200-500 drawings → train YOLOv8/v11 → deploy as API
- **Cost**: $49-299/month for hosted inference, or self-host for free (Roboflow Inference is open-source)
- **Latency**: 50-200ms per image
- **Expected accuracy**: 85-95% mAP with a well-labeled dataset
- **Website**: [roboflow.com](https://roboflow.com)

#### Werk24

- **What**: Specialized API for engineering drawing interpretation
- **Focus**: Mechanical drawings — title blocks, dimensions, tolerances, GD&T
- **Cost**: Starting at EUR 990/month + EUR 0.85/page
- **Verdict**: Wrong domain (mechanical, not architectural) and expensive

---

## Algorithmic (Non-ML) Approaches

### Approach 1: Hough Line Detection for Frame Borders

**When to use**: Drawings with explicit rectangular frame borders around views (like Image 4).

**How it works**:
1. Render page, apply Canny edge detection
2. Run `HoughLinesP` with high `minLineLength` to find long structural lines
3. Filter for near-horizontal and near-vertical lines
4. Find intersections to form closed rectangles
5. Each closed rectangle = one view frame

**Strengths**: When frames exist, this gives perfect results. Very fast (~50ms).

**Weaknesses**: Useless on drawings without explicit frames (whitespace-only separation). Staircase drawings have many long lines that are NOT frame borders. Requires post-processing to distinguish structural frames from drawing content.

**Implementation**: ~100 lines of OpenCV code.

### Approach 2: Morphological Dilation + Contour Detection

**When to use**: General-purpose approach that works on most layouts.

**How it works**:
1. Render page to image, convert to grayscale, threshold to binary
2. Apply morphological dilation with a tuned kernel — nearby elements merge into blobs
3. Find contours of the dilated blobs
4. Compute bounding boxes for each contour
5. Filter by area (ignore noise, ignore page-sized contour)

```python
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
_, binary = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (50, 50))  # tune kernel size
dilated = cv2.dilate(binary, kernel, iterations=2)
contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
```

**Strengths**: Handles varied layouts naturally. The dilation kernel size is the only critical parameter — it determines the "gap tolerance" for merging nearby elements into the same view.

**Weaknesses**: Kernel size is a critical parameter (too small splits views, too large merges adjacent views). Dimension extension lines between views can bridge them during dilation. Title blocks need filtering.

**Implementation**: ~15 lines of OpenCV core + filtering heuristics.

### Approach 3: Projection Profile Analysis

**When to use**: As a complement to other methods, especially for finding major whitespace valleys.

**How it works**:
1. Render page to binary image
2. Sum pixels along each row → horizontal projection profile
3. Sum pixels along each column → vertical projection profile
4. Find valleys (near-zero regions) that indicate whitespace strips between views

**Strengths**: Fast, simple, captures ALL content (lines + text + hatching), not just text.

**Weaknesses**: Manhattan-layout assumption — can only find full-width or full-height cut lines. Same limitation as X-Y cut.

**Enhancement over current approach**: Our current text-only clustering misses drawn areas with no text. Pixel-based projection profiles capture everything.

### Approach 4: Graph-Based Text Clustering (DBSCAN)

**When to use**: As validation/enrichment after pixel-based detection.

**How it works**:
1. Extract text items with positions (already done via pdfjs-dist)
2. Build spatial proximity graph or run DBSCAN on coordinates
3. Find clusters = candidate views
4. Compute bounding boxes per cluster

**Strengths**: Handles irregular layouts (no Manhattan assumption). We already have the text extraction.

**Weaknesses**: Text-only — misses views with minimal text. Distance threshold selection.

### Approach 5: PDF Structure Probing

**When to use**: Quick check before any other approach.

**How it works**: Parse PDF internal structure for Form XObjects (self-contained sub-drawings with bounding boxes) or layers (Optional Content Groups).

```python
import fitz  # PyMuPDF
doc = fitz.open("drawing.pdf")
page = doc[0]
xobjects = page.get_xobjects()  # Form XObjects with bounding boxes
ocgs = doc.get_ocgs()            # Layers
```

**Reality**: Most real-world construction PDFs have NO useful internal structure for view separation. CAD exports (Revit, AutoCAD) typically flatten everything. Worth 30 minutes to check on actual PDFs, but don't build a strategy around this.

### Not Recommended

| Approach | Why |
|----------|-----|
| **Voronoi-based segmentation** | Designed for text-heavy documents. Engineering drawings are line-heavy with sparse text. |
| **Pure X-Y cut** | Already tried (gap-based clustering). Manhattan assumption too rigid. |

---

## Recommended Architecture

### Cascading Pipeline

```
Drawing PDF Page
        |
        v
[1. PDF Structure Probe]  ← Check for Form XObjects (~10ms)
        |
        ├── XObjects found with view-like bounding boxes
        |   → Use directly (rare but free when available)
        |
        └── No useful structure
            |
            v
[2. Algorithmic Fast-Pass]  ← Hough lines + contour detection (~100-200ms)
        |
        ├── High confidence (clean results, reasonable view count)
        |   → Use algorithmic bounding boxes
        |
        └── Low confidence (too few/too many views, overlapping boxes)
            |
            v
[3. ML Model Detection]  ← YOLO or Florence-2 (~50-500ms)
        |
        ├── Model available and confident
        |   → Use ML bounding boxes
        |
        └── Model unavailable or low confidence
            |
            v
[4. LLM Fallback]  ← Gemini Flash or Claude (~2-5 seconds, ~$0.005-0.05)
        |
        → Use LLM-provided bounding boxes
        → Log as training data for future ML model

=== After bounding boxes are determined ===
        |
        v
[5. Crop + Text Assignment]
        |
        ├── Crop high-resolution image per view
        ├── Filter text items into each view by containment
        ├── Identify view title within each view's text
        └── Classify view type (section/plan/detail)
        |
        v
[6. Output Labeled Files]
        |
        ├── {view-label}.jpg    (cropped image)
        ├── {view-label}.txt    (text content)
        └── metadata.json       (all views with types, titles, bounds)
```

### Why This Architecture

- **Fast path**: Most pages from a single project follow the same layout pattern. Algorithmic detection handles the common case cheaply.
- **Robust fallback**: Unusual layouts get caught by ML/LLM detection.
- **Self-improving**: Every LLM-processed page generates labeled training data for the ML model.
- **Cost-efficient**: Only ~5-10% of pages should need the LLM fallback once the ML model is trained.

---

## Implementation Strategy

### Phase 1: LLM-First Prototype (1-2 weeks)

**Goal**: Get the end-to-end pipeline working with LLM-based view detection.

1. Implement view detection using Gemini Flash bounding box API (cheapest) or Claude Vision
2. Build the cropping + text assignment + file output pipeline
3. Validate on our existing drawing sets
4. Every processed page = one labeled training example saved

**Why start here**: Gets us to production fastest. LLM handles any layout without training data. Cost is acceptable for initial volume.

### Phase 2: Algorithmic Fast-Pass (1 week)

**Goal**: Add deterministic detection for common layouts to reduce LLM calls.

1. Implement Hough line detection for frame borders
2. Implement contour detection with morphological dilation
3. Add confidence scoring (view count, overlap check, text coverage)
4. Route high-confidence pages through algorithmic path, low-confidence to LLM

### Phase 3: ML Model Training (2-3 weeks)

**Goal**: Train a fast, accurate model to replace LLM detection for most pages.

1. Collect 200-500 labeled pages from Phase 1 (LLM-generated + manually verified)
2. Train Florence-2 (MIT license, 0.23B) or DocLayout-YOLO on custom classes:
   - `section_view`, `plan_view`, `detail_view`, `axonometric_view`, `title_block`, `notes_block`
3. Deploy as API (Roboflow hosted, HuggingFace Inference Endpoint, or self-hosted)
4. Validate against LLM results — ML model should match or exceed LLM accuracy
5. Route through ML model with LLM as fallback for low-confidence pages

### Phase 4: Continuous Improvement (Ongoing)

- Monitor downstream agent accuracy per view type
- Add misclassified pages to training set
- Retrain model periodically
- Expand to new architectural firms and drawing styles

---

## Cost and Performance Estimates

### Per-Page Processing Cost

| Detection Method | Cost/Page | Latency | Accuracy (estimated) |
|-----------------|-----------|---------|---------------------|
| PDF Structure Probe | $0 | ~10ms | Perfect when available (rare) |
| Algorithmic (Hough + contour) | $0 | ~100-200ms | 70-85% on varied layouts |
| ML Model (YOLO/Florence-2) | ~$0.001 (self-hosted GPU) | 50-500ms | 85-95% after fine-tuning |
| LLM (Gemini Flash) | ~$0.001-0.005 | 1-5s | 80-90% (bounding box precision) |
| LLM (Claude Sonnet) | ~$0.01-0.05 | 2-10s | 85-90% (semantic), 70-80% (bbox precision) |

### Steady-State Estimate (After ML Model Trained)

- **90% of pages**: Algorithmic or ML detection → $0-0.001/page, <500ms
- **10% of pages**: LLM fallback → ~$0.005/page, ~3s
- **Blended average**: ~$0.001/page, ~300ms
- **For a 300-page drawing set**: ~$0.30 total, ~90 seconds for all pages

### Training Cost (One-Time)

| Item | Cost |
|------|------|
| Labeling 300-500 pages (Roboflow, ~2 min/page) | 10-17 hours of manual work |
| YOLO training (GPU hours) | ~$5-20 on cloud GPU |
| Roboflow subscription | $49-299/month |
| Florence-2 fine-tuning | ~$5-10 on cloud GPU |
| **Total one-time** | **~$50-300 + labeling time** |

---

## Dataset Gap: No Public Training Data Exists

After thorough searching of Roboflow Universe, HuggingFace Datasets, Kaggle, and Papers With Code, **no public dataset exists** with labeled view boundaries on multi-view engineering or architectural drawing sheets.

### What Exists (Not Suitable)

| Dataset | Source | Gap |
|---------|--------|-----|
| Engineering Drawing Datasets (Roboflow) | 12 images | Far too small, not view-level |
| eng-drawing (Roboflow) | 167 images | Object detection, not view layout |
| engineering-drawings-as1100 (HuggingFace) | 210 examples | Compliance checking VLM format, no bounding boxes |
| Two Dimensional Engineering Drawings (Kaggle) | Images only | No bounding box annotations at all |
| DeepPatent2 (Nature) | 2.7M+ patent drawings | Patent drawings, not construction/mechanical |
| DocLayNet / PubLayNet | 80K+ document pages | Business/scientific documents, not drawings |

### What We Need to Create

A labeled dataset of construction drawing sheets with:
- Bounding boxes around each view (YOLO or COCO format)
- Class labels: `section_view`, `plan_view`, `detail_view`, `axonometric_view`, `title_block`, `notes`
- 200-500 sheets minimum for initial training (Khan et al. used 1,000 for 96% accuracy)
- Variety across architectural firms and drawing styles

### The Distillation Strategy for Dataset Creation

Rather than manual labeling from scratch:
1. Use LLM (Gemini Flash / Claude) to generate initial view bounding boxes for each page
2. Human reviews and corrects the LLM output (much faster than labeling from scratch)
3. After 200-500 validated pages, train YOLO/Florence-2 model
4. Model handles new pages, human corrects edge cases, training data grows continuously

This is cost-effective: LLM processing costs ~$0.005/page, human review takes ~1-2 minutes/page (vs ~3-5 minutes for from-scratch labeling).

---

## Experimental Results: Zero-Shot View Detection Tests (April 9, 2026)

We ran hands-on experiments to test whether off-the-shelf models and algorithmic approaches could detect individual views on our construction drawing sheets without any training data. Test images: page 252 (Stair 2 — section + 3x3 plan grid) and page 256 (Stair 5 — section + irregular plan grid) from the OHWC drawing set.

**Test environment**: Python 3.14, macOS ARM64, PyTorch 2.11, OpenCV 4.13

**Output directory**: `eval/view-detection-test/`

### Experiment 1: DocLayout-YOLO (Pretrained)

**Model**: `juliozhao/DocLayout-YOLO-DocStructBench` (YOLOv10-based, trained on DocStructBench)

**10 pretrained classes**: title, plain text, abandon, figure, figure_caption, table, table_caption, table_footnote, isolate_formula, formula_caption

**Setup**:
```bash
pip install doclayout-yolo
# Downloads model from HuggingFace (~25MB)
```

**Results**:

| Page | Detections | What It Found |
|------|-----------|---------------|
| 252 | 2 | 1 "figure" covering the **entire page** (conf=0.596), 1 "abandon" on a small text region (conf=0.242) |
| 256 | 2 | 2 overlapping "figure" detections covering the **entire page** (conf=0.280, 0.228) |

**Inference speed**: ~510ms per image at 1024px input size on Apple Silicon (no GPU acceleration)

**Verdict**: **Complete failure for view detection.** The model treats the whole drawing sheet as a single "figure" region. This is expected — it was trained on academic documents (papers, reports, textbooks), not engineering drawings. It has no concept of "drawing views" as a category. The pretrained model cannot distinguish individual views on a multi-view sheet.

**Annotated output**: `eval/view-detection-test/page-252-overview-doclayout-yolo.jpg`

### Experiment 2: Grounding DINO (Text-Prompted Detection)

**Model**: `ShilongLiu/GroundingDINO` (SwinT backbone, open-vocabulary object detection)

**Approach**: Text-prompted detection — provide a text description of what to find, model returns bounding boxes.

**Planned prompts**:
- `"drawing view . floor plan . section view . detail view"`
- `"architectural drawing . staircase plan . building section"`
- `"rectangular drawing region . bordered diagram . technical view"`

**Result**: **Could not run.** The `groundingdino-py` package has a compatibility issue with the latest `transformers` library (v5.5.3). Specifically, `BertModel` no longer has a `get_head_mask` attribute in the newer transformers API. The model fails during initialization with `AttributeError: 'BertModel' object has no attribute 'get_head_mask'`.

**Verdict**: **Blocked by dependency incompatibility.** Would need to pin `transformers<5.0` or use an older Python environment. Not tested. Given that Grounding DINO is designed for natural images (photos), performance on line-heavy engineering drawings is uncertain anyway.

### Experiment 3: Florence-2 (Microsoft VLM)

**Model**: `microsoft/Florence-2-base` (0.23B params, MIT license)

**Planned tasks**: Object Detection (`<OD>`), Region Proposal (`<REGION_PROPOSAL>`), Dense Region Caption (`<DENSE_REGION_CAPTION>`), Caption-to-Phrase Grounding, OCR with Regions

**Result**: **Could not run.** Compatibility issue between Florence-2's custom config code and the latest transformers library (v5.5.3) on Python 3.14. Specifically, `Florence2LanguageConfig` references `forced_bos_token_id` which no longer exists as an attribute in the base config class. Error: `AttributeError: 'Florence2LanguageConfig' object has no attribute 'forced_bos_token_id'`.

**Verdict**: **Blocked by dependency incompatibility.** Would need older Python (3.11/3.12) and pinned transformers version. Florence-2 remains a strong candidate for fine-tuning (MIT license, small model), but the zero-shot test couldn't be completed.

### Experiment 4: Morphological Dilation + Contour Detection (OpenCV)

**Approach**: Render page to binary image → dilate with rectangular kernel to merge nearby content → find contours → bounding boxes of contours = view regions.

**Tested kernel sizes**: 30x30, 50x50, 70x70, 90x90 (with 2 iterations of dilation)

**Results**:

| Kernel Size | Page 252 Results | Page 256 Results |
|-------------|-----------------|-----------------|
| 30x30 | 2 detections: one covering **entire page** (89.4% area), one small region | 2 detections: one covering **entire page** (89.4% area), one small region |
| 50x50 | **0 detections** — everything merged into one blob exceeding max area filter | 0 detections |
| 70x70 | 0 detections | 0 detections |
| 90x90 | 0 detections | 0 detections |

**Why it fails**: Construction drawings are extremely dense. Dimension lines, grid lines, extension lines, hatching, and stair linework create continuous connectivity across the entire page. Even with small dilation kernels, these elements bridge across view boundaries and merge everything into a single giant connected component. The whitespace gaps between views (~100-200px) are not large enough relative to the content density to survive dilation.

**Visual inspection**: The binary threshold image (`page-252-overview-binary.jpg`) shows the issue clearly — the page border, grid lines, and dense drawing content form a nearly continuous mass of dark pixels.

**Verdict**: **Not viable for construction drawings.** Morphological dilation + contour detection works well on documents with clear spatial separation between regions (text paragraphs, figures in papers). Construction drawings are too dense and interconnected for this approach.

### Experiment 5: Projection Profile Analysis (Whitespace Valley Detection)

**Approach**: Compute horizontal and vertical projection profiles (sum of dark pixels per row/column), find "valleys" (low-density strips) that indicate whitespace between views.

**Tested threshold ratios**: 0.05, 0.08, 0.12, 0.18 (fraction of max profile value below which a row/column is considered "whitespace")

**Results**:

| Threshold | Page 252 H-Valleys | Page 252 V-Valleys | Grid Cells |
|-----------|-------------------|-------------------|------------|
| 0.05 | 9 | 10 | 82 |
| 0.08 | ~15 | ~12 | ~100+ |
| 0.12 | 27 | 18 | ~200+ |
| 0.18 | 30 | ~20 | ~250+ |

**Why it fails**: The projection profiles find whitespace valleys **within** views (between dimension text, between annotation groups, between stair flight drawings) that are similar in width to the whitespace **between** views. There is no clear signal-to-noise separation. At low thresholds, only a few valleys are found but they don't consistently correspond to view boundaries. At higher thresholds, dozens of valleys are found, fragmenting views into many small cells.

The fundamental problem: within-view whitespace (e.g., the gap between a dimension line and the stair drawing above it) is 40-200px wide, while between-view whitespace is 80-400px wide. These ranges overlap significantly.

**Verdict**: **Not viable as a standalone approach.** Could potentially be useful as a supplementary signal (e.g., validating candidate boundaries from another method) but cannot reliably distinguish view boundaries from intra-view whitespace on dense construction drawings.

### Summary of All Experiments

| Method | Worked? | Why / Why Not |
|--------|---------|---------------|
| DocLayout-YOLO (pretrained) | No | Treats entire page as one "figure" — no concept of drawing views |
| Grounding DINO | Not tested | Dependency incompatibility with latest transformers |
| Florence-2 | Not tested | Dependency incompatibility with Python 3.14 |
| Contour detection + dilation | No | Drawings too dense — all content merges into one blob |
| Projection profiles | No | Within-view and between-view whitespace are similar scale |

### Key Takeaways

1. **Off-the-shelf document layout models don't work** on construction drawings. They were trained on papers, reports, and forms — a fundamentally different visual domain. The "figure" class is the closest match, but it detects the entire drawing sheet as one figure, not individual views.

2. **Simple pixel-based algorithms don't work** because construction drawings are too dense. Unlike text documents where content regions are clearly separated by large whitespace, drawings have continuous linework (dimension lines, grids, borders) that bridges across view boundaries.

3. **The problem requires semantic understanding**, not just pixel analysis. A human looks at a drawing sheet and recognizes views because they understand what stairs, floor plans, and section cuts look like. Pure geometric/pixel methods cannot make this distinction.

4. **Our existing text-based clustering** (`eval/test-view-clustering.ts`) actually outperforms all of these zero-shot approaches because it uses domain knowledge — title patterns, grid inference from title positions, and understanding of drawing conventions. It achieves reasonable view separation despite being text-only.

5. **The two viable paths forward are**:
   - **LLM-based detection**: Send the page image to Claude/Gemini and ask it to identify view bounding boxes. LLMs have the semantic understanding needed.
   - **Fine-tuned YOLO/Florence-2**: Train a model specifically on construction drawing sheets with labeled view boundaries. Needs 200-500+ labeled examples.

6. **The "distillation" strategy is confirmed as the right approach**: Use LLM detection now (works immediately, handles any layout), collect labeled data from every page processed, then train a dedicated model once enough data exists.

7. **Dependency compatibility is a real issue** for ML model experimentation. Python 3.14 + latest transformers breaks many older model implementations. A pinned environment (Python 3.11, transformers 4.x) would be needed for further ML experiments.

---

## Experimental Results: LLM-Based View Detection (April 9, 2026)

Following the failure of all algorithmic and off-the-shelf ML approaches (Experiments 1-5 above), the only remaining viable path for immediate testing was LLM-based detection. The core insight: a human can look at any of these drawing sheets and instantly see where the views are — this is a semantic understanding problem, not a pixel analysis problem. LLMs have that semantic understanding. So we built a pipeline to test whether Claude could serve as a view detector.

We built a standalone eval script (`eval/test-llm-view-detection.ts`) that renders a page, sends it to Claude, parses bounding boxes from the JSON response, crops each detected view, and filters text items into each view. We then iteratively improved it with automatic padding and a two-pass self-correction approach.

**Script**: `eval/test-llm-view-detection.ts`

**Approach**: Render the drawing page, downscale to 1568px max dimension, send to Claude with a structured prompt asking it to identify views and return bounding boxes as normalized fractions (0-1), then use those boxes to crop images and filter text items.

### Experiment 6: Claude Sonnet — Single-Pass Detection

**Model**: `claude-sonnet-4-5-20250929`

**Prompt strategy**: Structured prompt describing what construction drawing views are (section, plan, detail, axonometric, elevation), asking for a JSON array with label, type, level, and bbox as [x1, y1, x2, y2] fractions.

**Results — Page 252 (Stair 2, clean 3x3 grid + section):**

| Metric | Result |
|--------|--------|
| Views detected | 10 (correct — 1 section + 9 plans) |
| Labels | All correct with proper level numbers |
| Bounding boxes | Clean grid, reasonable positions |
| Issues | Boxes slightly too tight — clipping annotations on edges (~2-5% of content cut off) |
| Tokens | 1965 in / 703 out |
| Cost | $0.016 |
| Latency | 7.9 seconds |

**Results — Page 256 (Stair 5, irregular layout):**

| Metric | Result |
|--------|--------|
| Views detected | 14 (too many — expected ~11) |
| Labels | Some correct, some duplicated ("Level P5" appeared twice) |
| Bounding boxes | Several overlapping, some spanning two views |
| Issues | Duplicate detections, misread labels ("LEVEL IP PLAN"), views merged or fragmented |
| Tokens | 1965 in / 981 out |
| Cost | $0.021 |
| Latency | 10.6 seconds |

**Visual inspection of crops**:
- Page 252 crops were mostly good but the tight bounding boxes meant some views had dimension annotations or title text cut off at the edges
- Page 256 crops had two-views-in-one-box problems, title block content leaking in, and shifted boundaries catching neighboring view content

**Verdict**: Very promising on regular grid layouts (page 252). Struggles with irregular/complex layouts (page 256) — duplicates views, struggles with varying view sizes, and bounding box precision is inconsistent.

### Experiment 7: Adding Automatic Padding

Added 2.5% padding on all sides of every detected bounding box after the LLM returns them. This is a simple post-processing step:

```typescript
const BBOX_PADDING = 0.025; // 2.5% padding
bbox = [
  Math.max(0, x1 - padding),
  Math.max(0, y1 - padding),
  Math.min(1, x2 + padding),
  Math.min(1, y2 + padding),
];
```

**Result**: Effectively eliminated the "clipping" problem on page 252. Views now include their full title text and dimension annotations. Minimal downside — some slight overlap between adjacent views, but that's preferable to missing content.

### Experiment 8: Two-Pass Self-Correction

**Approach**: After the first detection pass, draw the bounding boxes on the image and send the annotated image back to Claude with a correction prompt: "Here are the boxes from your first attempt. Review and fix any issues."

**First attempt at correction prompt** (general):
> "Are any views missing? Duplicated? Overlapping? Too small? Too large? Fix any issues."

**Results**:
- Page 252: Self-correction kept 10 views but **changed some correct labels to wrong ones** (three views became "Level 01" duplicates). Bounding boxes shifted.
- Page 256: Self-correction **inflated from 10 to 16 views** — hallucinated extras and duplicated several. The correction made it significantly worse.

**Second attempt at correction prompt** (constrained):
Added explicit constraints:
- Told it the first-pass view count was "most likely correct"
- "Do NOT add new views unless a titled drawing is clearly uncovered"
- "Do NOT split a single view into multiple detections"
- "Focus on adjusting POSITIONS, not adding/removing"
- "Final count should be close to N (within +/-2)"

Also added a **programmatic guard**: if pass 2 returns more than pass1Count + 2 views, discard the correction and keep pass 1 results.

**Results with constrained prompt**:
- Page 252: Correction changed labels incorrectly again (non-determinism between runs). The correction pass is not consistently improving results on pages that were already good.
- Page 256: Better than unconstrained — removed some duplicates. But still hallucinated views ("LEVEL OG P6", "STAIR 5 - PLANS AND SECTIONS" which is title block text, not a view). Found 14 views instead of ~11.

**Guard triggered**: On earlier unconstrained runs, the guard successfully caught inflation from 10 to 16 views and kept pass 1 results.

### Key Findings from LLM Experiments

1. **LLM vision dramatically outperforms all algorithmic approaches** — it's the first method that actually detects individual views rather than treating the whole page as one region. Every pixel-based method (contour detection, projection profiles) and every pretrained ML model (DocLayout-YOLO) failed completely.

2. **Regular grid layouts work well** — Page 252 (clean 3x3 grid of plan views + 1 section view) gets correct view count, correct labels, and reasonable bounding boxes on every run.

3. **Irregular layouts are problematic** — Page 256 (mixed-size views, non-uniform grid) consistently produces duplicates, hallucinated views, and boundary errors. This is the fundamental challenge.

4. **Bounding box precision is limited** — LLMs are not trained as object detectors. Coordinates can be off by 5-10% of the image dimension. The 2.5% padding post-processing helps but doesn't solve misaligned boxes.

5. **Non-determinism across runs** — The same page produces different results each time. View counts, labels, and box positions all vary. This makes the self-correction unreliable — the second pass may "fix" things that weren't broken.

6. **Self-correction is a double-edged sword** — On already-good results, it can degrade them (changing correct labels, shifting correct boxes). On bad results, it can help (removing obvious duplicates) but also introduce new hallucinations. The net effect is inconsistent.

7. **Cost is very reasonable** — ~$0.02-0.04 per page for single pass, ~$0.04-0.08 for two passes. Well within budget for a preprocessing step.

8. **Speed is acceptable** — 8-11 seconds per page per pass. For batch preprocessing this is fine.

### Artifacts Produced

All output saved to `eval/llm-view-detection-output/`:

Per page:
- `page-N-overview.jpg` — full page render at 150 DPI (7200x5400)
- `page-N-pass1-annotated.jpg` — overview with pass 1 bounding boxes drawn
- `page-N-annotated.jpg` — final annotated overview (after correction + padding)
- `page-N-pass1-detections.json` — pass 1 raw detections
- `page-N-detections.json` — final detections (padded)
- `page-N-detections.yolo.txt` — YOLO format for future training data
- `page-N-llm-response.json` — raw LLM response with token counts
- `page-N-view-{i}-{label}.jpg` — cropped image per view
- `page-N-view-{i}-{label}.txt` — filtered text items per view
- `detection-report.txt` — human-readable summary with costs

### Cost Summary Across All Runs

| Run | Pages | Passes | Total Cost | Avg/Page |
|-----|-------|--------|-----------|----------|
| Single-pass (Experiment 6) | 252, 256 | 1 | $0.037 | $0.019 |
| Two-pass unconstrained (Experiment 8a) | 252, 256 | 2 | $0.072 | $0.036 |
| Two-pass constrained (Experiment 8b) | 252, 256 | 2 | $0.075 | $0.038 |

### What Would Make This Production-Ready

Based on these experiments, the LLM approach works but needs additional reliability mechanisms:

1. **Hybrid with text clustering**: Use our existing title detection (from `test-view-clustering.ts`) to provide the LLM with hints — "we found these view titles at these approximate positions." This anchors the LLM and prevents hallucinated views.

2. **Consensus across runs**: Run detection 2-3 times and take the consensus (matching by IoU overlap). This smooths out non-determinism.

3. **Validation checks**: After detection, verify that each view has a reasonable text item count, that no two views have the same label, and that the total covered area is reasonable.

4. **Training data collection**: Every page processed (even imperfectly) generates YOLO-format annotations that can be human-reviewed and used to train a dedicated YOLO/Florence-2 model — which would be faster, cheaper, and more consistent than LLM detection.

5. **Higher resolution**: Testing with a larger input image (e.g., 2048px instead of 1568px) might improve the LLM's ability to read small title text and distinguish closely-spaced views.

---

## Open Questions

1. **Khan et al. model/data availability**: RESOLVED — Neither the trained YOLO model nor the annotated training data has been publicly released. No GitHub repo, no HuggingFace artifacts. We would need to create our own dataset.

2. **Gemini bounding box accuracy**: How precise are Gemini Flash's bounding boxes on construction drawings? Not yet tested. Claude Sonnet bounding boxes are off by 5-10% — Gemini may be better or worse given its specific bounding box feature.

3. **Florence-2 zero-shot performance**: BLOCKED — Could not test due to Python 3.14 / transformers 5.x compatibility issues. Needs pinned environment (Python 3.11, transformers 4.x) to test.

4. **Grounding DINO on drawings**: BLOCKED — Same dependency compatibility issue. Needs pinned transformers version.

5. **Cross-firm generalization**: How well does a model trained on one firm's drawings transfer to another firm's style? This determines how much ongoing labeling is needed.

6. **Optimal training strategy**: Is it better to train one model on all firms' drawings, or maintain per-firm fine-tuned models?

7. **Cloudflare deployment**: Can a Florence-2 (0.23B) model run on Cloudflare Workers AI, or does it need a separate GPU hosting service?

8. **Hybrid text+image features**: Could combining pdfjs-dist text positions with rendered image features improve detection accuracy? (Multi-modal input to the detector)

9. **Off-the-shelf models**: RESOLVED — DocLayout-YOLO pretrained model does NOT work for view detection on construction drawings. Treats entire page as one "figure."

10. **Algorithmic approaches**: RESOLVED — Contour detection and projection profiles do NOT work on dense construction drawings. Content is too interconnected for pixel-based segmentation.

11. **Claude vision for view detection**: PARTIALLY RESOLVED — Works well on regular grid layouts (~10 views, correct labels, $0.02/page). Struggles with irregular layouts (duplicates, hallucinations, imprecise boxes). Self-correction via two-pass approach is unreliable due to non-determinism. Padding (2.5%) helps with tight boxes. Hybrid approach (LLM + text clustering hints) is the most promising next step.

12. **Self-correction viability**: RESOLVED — Two-pass self-correction is inconsistent. It can degrade already-correct results and introduce new hallucinations. A constrained prompt + programmatic guard helps but doesn't fully solve the problem. Better to invest in hybrid approaches (anchoring with text data) than more correction passes.

---

## References and Resources

### Papers

| Paper | arXiv | Relevance |
|-------|-------|-----------|
| Khan et al. - Multi-Stage Hybrid Framework | [2510.21862](https://arxiv.org/abs/2510.21862) | Exact same problem, YOLO+VLM, F1=0.963 |
| Khan et al. - From Drawings to Decisions | [2506.17374](https://arxiv.org/abs/2506.17374) | YOLOv11-OBB + Donut VLM |
| Florence-2 for Engineering Drawings | [2411.03707](https://arxiv.org/abs/2411.03707) | Fine-tuning small VLM on 400 drawings |
| AEC-Bench | [2603.29199](https://arxiv.org/abs/2603.29199) | Retrieval bottleneck validation |
| AECV-Bench | [2601.04819](https://arxiv.org/abs/2601.04819) | VLM counting accuracy limits |
| DocLayout-YOLO | [2410.12628](https://arxiv.org/abs/2410.12628) | Best YOLO base for layout detection |
| VectorGraphNET | [2410.01336](https://arxiv.org/abs/2410.01336) | Graph-based vector PDF segmentation |
| Title Block Detection | [2504.08645](https://arxiv.org/abs/2504.08645) | CNN + GPT-4o for title block extraction |
| Deep Learning for Engineering Diagrams | [Springer](https://link.springer.com/article/10.1007/s10462-024-10779-2) | Comprehensive survey |
| Construction Drawing Symbol Detection | [Springer](https://link.springer.com/article/10.1007/s10032-024-00492-9) | YOLO for symbol detection, 79% mAP |

### Code and Models

| Resource | URL | License |
|----------|-----|---------|
| DocLayout-YOLO | [github.com/opendatalab/DocLayout-YOLO](https://github.com/opendatalab/DocLayout-YOLO) | AGPL-3.0 |
| Florence-2 | [huggingface.co/microsoft/Florence-2-large](https://huggingface.co/microsoft/Florence-2-large) | MIT |
| Grounding DINO | [github.com/IDEA-Research/GroundingDINO](https://github.com/IDEA-Research/GroundingDINO) | Apache-2.0 |
| AEC-Bench | [github.com/nomic-ai/aec-bench](https://github.com/nomic-ai/aec-bench) | Apache-2.0 |
| Donut VLM | [github.com/clovaai/donut](https://github.com/clovaai/donut) | MIT |
| Roboflow Inference | [github.com/roboflow/inference](https://github.com/roboflow/inference) | Apache-2.0 |
| PyMuPDF | [pymupdf.readthedocs.io](https://pymupdf.readthedocs.io/) | AGPL-3.0 |

### Datasets (Related but not exact match)

| Dataset | What | URL |
|---------|------|-----|
| FloorPlanCAD | 15K+ CAD floor plans | [floorplancad.github.io](https://floorplancad.github.io/) |
| ArchCAD-400K | 413K chunks from 5.5K drawings | [huggingface.co/datasets/jackluoluo/ArchCAD](https://huggingface.co/datasets/jackluoluo/ArchCAD) |
| DocLayNet | 80K+ document pages with layout labels | [huggingface.co/datasets/docling-project/DocLayNet](https://huggingface.co/datasets/docling-project/DocLayNet) |

**Note**: No public dataset exists with labeled view boundaries on multi-view construction drawing sheets. Creating one would be novel.

### Industry

| Company | What They Do | URL |
|---------|-------------|-----|
| Togal.AI | AI construction takeoffs, plan parsing | [togal.ai](https://www.togal.ai) |
| Bluebeam Max | Claude integration for construction drawings | [bluebeam.com](https://www.bluebeam.com/bluebeam-max/) |
| Kreo Software | AI takeoff and estimating | [kreo.net](https://www.kreo.net) |
| Civils.ai | AI earthworks takeoffs | [civils.ai](https://civils.ai) |
| SWAPP AI | Automated construction documentation | [swapp.ai](https://swapp.ai) |

---

## Appendix: Drawing Layout Examples

### Layout Type 1: Whitespace-Separated Grid (Most Common)

Views arranged in a roughly regular grid with whitespace gaps between them. No explicit frame borders. Titles below each view.

- **Best detection method**: Projection profiles + contour detection
- **Example**: OHWC drawing set, Stair 2 (page 252), Stair 4 (page 254)

### Layout Type 2: Explicit Frame Borders

Each view enclosed in a thin rectangular border. Clear visual separation.

- **Best detection method**: Hough line detection for frames
- **Example**: AO firm drawings (Image 4)

### Layout Type 3: Mixed Size Views

Tall section/axonometric view on the left spanning full page height, grid of smaller plan views on the right.

- **Best detection method**: Contour detection (handles non-uniform sizes naturally)
- **Example**: OHWC Stair 3 (page 256), Stair 5

### Layout Type 4: Uniform Plan Grid

Grid of same-sized plan views, one per floor level. Very regular.

- **Best detection method**: Any approach works — projection profiles, contour detection, or text clustering
- **Example**: OHWC Stair 4 (all plan views in 3x3 grid)

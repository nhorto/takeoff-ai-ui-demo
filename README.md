# TakeoffAI Electron MVP

A minimal viable product desktop application for AI-powered construction quantity takeoffs, wrapping the validated PoC agent loop in an Electron shell.

## Features

- ✅ Drag-and-drop PDF upload
- ✅ AI-powered quantity takeoff using Claude Opus 4.5
- ✅ Real-time chat interface with agent
- ✅ Tool execution status indicators
- ✅ Progressive PDF page loading (incremental image sending)
- ✅ Results display with token usage statistics
- ✅ CSV output compatible with PowerFab
- ✅ Offline-first (API key stored locally)

## Prerequisites

- **Bun** (package manager) - https://bun.sh
- **Node.js 18+** (for Electron)
- **Anthropic API Key** - https://console.anthropic.com/

## Installation

```bash
# Clone and navigate to the project directory
git clone https://github.com/YOUR_USERNAME/takeoff-ai-electron.git
cd takeoff-ai-electron

# Install dependencies
bun install
```

## Development

### Run in Development Mode

```bash
# Start both Vite dev server and Electron
bun run dev
```

This will:
1. Start Vite dev server on http://localhost:5173
2. Compile TypeScript main process
3. Launch Electron with hot reloading

### Build for Production

```bash
# Build renderer and main process
bun run build

# Package as desktop app (creates installer)
bun run package
```

## First Run Setup

1. Launch the app
2. You'll see an API Key setup screen
3. Enter your Anthropic API key (starts with `sk-ant-`)
4. Click Continue

Your API key is stored locally in:
```
~/Library/Application Support/takeoff-ai-electron/config.json
```

## Usage

1. **Upload PDF**: Drag a construction drawing PDF onto the upload area (or click to browse)
2. **Watch Progress**: The agent will:
   - Load the ConstructionTakeoff skill
   - Request PDF pages incrementally via tools
   - Analyze drawings and count quantities
   - Generate CSV outputs
3. **View Results**:
   - Chat messages show agent thinking and tool execution
   - Results panel shows token usage and cost
   - Click "Open Outputs Folder" to access generated files

## Project Structure

```
takeoff-ai-electron/
├── src/
│   ├── main/                  # Electron main process (Node.js)
│   │   ├── index.ts          # Entry point
│   │   ├── window.ts         # Window management
│   │   ├── ipc-handlers.ts   # IPC communication
│   │   ├── preload.ts        # Secure IPC bridge
│   │   └── core/             # Core agent logic
│   │       ├── orchestrator.ts    # 3-phase pipeline coordinator
│   │       ├── agent-loop.ts      # Claude API loop + tool trace logging
│   │       ├── tools.ts           # Tool implementations (get_page_text, etc.)
│   │       ├── pdf-extractor.ts   # PDF → image rendering
│   │       ├── pdf-text-extractor.ts # PDF → text (dual runtime: Electron/Node)
│   │       └── types.ts          # TypeScript types
│   │
│   ├── renderer/              # React UI
│   │   ├── App.tsx           # Root component
│   │   ├── components/       # UI components
│   │   ├── stores/           # Zustand state management
│   │   └── styles/           # Tailwind CSS
│   │
│   └── shared/
│       └── ipc-channels.ts   # IPC channel constants
│
├── eval/                      # Evaluation framework
│   ├── run-eval.ts           # CLI eval runner (imports compiled orchestrator)
│   ├── run-eval-cli.sh       # Shell wrapper (Electron shim + build)
│   ├── score-runs.ts         # Scoring against golden dataset
│   ├── dump-text.ts          # Text extraction diagnostic tool
│   ├── golden/               # Ground truth data
│   ├── runs/                 # Per-run score files
│   └── results/              # Comparison tables
│
├── resources/
│   └── knowledge-base/        # Agent prompts and domain knowledge
│
├── outputs/                   # Run outputs (stair JSONs, CSVs, traces)
├── docs/                      # Design docs and research
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Key Technologies

- **Electron 28** - Desktop application framework
- **React 18** - UI framework
- **Zustand** - State management
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Fast build tool
- **@anthropic-ai/sdk** - Claude API client
- **pdf.js** - PDF rendering (pure JavaScript)
- **@napi-rs/canvas** - Canvas for PDF to image conversion

## Architecture

### Main Process (Node.js)
- Handles file I/O and PDF extraction
- Executes tools (write_file, extract_pdf_pages, etc.)
- Manages API calls to Claude
- Runs multi-phase orchestrator: Discovery → Counting → Compilation
- **Page-level sandboxing**: Each counting agent is restricted to only its assigned PDF pages, preventing cross-stair data contamination. Agents run sequentially so page restrictions are enforced cleanly.

### Renderer Process (React)
- Provides UI for file upload and chat
- Displays messages and tool execution status
- Shows results and statistics
- Communicates with main via IPC

### Security
- **Context Isolation**: Enabled (renderer can't access Node.js directly)
- **Node Integration**: Disabled (security best practice)
- **Preload Script**: Secure bridge exposing only needed APIs

## Output Files

Generated files are saved to:
```
~/Library/Application Support/takeoff-ai-electron/outputs/
```

Typical outputs:
- `ProjectName_Stair_Takeoff.csv` - Bill of materials
- `ProjectName_Summary.txt` - Coordination notes and code violations

## Troubleshooting

### API Key Issues
- Check that your key starts with `sk-ant-`
- Verify the key at https://console.anthropic.com/
- Delete config: `rm ~/Library/Application\ Support/takeoff-ai-electron/config.json`

### PDF Upload Not Working
- Ensure PDF is not corrupted
- Check file size (tested up to 100MB)
- Try a different PDF

### Electron Won't Start
```bash
# Clean and rebuild
rm -rf node_modules dist
bun install
bun run build
bun run dev
```

### TypeScript Errors
```bash
# Check for compilation errors
bun run tsc --noEmit
```

## Development Roadmap

### Phase 1: MVP (Complete)
- ✅ Basic UI with file upload
- ✅ Agent loop integration
- ✅ Tool execution with parallel batching
- ✅ Results display with token tracking
- ✅ Prompt caching (90% cost reduction on system prompt)
- ✅ Hybrid image strategy (overview + pixel-coordinate crops)
- ✅ Working notes as external memory (images removed after processing)

### Phase 2: Agent Improvements
- ✅ Cropping protocol (VIEW → PLAN → WRITE → EXECUTE → RECORD)
- ✅ Two-writes-per-batch discipline for working notes
- ✅ Structured discovery output (strict enums, no free-form notes, eliminates discovery hallucinations)
- ⬜ System reminders after key tool calls
- ⬜ Structured JSON state files alongside markdown notes
- ⬜ Incremental CSV output (rows added as stairs complete)
- ⬜ Progress tracking UI

### Phase 3: Sub-Agent Architecture (Complete)
- ✅ Phase-based workflow with checkpoints
- ✅ Discovery agent (scan PDF, identify sheets and specs)
- ✅ Counting agents (one per stair, sequential with page sandboxing)
- ✅ Compilation agent (generate final outputs)
- ✅ Page-level access restrictions (each counter only sees its assigned pages)
- ✅ Annotation deduplication via spatial clustering (X-gap clustering in get_page_text, 71-79% accuracy)
- ⬜ Detail agent (merged into Discovery phase)
- ⬜ Failure recovery and retry from checkpoints

### Phase 3.5: Review Pipeline (Planned)

A **Review Phase** between Counting and Compilation that catches incomplete or low-confidence results before final output:

```
Discovery → Counting → REVIEW → Compilation → Done
```

- Auto-pass when all stairs have high coverage/confidence (no user interaction needed)
- Flag stairs with low coverage (<90%), low confidence, or unresolved anomalies
- User options: **Investigate** (look at drawings + provide guidance), **Re-run** (re-count specific stairs with updated instructions), **Accept as-is**, or **Abort**
- Re-runs only affect flagged stairs, injecting user guidance into the counting prompt
- See [docs/future-review-pipeline.md](docs/future-review-pipeline.md) for the full design

### Phase 4: Production Features
- ⬜ Context trimming and compression
- ⬜ Streaming responses (show thinking in real-time)
- ⬜ Session history (resume previous takeoffs)
- ⬜ Multiple PDFs at once
- ⬜ Backend server for auth and usage tracking
- ⬜ Auto-updates and code signing

See [docs/agent-improvements-roadmap.md](docs/agent-improvements-roadmap.md) for detailed technical plans.

## Evaluation System

A quantitative eval framework measures agent accuracy across runs, architectures, and models.

### Golden Dataset

Ground truth data for the OhioHealth Women's Center drawing set (7 stairs across pages 250-270), manually verified from construction documents. Each stair has expected tread and riser counts across all floor levels.

### Scoring

```bash
# Score a specific run
bun run eval/score-runs.ts <run-id>

# Compare all runs in a table
bun run eval/score-runs.ts --table

# Run new eval iterations (builds, shims Electron, runs orchestrator)
./eval/run-eval-cli.sh --runs 3
```

### Accuracy Tiers

| Tier | Criteria | Description |
|------|----------|-------------|
| Exact | delta = 0 | Perfect match |
| Close | delta <= 2 | Within rounding / single-flight error |
| Approximate | delta <= 5 | Correct structure, minor miscounts |

### Results Across Architectures

Runs across three generations of the pipeline show clear improvement at each stage:

| Architecture | Runs | Accuracy Range | Stair Count |
|-------------|------|----------------|-------------|
| Monolith (single agent) | 6 | 0-7% | Often wrong (1-8) |
| Orchestrated (pre-clustering) | 8 | 14-57% | Usually correct (7) |
| Orchestrated with spatial clustering | 4 | 71-79% | Always correct (7) |

Best run (`2026-03-11`, with spatial clustering):

| Stair | Treads | Risers | Status |
|-------|--------|--------|--------|
| Stair 1 | 48 (exact) | 52 (exact) | exact |
| Stair 2 | 257 (exact) | 281 (exact) | exact |
| Stair 3 | 178 (exact) | 196 (exact) | exact |
| Stair 4 | ~224 (~+6) | ~246 (~+6) | over |
| Stair 5 | 185 (exact) | 203 (exact) | exact |
| Stair 6 | 183 (exact) | 202 (exact) | exact |
| Stair 7 | 22 (exact) | 26 (exact) | exact |

**78.6% overall** (5/7 treads exact, 6/7 risers exact). Spatial clustering solved annotation deduplication for Stairs 2, 3, 5, and 6 — see [docs/spatial-clustering-improvement.md](docs/spatial-clustering-improvement.md) for the full analysis. Stair 4 remains the outstanding case (~+6 variable delta).

### Diagnostic Tools

```bash
# Dump extracted text exactly as the agent sees it
bun run eval/dump-text.ts                  # All stair pages
bun run eval/dump-text.ts --stair 6        # Single stair
bun run eval/dump-text.ts --pages 252,253  # Specific pages
```

### Key Findings

1. **Architecture matters more than prompting**: Orchestrated pipeline (Discovery → Counting → Compilation) with page-level sandboxing improved accuracy from 0-7% to 14-57%
2. **Spatial clustering solved annotation deduplication**: X-gap clustering in `get_page_text()` groups annotations by drawing view; the primary cluster (section view column) matches golden data exactly on every page, boosting accuracy to 71-79%
3. **Deterministic pre-processing beats prompt engineering**: The deduplication guide in `get_page_text()` output tells the agent exactly how many risers are in the primary cluster — eliminating judgment calls and run-to-run variance
4. **Tread and riser deltas are always equal per stair**: Errors are whole-flight miscounts, not individual annotation misreads
5. **Simple stairs are solved**: Stairs with single-view pages (Stair 1, 7) achieve 100% accuracy consistently

See [docs/eval-system-design.md](docs/eval-system-design.md) for the full eval system design.
See [docs/spatial-clustering-improvement.md](docs/spatial-clustering-improvement.md) for the March 11 clustering improvement details.

## Known Limitations (MVP Scope)

- ❌ No backend server (direct API calls from client)
- ❌ No user accounts or authentication
- ❌ No usage tracking or billing
- ❌ No session persistence across restarts
- ❌ Ask_user tool uses simple dialog (not custom modal)

## Testing

### Test with Sample PDF

1. Use any construction drawing PDF (multi-page sets with structural, architectural, or MEP drawings work best).

2. Expected behavior:
   - Agent loads ConstructionTakeoff skill
   - Requests pages incrementally
   - Analyzes stair drawings
   - Generates CSV with quantities

3. Verify outputs:
   - Check outputs folder for CSV
   - Verify results panel shows statistics
   - Check token usage is reasonable

## Cost Estimates

Using Claude Opus 4.5:
- Input: $3 per million tokens
- Output: $15 per million tokens

Typical 300-page PDF takeoff:
- ~50,000-100,000 tokens
- **Estimated cost: $0.15 - $0.30 per takeoff**

With prompt caching (90% reduction):
- **Estimated cost: $0.02 - $0.05 per takeoff**

## Support

For issues or questions:
1. Check this README
2. Review the project documentation in the `docs/` directory
3. Check Electron DevTools (View → Toggle Developer Tools)

## License

Private - Internal use only

---

**Built with the Electron MVP shell wrapping the validated TakeoffAI PoC agent loop.**

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
│   │   └── core/             # PoC core logic
│   │       ├── agent-loop.ts # Claude API orchestration
│   │       ├── tools.ts      # Tool implementations
│   │       ├── pdf-extractor.ts # PDF rendering
│   │       └── types.ts      # TypeScript types
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
├── resources/
│   └── knowledge-base/        # Skills and workflows (from PoC)
│       ├── CLAUDE.md
│       └── skills/
│
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
- Runs agent loop with streaming updates

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
- ⬜ System reminders after key tool calls
- ⬜ Structured JSON state files alongside markdown notes
- ⬜ Incremental CSV output (rows added as stairs complete)
- ⬜ Progress tracking UI

### Phase 3: Sub-Agent Architecture (Complete)
- ✅ Phase-based workflow with checkpoints
- ✅ Discovery agent (scan PDF, identify sheets and specs)
- ✅ Parallel counting agents (one per stair)
- ✅ Compilation agent (generate final outputs)
- ⬜ Detail agent (merged into Discovery phase)
- ⬜ Failure recovery and retry from checkpoints

### Phase 4: Production Features
- ⬜ Context trimming and compression
- ⬜ Streaming responses (show thinking in real-time)
- ⬜ Session history (resume previous takeoffs)
- ⬜ Multiple PDFs at once
- ⬜ Backend server for auth and usage tracking
- ⬜ Auto-updates and code signing

See [docs/agent-improvements-roadmap.md](docs/agent-improvements-roadmap.md) for detailed technical plans.

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

# TakeoffAI - What's Next

Tracking upcoming work, ideas, and planned features. Check items off as they're completed.

---

## High Priority

- [ ] **Review Pipeline Phase** - Add a review step between Counting and Compilation that catches incomplete/low-confidence results before final output. User can investigate, re-run specific stairs with guidance, accept as-is, or abort. See [docs/future-review-pipeline.md](docs/future-review-pipeline.md) for full design.
- [ ] **Failure recovery and retry from checkpoints** - If a counting agent crashes or the app closes mid-run, resume from the last completed phase instead of restarting
- [ ] **Progress tracking UI** - Show per-stair progress during counting phase (which stair is running, which are done, estimated time)

## Medium Priority

- [ ] **Streaming responses** - Show agent thinking in real-time instead of waiting for full response
- [ ] **Incremental CSV output** - Add rows to CSV as each stair completes, so partial results are available if something fails
- [ ] **Session history** - Resume previous takeoffs, view past results
- [ ] **Detail agent** - Currently merged into Discovery phase; consider splitting back out for complex projects
- [ ] **System reminders after key tool calls** - Inject reminders to keep the agent on track during long conversations

## Low Priority / Ideas

- [ ] **Multiple PDFs at once** - Support uploading multiple PDF sets for a single project
- [ ] **Context trimming and compression** - Manage token usage for very large projects
- [ ] **Backend server** - Auth, usage tracking, billing
- [ ] **Auto-updates and code signing** - Production distribution
- [ ] **Structured JSON state files** - Alongside markdown working notes for better inter-phase data passing

## Completed

- [x] Page-level sandboxing for counting agents (sequential execution with `setAllowedPages`)
- [x] Multi-phase orchestrator (Discovery → Counting → Compilation)
- [x] Prompt caching (90% cost reduction)
- [x] Hybrid image strategy (overview + pixel-coordinate crops)
- [x] Text-first workflow (zero-cost text extraction before image extraction)

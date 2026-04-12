# TakeoffAI Cloudflare Validation Spike

Minimal throwaway project to validate 3 critical unknowns before committing to the full Cloudflare migration.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare account](https://dash.cloudflare.com/sign-up) on the **Workers Paid plan** ($5/month)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (included as dev dependency)
- An Anthropic API key
- A real construction PDF for testing

## Setup

```bash
cd spike

# Install dependencies
npm install

# Authenticate with Cloudflare (one-time)
npx wrangler login

# Create the R2 bucket
npx wrangler r2 bucket create takeoff-spike-files

# Store your Anthropic API key as a secret
npx wrangler secret put ANTHROPIC_API_KEY
# (paste your key when prompted)
```

**Important:** After creating the R2 bucket, the bucket name in `wrangler.jsonc` should match. It's already set to `takeoff-spike-files`.

## Deploy

```bash
# Local development (note: Browser Rendering only works when deployed, not locally)
npx wrangler dev

# Deploy to Cloudflare
npx wrangler deploy
```

After deploying, you'll get a URL like `https://takeoff-spike.<your-subdomain>.workers.dev`.

## Run the Tests

### Step 1: Upload a test PDF

```bash
curl -F "pdf=@/path/to/your/construction-drawings.pdf" \
  https://takeoff-spike.<your-subdomain>.workers.dev/upload
```

### Step 2: Test Browser Rendering (PDF → PNG quality)

```bash
# Get page 1 as PNG (returns image directly)
curl -X POST "https://takeoff-spike.<your-subdomain>.workers.dev/test/render?page=1" \
  --output page1-cloudflare.png

# Get page 5 as JPEG (matching current app settings)
curl -X POST "https://takeoff-spike.<your-subdomain>.workers.dev/test/render?page=5&format=jpeg" \
  --output page5-cloudflare.jpeg

# Get metadata instead of image
curl -X POST "https://takeoff-spike.<your-subdomain>.workers.dev/test/render?page=1&meta=true"
```

**What to check:**
- Open the PNG alongside the same page rendered by the Electron app
- Compare: text legibility, line clarity, dimension annotations, hatching patterns
- The images don't need to be pixel-identical — they just need to carry the same information for Claude

### Step 3: Test unpdf Text Extraction

```bash
# Extract text from page 1
curl -X POST "https://takeoff-spike.<your-subdomain>.workers.dev/test/text?page=1" | jq .

# Extract text from all pages
curl -X POST "https://takeoff-spike.<your-subdomain>.workers.dev/test/text?all=true" | jq .
```

**What to check:**
- Stair names and identifiers (e.g., "STAIR A", "STR-1")
- Page references (e.g., "SEE SHEET S3.1")
- Dimension callouts (e.g., "7'-11 1/2\"", "14 GA")
- Schedule table content
- Title block information
- Compare the spatial zone breakdown to what the current app extracts

### Step 4: Test Prompt Caching Across Workflow Steps

```bash
# This takes 30-60 seconds (3 Claude API calls in a Workflow)
curl -X POST "https://takeoff-spike.<your-subdomain>.workers.dev/test/cache" | jq .
```

**What to check in the response:**
- Step 1 should show `cacheCreationTokens > 0` (system prompt cached)
- Steps 2 and 3 should show `cacheReadTokens > 0` (cache hit)
- The `cacheWorking` field should be `true`
- The `summary` field gives a human-readable pass/fail

## Pass/Fail Criteria

| Test | Pass | Fail → Fallback |
|------|------|-----------------|
| Browser Rendering | Claude can extract same info from these images as from pdfjs-dist renders | Use ConvertAPI ($0.0035/page) or Cloudflare Container with Poppler |
| unpdf Text | Captures stair names, dimensions, annotations, spatial layout | Rely more on images (costs more tokens but still works) |
| Prompt Caching | Steps 2-3 show cache_read_input_tokens > 0 | Run agent loop inside Durable Object instead of Workflow (loses crash recovery, keeps caching) |

## Cleanup

When you're done testing:

```bash
# Delete the Worker
npx wrangler delete

# Delete the R2 bucket (empty it first)
npx wrangler r2 bucket delete takeoff-spike-files
```

## What's Next

If all 3 tests pass → proceed to Step 1 of the implementation roadmap (`docs/cloudflare-implementation-roadmap.md`).

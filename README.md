<p align="center">
  <strong>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</strong>
</p>

# Al-Masail — Hanafi Fiqh Knowledge Base & AI Search

A static Astro website for Hanafi fiqh masail (Islamic jurisprudence) with trilingual support (Roman Urdu, English, Urdu script), powered by an AI-driven RAG (Retrieval-Augmented Generation) pipeline that processes classical Islamic books into searchable, answerable knowledge.

**Live site:** Deployed on Netlify (static frontend) + Convex (serverless backend)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Pipeline: From PDFs to Answers](#pipeline-from-pdfs-to-answers)
  - [Phase 1: OCR (PDF → Text)](#phase-1-ocr-pdf--text)
  - [Phase 2: Chunking + Embeddings](#phase-2-chunking--embeddings)
  - [Phase 3: Upload to Convex](#phase-3-upload-to-convex)
  - [Runtime: Question Answering](#runtime-question-answering)
- [Source Books (resources/)](#source-books-resources)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Frontend Development](#frontend-development)
  - [Running the Full Pipeline](#running-the-full-pipeline)
- [Large Files: resources/ and chunks/](#large-files-resources-and-chunks)
- [Environment Variables](#environment-variables)
- [NPM Scripts Reference](#npm-scripts-reference)
- [Key Design Decisions](#key-design-decisions)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Al-Masail is a religious resource for Hanafi fiqh. It has two main parts:

1. **Static Website** — Astro-based pages with curated masail (Q&A), decision trees for common questions (haiz, nifas, salah, etc.), Ramadan planners, dhikr counters, and downloadable PDFs. All content is trilingual (Roman Urdu primary, English, Urdu script).

2. **AI Kitab Search** — A RAG pipeline that ingests 33 classical Islamic books (560MB+ of PDFs), OCRs them with Mistral, chunks the text, embeds it with Gemini, stores everything in Convex, and lets users ask fiqh questions in any of the 3 languages. Gemini 2.5 Flash generates formatted answers citing the source books.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     OFFLINE PIPELINE                         │
│                                                              │
│  resources/           Phase 1              Phase 2           │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────────┐     │
│  │ 33 PDFs  │──▶│ Mistral OCR  │──▶│ Smart Chunking  │     │
│  │ (560MB)  │   │ (mistral-    │   │ + Gemini Embed  │     │
│  │          │   │  ocr-2512)   │   │ (768-dim)       │     │
│  └──────────┘   └──────┬───────┘   └────────┬────────┘     │
│                        │                     │               │
│                        ▼                     ▼               │
│               extracted/              chunks/                │
│               ┌────────────┐          ┌──────────────┐      │
│               │ Markdown + │          │ 10,490 chunks│      │
│               │ JSON per   │          │ with 768-dim │      │
│               │ book       │          │ embeddings   │      │
│               └────────────┘          └──────┬───────┘      │
│                                              │               │
│                                    Phase 3   │               │
│                                              ▼               │
│                                     ┌────────────────┐      │
│                                     │ Convex Upload  │      │
│                                     │ (batch ingest) │      │
│                                     └────────────────┘      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    RUNTIME (LIVE)                             │
│                                                              │
│  User asks: "wuzu ke faraiz kya hain?"                      │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────────────┐            │
│  │              Convex Action (ask.ts)          │            │
│  │                                              │            │
│  │  1. Sanitize + detect language               │            │
│  │  2. Rate limit check                         │            │
│  │  3. Enrich query (Roman Urdu → Urdu script) │            │
│  │  4. Embed question (Gemini 768-dim)          │            │
│  │  5. Vector search (cosine similarity)        │            │
│  │  6. Text search fallback (BM25-like)         │            │
│  │  7. Merge + rerank with keyword signals      │            │
│  │  8. Format answer with Gemini 2.5 Flash      │            │
│  │  9. Return with source book citations        │            │
│  └─────────────────────────────────────────────┘            │
│       │                                                      │
│       ▼                                                      │
│  Formatted answer in Roman Urdu / English / Urdu             │
│  with book citations + disclaimer                            │
└──────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | [Astro](https://astro.build) (static) | HTML pages, zero JS by default |
| **Styling** | Vanilla CSS + CSS custom properties | Islamic book aesthetic, no frameworks |
| **Backend** | [Convex](https://convex.dev) | Serverless DB, vector search, actions |
| **OCR** | [Mistral OCR](https://docs.mistral.ai/capabilities/document/) (`mistral-ocr-2512`) | PDF → structured Markdown extraction |
| **Embeddings** | [Gemini Embedding](https://ai.google.dev/gemini-api/docs/embeddings) (`gemini-embedding-001`) | 768-dim vectors for semantic search |
| **Answer Gen** | [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models) | RAG answer formatting with safety rules |
| **Hosting** | Netlify | Static site deployment |
| **i18n** | Custom `<T>` component + `data-lang-text` | 3-language support (Roman Urdu, English, Urdu) |

---

## Project Structure

```
al-masail/
├── src/                          # Astro frontend source
│   ├── pages/                    # Route pages (thin — import data + compose components)
│   │   ├── index.astro           # Homepage
│   │   ├── ask.astro             # AI Kitab Search page
│   │   ├── haiz.astro            # Haiz masail topic page
│   │   ├── nifas.astro           # Nifas masail
│   │   ├── istihaza.astro        # Istihaza masail
│   │   ├── salah.astro           # Salah masail
│   │   ├── sawm.astro            # Sawm/Roza masail
│   │   ├── taharah.astro         # Taharah masail
│   │   ├── sawal.astro           # Decision tree Q&A flows
│   │   ├── ramadan.astro         # Ramadan planner + wazaif
│   │   ├── counter.astro         # Dhikr counter
│   │   └── downloads.astro       # Downloadable PDFs
│   ├── components/               # Astro components (organized by feature)
│   ├── content/                  # Content data files (typed TS arrays)
│   ├── styles/                   # CSS files (global tokens + per-page)
│   ├── scripts/                  # Client-side JS (extracted when >80 lines)
│   ├── layouts/                  # Base HTML layout
│   └── i18n/                     # Shared TypeScript types
│
├── convex/                       # Convex serverless backend
│   ├── schema.ts                 # Database schema (chunks, questions, config, etc.)
│   ├── ask.ts                    # Main question-answering action (RAG pipeline)
│   ├── search.ts                 # Vector + text search functions
│   ├── gemini.ts                 # Gemini embedding + answer generation
│   ├── chunks.ts                 # Chunk ingestion mutations
│   ├── config.ts                 # Search configuration
│   ├── questions.ts              # Question logging queries
│   ├── admin.ts                  # Admin stats queries
│   ├── rateLimiter.ts            # Per-client rate limiting
│   └── lib/                      # Shared utilities
│       ├── queryExpansion.ts     # Roman Urdu ↔ Urdu script term mapping
│       ├── ranking.ts            # Score merging + enrichment
│       ├── sanitize.ts           # Input sanitization + language detection
│       ├── messages.ts           # i18n messages (not found, disclaimer)
│       └── validators.ts         # Convex value validators
│
├── scripts/                      # Offline processing pipeline scripts
│   ├── ocr/                      # Phase 1: PDF → OCR text
│   │   ├── run-ocr.py            # Entry point
│   │   ├── ocr_pipeline.py       # Batch OCR orchestrator
│   │   ├── chunking.py           # PDF splitting (Ghostscript / pypdf)
│   │   ├── reassembly.py         # Reassemble OCR results per book
│   │   ├── config.py             # OCR config dataclass
│   │   ├── ocr_helpers.py        # Utility functions
│   │   └── requirements.txt      # mistralai, pypdf
│   ├── chunking/                 # Phase 2: Text → chunks + embeddings
│   │   ├── run-phase2.py         # Entry point
│   │   ├── chunk_builder.py      # Smart paragraph-aware chunking
│   │   ├── embedding.py          # Gemini/Mistral embedding with progress
│   │   ├── pipeline.py           # Phase 2 orchestrator
│   │   ├── text_utils.py         # Text normalization, language detection
│   │   ├── topic_keywords.py     # Topic tagging keywords (20 fiqh topics)
│   │   ├── config.py             # Chunking config dataclass
│   │   └── requirements.txt      # mistralai, requests
│   ├── convex/                   # Phase 3: Upload to Convex
│   │   ├── upload-chunks.ts      # Batch uploader with adaptive retry
│   │   ├── upload-utils.ts       # JSONL streaming, chunk mapping
│   │   ├── validate-chunks.ts    # Pre-upload validation
│   │   ├── check-stats.ts        # Post-upload stats checker
│   │   ├── smoke-ask.ts          # End-to-end smoke test
│   │   ├── set-local-convex-env.ts  # Env file generator
│   │   ├── run-convex.ts         # Convex CLI wrapper
│   │   └── env-loader.ts         # Multi-env dotenv loader
│   └── fix-embeddings.sh         # One-shot: migrate Mistral → Gemini embeddings
│
├── resources/                    # 📚 Source PDFs (560MB) — NOT in git
│   ├── bahar-e-shariat/          # Bahar-e-Shariat Jild 1-3 (4,085 pages)
│   ├── p-mariam/                 # Custom planners + wazaif PDFs
│   └── quality-ones/             # 25+ specialized fiqh books
│
├── extracted/                    # OCR output (48MB) — Markdown + JSON per book
│   ├── _manifest.json            # OCR run manifest
│   └── resources/                # Mirrors resources/ structure
│
├── chunks/                       # Processed chunks + embeddings (1.2GB) — NOT in git
│   ├── all-chunks.json           # 10,490 text chunks (no embeddings)
│   ├── all-chunks-embedded.json  # Chunks with 768-dim Gemini embeddings
│   ├── all-chunks-embedded.jsonl # Same, line-delimited (streaming upload)
│   ├── embedding-progress.jsonl  # Resume-safe embedding progress
│   ├── chunking-report.json      # Quality report
│   └── state.json                # Pipeline state
│
├── pdf_chunks/                   # Split PDF chunks for OCR (temp) — NOT in git
├── ocr_artifacts/                # OCR batch state + raw outputs — NOT in git
├── ocr_run.log                   # Phase 1 log
├── phase2_run.log                # Phase 2 log
│
├── .env.convex.example           # Template for Convex env vars
├── .env.convex.local             # Local Convex env (gitignored)
├── .env.local                    # Local env (gitignored)
├── convex.json                   # Convex project config
├── astro.config.mjs              # Astro config
├── netlify.toml                  # Netlify deployment config
├── package.json                  # Dependencies + scripts
├── tsconfig.json                 # TypeScript config
└── AGENTS.md                     # AI assistant development guidelines
```

---

## Pipeline: From PDFs to Answers

### Phase 1: OCR (PDF → Text)

**Model:** `mistral-ocr-2512` (Mistral's document OCR model)

**What it does:**
1. Scans `resources/` for all PDFs (33 books, 7,738 pages total)
2. Splits large PDFs into chunks ≤40MB using Ghostscript (or pypdf fallback)
3. Uploads chunks to Mistral's file API and gets signed URLs
4. Submits a batch OCR job (or falls back to direct API calls on free tier)
5. Downloads results and reassembles into per-book Markdown + JSON

**OCR Configuration:**
- Table extraction: HTML format
- Header/footer extraction: enabled
- Image base64: disabled (text-only)
- Max chunk size: 40MB / 1000 pages per request

**Output:** `extracted/` directory with `_ocr.md` and `_ocr.json` per book, plus `_manifest.json`

**Run:**
```bash
cd scripts/ocr
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export MISTRAL_API_KEY="your-key"
python run-ocr.py          # Full run (submit + wait + download)
python run-ocr.py --fresh  # Clean rerun
```

### Phase 2: Chunking + Embeddings

**What it does:**
1. Reads OCR JSON output from `extracted/`
2. Builds semantically meaningful text chunks:
   - **Target:** 280 words per chunk
   - **Min:** 80 words (merges short pages)
   - **Max:** 500 words (splits long sections)
   - **Overlap:** 50 words between adjacent chunks
3. Tags each chunk with fiqh topics (haiz, wuzu, salah, etc.) using keyword matching
4. Detects language per chunk (Urdu script, Roman Urdu, Hindi)
5. Generates embeddings for all 10,490 chunks

**Embedding Model:** `gemini-embedding-001` (Google)
- **Dimensions:** 768 (reduced from native 3072 via `outputDimensionality`)
- **Task type:** `RETRIEVAL_DOCUMENT` for chunks, `RETRIEVAL_QUERY` for queries
- **Batch size:** 20 chunks per API call
- **Progress:** Resumable via `embedding-progress.jsonl` (safe to interrupt and restart)

> **History:** Initially used `mistral-embed` (1024-dim). Migrated to Gemini embeddings for better multilingual (Urdu/Arabic) performance and lower dimensions. The `fix-embeddings.sh` script handles this migration.

**Output:** `chunks/` directory with JSON, JSONL, and report files

**Run:**
```bash
cd scripts/chunking
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY="your-key"   # or GOOGLE_API_KEY
python run-phase2.py --fresh
```

### Phase 3: Upload to Convex

**What it does:**
1. Validates chunk embeddings (dimension check, empty text, page ranges)
2. Creates an ingestion run in Convex
3. Streams chunks from JSONL in batches of 40
4. Upserts into Convex `chunks` table with vector index
5. Updates `searchConfig` table with embedding metadata

**Convex Schema (key tables):**

| Table | Purpose |
|-------|---------|
| `chunks` | 10,490 text chunks with 768-dim embeddings, topic tags, source metadata |
| `searchConfig` | Active embedding model, dimensions, relevance threshold |
| `questions` | Logged user queries with scores and timing |
| `ingestionRuns` | Upload run tracking |
| `rateLimits` | Per-client hourly rate limits |

**Convex Indexes:**
- `by_embedding` — Vector index (768-dim, cosine similarity) filterable by language and embedding model
- `by_text` — Full-text search index on normalized text, filterable by language
- `by_external_id` — Deduplication during re-uploads

**Run:**
```bash
npm run convex:validate-chunks     # Pre-check
npm run convex:deploy:prod         # Deploy schema + functions
npm run convex:upload:prod         # Upload 10,490 chunks
npm run convex:check-stats:prod    # Verify
npm run convex:smoke-ask:prod      # Test 3 sample questions
```

### Runtime: Question Answering

When a user types a question on the `/ask` page:

1. **Sanitize** — Strip HTML/markdown, limit to 500 chars
2. **Detect language** — Urdu script vs Latin chars ratio
3. **Rate limit** — 30 requests/hour per client
4. **Query enrichment** — Map Roman Urdu terms to Urdu script equivalents:
   - `"wuzu ke faraiz"` → `"wuzu ke faraiz (وضو فرائض)"`
   - Uses a 60+ term fiqh dictionary (`queryExpansion.ts`)
5. **Embed question** — Gemini `gemini-embedding-001` with `RETRIEVAL_QUERY` task type, 768 dims
6. **Vector search** — Top 20 chunks by cosine similarity from Convex vector index
7. **Text search fallback** — BM25-like full-text search with expanded query terms
8. **Merge + rerank** — Combine vector and text results, boost/penalize based on keyword signals:
   - Topic matches (wuzu, haiz, etc.) get +0.04 per match
   - Qualifier matches (faraiz, sunnat, makruh, etc.) get +0.06 per match
   - Missing qualifier penalty: -0.12
   - No match at all: -0.10
9. **Threshold check** — Best score must be ≥0.52 (dynamic, slightly lower if vector search failed)
10. **Format with Gemini** — Gemini 2.5 Flash generates a structured answer:
    - **Mukhtasar Jawab** (short answer) + **Tafseel** (detailed explanation)
    - Language-locked system prompts prevent script drift
    - Safety rules: no violent rulings, no hadd punishments, sensitive topics → "consult a mufti"
    - Temperature: 0.15 (low creativity, high fidelity)
11. **Return** — Answer + source book names + disclaimer

---

## Source Books (resources/)

33 classical and contemporary Hanafi fiqh books, totaling 7,738 pages:

| Collection | Books | Pages | Description |
|-----------|-------|-------|-------------|
| **Bahar-e-Shariat** | 3 volumes | 4,085 | Comprehensive Hanafi fiqh encyclopedia (Urdu) |
| **Quality Ones** | 25 books | 3,584 | Specialized topics: haiz, wuzu, salah, women's masail, etc. |
| **P-Mariam** | 5 books | 80 | Ramadan planners, wazaif, durood, qaseeda |

Notable books include:
- بہارِ شریعت (Bahar-e-Shariat) — The definitive Hanafi reference
- قانون شریعت (Qanoon-e-Shariat) — Comprehensive ruling compilation
- برکات شریعت برائے خواتین — Women's fiqh rulings
- بچوں کے اسلامی احکام — Children's Islamic rulings
- جنتی زیور — Popular household fiqh guide
- خواتین کے لیے جدید مسائل — Modern women's fiqh issues

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10 (for OCR/chunking pipeline)
- **Ghostscript** (optional, for faster PDF splitting): `brew install ghostscript`

### Frontend Development

```bash
# Install dependencies
npm install

# Start dev server (static site only — no backend needed)
npm run dev
# → http://localhost:4321

# Build for production
npm run build

# Preview production build
npm run preview
```

The static pages (masail, decision trees, Ramadan, counter) work without any backend. The `/ask` (kitab search) page requires a running Convex backend.

### Running the Full Pipeline

If you have the source PDFs in `resources/` and want to rebuild everything:

```bash
# 1. OCR all PDFs (requires MISTRAL_API_KEY)
cd scripts/ocr
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export MISTRAL_API_KEY="your-key"
python run-ocr.py --fresh

# 2. Chunk + embed (requires GEMINI_API_KEY)
cd ../chunking
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY="your-key"
python run-phase2.py --fresh --provider gemini

# 3. Set up Convex env
cd ../..
cp .env.convex.example .env.convex.local
# Edit .env.convex.local with your Convex deployment details + API keys

# 4. Deploy schema + upload chunks
npm run convex:deploy:prod
npm run convex:upload:prod -- --reset --batch 40

# 5. Verify
npm run convex:smoke-ask:prod
```

---

## Large Files: resources/ and chunks/

`resources/` (560MB of PDFs) and `chunks/` (1.2GB of embeddings) are too large for GitHub. Here's how to handle them:

### What's Already in Git

| Directory | In Git? | Size | Contents |
|-----------|---------|------|----------|
| `src/` | ✅ Yes | Small | Frontend source code |
| `convex/` | ✅ Yes | Small | Backend functions |
| `scripts/` | ✅ Yes | Small | Pipeline scripts |
| `extracted/` | ✅ Yes | 48MB | OCR output (Markdown + JSON) |
| `resources/` | ❌ No | 560MB | Source PDF books |
| `chunks/` | ❌ No | 1.2GB | Chunks + embeddings |
| `pdf_chunks/` | ❌ No | Variable | Temp split PDFs |
| `ocr_artifacts/` | ❌ No | Variable | OCR batch state |

### Option 1: Git LFS (Recommended for Team Access)

Best if collaborators need to `git clone` and have everything ready.

```bash
# Install Git LFS
brew install git-lfs  # macOS
git lfs install

# Track large files
git lfs track "resources/**/*.pdf"
git lfs track "chunks/all-chunks.json"
git lfs track "chunks/all-chunks-embedded.jsonl"

# This creates/updates .gitattributes
git add .gitattributes
git add resources/ chunks/all-chunks.json chunks/all-chunks-embedded.jsonl
git commit -m "Add source PDFs and chunks via Git LFS"
git push
```

**Pros:** Seamless `git clone` experience, version-tracked
**Cons:** GitHub LFS has 1GB free storage + 1GB/month bandwidth. You'd need [GitHub LFS billing](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-storage-and-bandwidth-usage) ($5/mo per 50GB data pack) or use a free LFS host.

### Option 2: GitHub Releases (Recommended for Public Repos)

Best for public repos — upload as release assets, document download steps.

```bash
# Create a compressed archive
tar -czf al-masail-resources-v1.tar.gz resources/
tar -czf al-masail-chunks-v1.tar.gz chunks/all-chunks.json chunks/all-chunks-embedded.jsonl chunks/chunking-report.json

# Upload as a GitHub Release asset (via web UI or gh CLI)
gh release create v1.0.0 \
  al-masail-resources-v1.tar.gz \
  al-masail-chunks-v1.tar.gz \
  --title "v1.0.0 — Initial Release" \
  --notes "Includes source PDFs and pre-computed chunks with Gemini embeddings"
```

Then in the repo, users download:
```bash
# After cloning the repo
gh release download v1.0.0
tar -xzf al-masail-resources-v1.tar.gz
tar -xzf al-masail-chunks-v1.tar.gz
```

**Pros:** Free (2GB per file limit), no extra billing, clean repo history
**Cons:** Manual download step, not auto-fetched on clone

### Option 3: External Cloud Storage

Upload to Google Drive, S3, or Hugging Face Datasets and add download instructions.

```bash
# Example: Hugging Face Datasets (free, unlimited for public datasets)
pip install huggingface_hub
huggingface-cli upload your-username/al-masail-data resources/ --repo-type dataset
huggingface-cli upload your-username/al-masail-data chunks/ --repo-type dataset
```

### Option 4: Provide a Setup Script

Create a `setup.sh` that downloads from wherever you host the files:

```bash
#!/bin/bash
# setup.sh — Download large files needed for the pipeline
echo "Downloading source PDFs..."
# curl/wget from your hosting
echo "Downloading pre-computed chunks..."
# curl/wget from your hosting
echo "Done! Run 'npm run dev' to start."
```

### What You Actually Need

Not everyone needs all the large files:

| Use Case | What You Need |
|----------|---------------|
| **Frontend dev only** | Nothing extra — `npm run dev` works |
| **Kitab search dev** | Just Convex env vars (data is already in Convex cloud) |
| **Re-run OCR** | `resources/` (560MB of PDFs) |
| **Re-run chunking** | `extracted/` (already in git) |
| **Re-run embedding** | `chunks/all-chunks.json` (56MB, no embeddings) |
| **Re-upload to Convex** | `chunks/all-chunks-embedded.jsonl` (167MB) |
| **Full pipeline rebuild** | `resources/` only — everything else is regenerated |

### Recommended .gitignore Setup (Current)

The `.gitignore` already excludes the right things:

```gitignore
# Large pipeline artifacts (download separately or regenerate)
resources/          # Uncomment if you want to exclude PDFs
chunks/all-chunks.json
chunks/all-chunks-embedded.json
chunks/all-chunks-embedded.jsonl
chunks/embedding-progress.jsonl
pdf_chunks/
ocr_artifacts/
ocr_run.log
phase2_run.log
```

---

## Environment Variables

### `.env.convex.local` (Convex backend)

```bash
CONVEX_DEPLOYMENT=dev:your-deployment-name
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_SITE_URL=https://your-deployment.convex.site
CONVEX_INGEST_KEY=your-random-secret        # Protects ingestion mutations
CONVEX_DEPLOY_KEY=                           # For CI/non-login deploys
CONVEX_EMBEDDING_DIM=768                     # Must match embedding model output
GEMINI_API_KEY=your-gemini-key               # Used by Convex actions (embed + answer)
MISTRAL_API_KEY=your-mistral-key             # Optional fallback
```

### `.env.local` (Frontend)

```bash
PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

### Pipeline scripts (set via export or `.env` in script dirs)

```bash
MISTRAL_API_KEY=your-key    # Phase 1 (OCR)
GEMINI_API_KEY=your-key     # Phase 2 (embeddings) + Convex runtime
```

---

## NPM Scripts Reference

### Frontend
| Script | Description |
|--------|-------------|
| `npm run dev` | Start Astro dev server at `localhost:4321` |
| `npm run build` | Build static site to `dist/` |
| `npm run preview` | Preview production build locally |

### Convex Backend
| Script | Description |
|--------|-------------|
| `npm run convex:dev` | Start Convex dev mode (hot reload) |
| `npm run convex:deploy:prod` | Deploy functions/schema to production |
| `npm run convex:deploy:dev` | Deploy to development environment |
| `npm run convex:upload:prod` | Upload chunks to production Convex |
| `npm run convex:check-stats:prod` | Show chunk count, coverage, recent runs |
| `npm run convex:smoke-ask:prod` | Test 3 sample questions against production |
| `npm run convex:sync:prod` | Full sync: deploy → upload → stats → smoke test |
| `npm run convex:validate-chunks` | Validate local chunk files before upload |
| `npm run convex:set-env` | Generate `.env.convex.local` from CLI args |

---

## Key Design Decisions

### Why Mistral OCR?

The source books are scanned Urdu-script PDFs with complex layouts (tables, footnotes, Arabic calligraphy). Mistral OCR (`mistral-ocr-2512`) handles:
- Mixed Arabic + Urdu + occasional Hindi text
- Complex table structures (extracted as HTML)
- Headers/footers (extracted separately for chapter detection)
- Large documents (batch API supports 1000 pages per request)

### Why Gemini Embeddings over Mistral?

We initially used `mistral-embed` (1024-dim) but switched to `gemini-embedding-001` (768-dim) because:
- Better performance on multilingual Urdu/Arabic text
- Smaller vectors (768 vs 1024) = less storage + faster search
- Native `outputDimensionality` control
- Separate task types (`RETRIEVAL_DOCUMENT` vs `RETRIEVAL_QUERY`) improve recall

### Why Convex?

- Built-in vector search with filtering (no separate Pinecone/Weaviate needed)
- Full-text search index as fallback
- Serverless mutations/actions = no server to manage
- Free tier is generous for this use case

### Cross-Script Search Problem

The biggest challenge: users type in Roman Urdu (`"wuzu ke faraiz"`) but books are in Urdu script (`وضو کے فرائض`). Our solution:
1. **Query enrichment** — Append Urdu-script equivalents before embedding
2. **Term expansion** — Map 60+ fiqh terms bidirectionally
3. **Keyword reranking** — Distinguish similar-sounding terms (faraiz ≠ fazail)

### Safety in Answer Generation

Since this is a religious resource:
- Gemini is locked to source passages only (no hallucinated rulings)
- Violent/hadd punishment content is filtered
- Sensitive topics redirect to "consult a local mufti"
- Every answer includes a disclaimer
- Language-specific system prompts prevent script drift

---

## Contributing

1. **Fiqh accuracy is paramount.** Do not change rulings without explicit instruction. All answers must be Hanafi school.
2. **Always cite classical texts** — Bahar-e-Shariat, Nurul Idah, Al-Hidayah, Radd al-Muhtar, etc.
3. **All user-facing text must have 3 languages** (Roman Urdu, English, Urdu script).
4. **Keep files modular** — See `AGENTS.md` for strict file size limits and organization rules.
5. **No external images** — Decorative elements must be CSS-only.
6. **Tone:** Respectful, clear, gentle.

See [`AGENTS.md`](./AGENTS.md) for detailed development guidelines, component patterns, and code style rules.

---

## License

This project contains copyrighted Islamic texts used for educational and religious purposes. The source PDFs in `resources/` are property of their respective publishers. The code is provided as-is for personal and educational use.

---

<p align="center">
  <em>اللَّهُمَّ انْفَعْنَا بِمَا عَلَّمْتَنَا وَعَلِّمْنَا مَا يَنْفَعُنَا</em>
  <br>
  <sub>O Allah, benefit us from what You have taught us, and teach us what will benefit us.</sub>
</p>

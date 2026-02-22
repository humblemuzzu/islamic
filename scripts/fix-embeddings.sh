#!/usr/bin/env bash
# ============================================================
# FIX EMBEDDINGS: Re-embed all chunks with Gemini instead of Mistral
# ============================================================
#
# This script:
# 1. Backs up old Mistral embeddings
# 2. Clears embedding progress (forces re-embed)
# 3. Re-runs embedding with Gemini text-embedding-004
# 4. Re-uploads to Convex with --reset (clears old 1024-dim data)
#
# Prerequisites:
#   export GEMINI_API_KEY="your-gemini-api-key"
#   export CONVEX_URL="https://your-project.convex.cloud"
#
# Usage:
#   chmod +x scripts/fix-embeddings.sh
#   ./scripts/fix-embeddings.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHUNKS_DIR="$PROJECT_ROOT/chunks"

echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}  FIX EMBEDDINGS: Mistral → Gemini     ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo ""

# ── Load env files ─────────────────────────────────────────
if [ -f "$PROJECT_ROOT/.env.convex.local" ]; then
  echo "Loading environment from .env.convex.local..."
  set -a
  source "$PROJECT_ROOT/.env.convex.local"
  set +a
fi
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  set -a
  source "$PROJECT_ROOT/.env.local" 2>/dev/null || true
  set +a
fi

# ── Check prerequisites ────────────────────────────────────
if [ -z "${GEMINI_API_KEY:-}" ] && [ -z "${GOOGLE_API_KEY:-}" ]; then
  echo -e "${RED}ERROR: GEMINI_API_KEY or GOOGLE_API_KEY must be set${NC}"
  echo "  Add to .env.local or: export GEMINI_API_KEY=\"your-key-here\""
  exit 1
fi

if [ -z "${CONVEX_URL:-}" ]; then
  echo -e "${RED}ERROR: CONVEX_URL must be set${NC}"
  echo "  Add to .env.local or: export CONVEX_URL=\"https://your-project.convex.cloud\""
  exit 1
fi

echo -e "${GREEN}✓ API keys found${NC}"
echo -e "${GREEN}✓ Convex URL: ${CONVEX_URL}${NC}"
echo ""

# ── Step 1: Backup old Mistral embeddings ──────────────────
echo -e "${YELLOW}Step 1: Backing up old Mistral embeddings...${NC}"

if [ -f "$CHUNKS_DIR/embedding-progress.jsonl" ]; then
  cp "$CHUNKS_DIR/embedding-progress.jsonl" "$CHUNKS_DIR/embedding-progress-mistral-backup.jsonl"
  echo "  Backed up to embedding-progress-mistral-backup.jsonl"
fi

if [ -f "$CHUNKS_DIR/all-chunks-embedded.json" ]; then
  cp "$CHUNKS_DIR/all-chunks-embedded.json" "$CHUNKS_DIR/all-chunks-embedded-mistral-backup.json"
  echo "  Backed up to all-chunks-embedded-mistral-backup.json"
fi

if [ -f "$CHUNKS_DIR/all-chunks-embedded.jsonl" ]; then
  cp "$CHUNKS_DIR/all-chunks-embedded.jsonl" "$CHUNKS_DIR/all-chunks-embedded-mistral-backup.jsonl"
  echo "  Backed up to all-chunks-embedded-mistral-backup.jsonl"
fi

echo -e "${GREEN}✓ Backups created${NC}"
echo ""

# ── Step 2: Clear old embedding progress ───────────────────
echo -e "${YELLOW}Step 2: Clearing old Mistral embedding progress...${NC}"

rm -f "$CHUNKS_DIR/embedding-progress.jsonl"
rm -f "$CHUNKS_DIR/all-chunks-embedded.json"
rm -f "$CHUNKS_DIR/all-chunks-embedded.jsonl"

echo -e "${GREEN}✓ Old embeddings cleared${NC}"
echo ""

# ── Step 3: Re-embed with Gemini ───────────────────────────
echo -e "${YELLOW}Step 3: Re-embedding 10,490 chunks with Gemini text-embedding-004...${NC}"
echo "  This will take ~5-15 minutes depending on rate limits."
echo ""

cd "$PROJECT_ROOT/scripts/ocr"

# Activate venv if it exists
if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
fi

# Run the chunking/embedding pipeline (it reads all-chunks.json, re-embeds, saves)
python3 -c "
import sys
sys.path.insert(0, '.')
sys.path.insert(0, '../chunking')

from pathlib import Path
from config import ChunkingConfig
from embedding import embed_chunks
import json
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('re-embed')

project_root = Path('$PROJECT_ROOT')
config = ChunkingConfig(
    project_root=project_root,
    extracted_dir=project_root / 'extracted',
    chunks_dir=project_root / 'chunks',
    state_path=project_root / 'chunks' / 'state.json',
    embedding_provider='gemini',
    embedding_model='text-embedding-004',
    embed_task_type='RETRIEVAL_DOCUMENT',
    embedding_batch_size=20,
)

logger.info('Loading chunks from all-chunks.json...')
with open(config.all_chunks_path(), 'r') as f:
    chunks = json.load(f)

# Remove old embeddings from chunks
for c in chunks:
    c.pop('embedding', None)

logger.info(f'Loaded {len(chunks)} chunks. Starting Gemini embedding...')
embedded_chunks, report = embed_chunks(chunks, config, logger)

logger.info('Saving embedded chunks...')

# Save JSON
with open(config.embedded_chunks_path(), 'w') as f:
    json.dump(embedded_chunks, f, ensure_ascii=False)

# Save JSONL
with open(config.embedded_chunks_jsonl_path(), 'w') as f:
    for chunk in embedded_chunks:
        f.write(json.dumps(chunk, ensure_ascii=False) + '\n')

# Update report
report_path = config.report_path()
if report_path.exists():
    with open(report_path, 'r') as f:
        existing_report = json.load(f)
    existing_report['embedding'] = report
    with open(report_path, 'w') as f:
        json.dump(existing_report, f, ensure_ascii=False, indent=2)

logger.info(f'Done! Embedding report: {report}')
logger.info(f'Saved to: {config.embedded_chunks_path()}')
"

if [ $? -ne 0 ]; then
  echo -e "${RED}ERROR: Gemini embedding failed!${NC}"
  echo "Check your GEMINI_API_KEY and try again."
  exit 1
fi

echo ""
echo -e "${GREEN}✓ All chunks re-embedded with Gemini${NC}"
echo ""

# ── Step 4: Clear old chunks + Deploy updated Convex schema ─
echo -e "${YELLOW}Step 4: Clearing old 1024-dim chunks from Convex...${NC}"
echo "  (Vector index dimension change requires clearing data first)"

cd "$PROJECT_ROOT"

# Clear old chunks before schema change (dimension 1024 → 768 can't coexist)
npx convex run chunks:clearChunks 2>&1 || echo "  (clearChunks may have already been empty)"

echo -e "${GREEN}✓ Old chunks cleared${NC}"
echo ""

echo -e "${YELLOW}Deploying updated Convex schema (768 dims)...${NC}"
npx convex deploy 2>&1 || {
  echo -e "${RED}Schema deploy failed. Try manually:${NC}"
  echo "  npx convex deploy"
  exit 1
}

echo -e "${GREEN}✓ Convex schema deployed${NC}"
echo ""

# ── Step 5: Re-upload to Convex ────────────────────────────
echo -e "${YELLOW}Step 5: Re-uploading chunks to Convex (reset + fresh)...${NC}"

cd "$PROJECT_ROOT"
npx tsx scripts/convex/upload-chunks.ts \
  --file chunks/all-chunks-embedded.jsonl \
  --report chunks/chunking-report.json \
  --provider gemini \
  --model text-embedding-004 \
  --dimensions 768 \
  --reset \
  --batch 30

echo ""
echo -e "${GREEN}✓ All chunks uploaded to Convex${NC}"
echo ""

# ── Done ───────────────────────────────────────────────────
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ FIX COMPLETE!                      ${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "Changes made:"
echo "  1. Convex schema: vector index 1024 → 768 dimensions"
echo "  2. Embeddings: Mistral Embed → Gemini text-embedding-004"
echo "  3. Task type: RETRIEVAL_DOCUMENT for chunks, RETRIEVAL_QUERY for queries"
echo "  4. Relevance threshold: 0.45 → 0.52 minimum"
echo "  5. Query expansion: better Roman Urdu → Urdu script mapping"
echo "  6. Keyword reranking: distinguishes faraiz/fazail/sunnat etc."
echo ""
echo "Test it:"
echo "  npm run dev"
echo "  → Go to /kitab and search: 'wuzu ke faraiz'"
echo "  → Should now return فرائض وضو content, NOT فضائل وضو"

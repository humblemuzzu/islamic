# Phase 2: Chunking + Embeddings

## Setup

```bash
cd scripts/chunking
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
# Default provider tries Gemini first; if GEMINI key is missing and MISTRAL key exists,
# it automatically falls back to Mistral embeddings.
python run-phase2.py --fresh
```

## Explicit provider

```bash
# Gemini (requires GEMINI_API_KEY or GOOGLE_API_KEY)
python run-phase2.py --provider gemini

# Mistral (requires MISTRAL_API_KEY)
python run-phase2.py --provider mistral
```

## Outputs

- `chunks/all-chunks.json`
- `chunks/embedding-progress.jsonl`
- `chunks/all-chunks-embedded.json`
- `chunks/all-chunks-embedded.jsonl`
- `chunks/chunking-report.json`
- `chunks/state.json`
- `phase2_run.log`

## Resume behavior

The pipeline is resumable:

- Reuses `all-chunks.json` if already built
- Reuses `embedding-progress.jsonl` to skip completed chunk embeddings
- Safe to rerun after interruptions

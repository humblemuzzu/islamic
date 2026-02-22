# OCR Pipeline (Mistral Batch)

## 1) Setup

```bash
cd scripts/ocr
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2) Set API key

```bash
export MISTRAL_API_KEY="<your-key>"
```

## 3) Start full OCR run

```bash
python run-ocr.py
```

## 4) Submit only (do not wait)

```bash
python run-ocr.py --submit-only
```

## 5) Clean rerun (recommended after splitter changes)

```bash
python run-ocr.py --fresh --submit-only
```

## Important output paths

- `ocr_run.log`
- `ocr_artifacts/state.json`
- `ocr_artifacts/batch/batch_input.jsonl`
- `ocr_artifacts/results/batch_output_raw.jsonl`
- `ocr_artifacts/results/batch_error_raw.jsonl` (if any)
- `extracted/**/_ocr.md`
- `extracted/**/_ocr.json`
- `extracted/_manifest.json`

## Free-trial note

If Mistral returns `402 Payment Required` while creating batch jobs, your account cannot submit batch jobs on free trial. The script now auto-falls back to direct OCR calls and still completes extraction safely.

- To enforce batch-only behavior, run with `--no-direct-fallback`.
- To use true batch mode later, add billing in the Mistral console and rerun.

## Resume behavior

The script is resumable:

- Reuses existing split chunks if they still exist
- Reuses already uploaded files + signed URLs from `state.json`
- Reuses existing submitted batch job ID
- Continues polling/downloading/parsing from saved state

If you need a clean rerun, delete:

- `ocr_artifacts/state.json`
- `ocr_artifacts/batch/batch_input.jsonl`
- `ocr_artifacts/results/*`
- `pdf_chunks/*`

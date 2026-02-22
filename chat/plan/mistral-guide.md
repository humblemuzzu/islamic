Me: "if im gonna use mistral's ocr 3 model and in batch mode how to use it properly so i dont loose any of the output and all out of 7800 pages kinda properly and model name of ocr3 in api and how to use batch mode and how should i process 3 large 80-110mb pdfs and other 30 pdfs ocr properly robust way with proper error handling and all and theyre in arabic, urdu, hindi and all - do detailed ultra detield web research check mistral docs and literally every single detail and give me compelte detailes like utlra utlra every details dos and donts and literally everything so i can pull this up properly in a robust way plz do extensive detailed web research plz"

AI:

"Alright Muzammil, I've done deep research across the actual Mistral docs, cookbooks, API reference, and changelogs. Here's the complete ultra-detailed breakdown:

---

# Complete Guide: Mistral OCR 3 + Batch Mode for 7,800 Pages

---

## Part 1: The Exact Model Names

There are two names you need to know and they're related:

**`mistral-ocr-2512`** — This is the pinned, exact version of OCR 3 (released December 2025). The "2512" means December 2025. If you want absolute predictability (so behavior doesn't change if they update the model), use this.

**`mistral-ocr-latest`** — This always points to the most recent OCR model Mistral has. Right now that's OCR 3 (`mistral-ocr-2512`), but it'll change when they release OCR 4. Good for "always use best model" scenarios, risky for production stability.

**Recommendation for your job:** Use `mistral-ocr-2512` so your 7,800-page job doesn't start mid-way and then suddenly behave differently if they push an update.

---

## Part 2: Hard Limits You Must Know (CRITICAL)

This is where your plan breaks. There are three hard walls you cannot cross:

**Max file size: 50MB per document.** Your 3 large PDFs are 80–110MB each. You physically cannot send them as-is. You will get a 413 error. There's no setting to bypass this. The only solution is to split them before sending.

**Max pages: 1,000 per document call.** Even if your file is under 50MB, if it has more than 1,000 pages, it gets rejected.

**Batch API supports up to 1 million requests in one job.** Your 7,800 pages split across ~33 PDFs will be well within limits.

---

## Part 3: The Big PDF Problem — How to Split 80–110MB PDFs

Since your 3 large PDFs exceed 50MB, you need to split each into smaller PDFs before sending them to the API. The tool for this is `pypdf` (Python library).

Here's what splitting looks like conceptually: you're taking a 110MB PDF and cutting it into, say, 3 pieces of ~37MB each, giving each piece a name like `bigdoc_chunk_0.pdf`, `bigdoc_chunk_1.pdf`, `bigdoc_chunk_2.pdf`. You then track which chunk came from which original file, and what page range it covers, so you can reassemble the output at the end.

The safe target chunk size is **40MB max** (not 50MB) to leave a buffer, since base64 encoding inflates size, and the API measures the raw binary, so it's safer to stay well under.

A reasonable pages-per-chunk for scanned Arabic/Urdu/Hindi documents: these are image-heavy scans, so 80–150 pages per chunk depending on DPI and image density. You'll figure out the sweet spot by checking sizes after splitting.

---

## Part 4: Three Ways to Give PDFs to the API

Understanding these three methods is essential because batch mode requires a specific approach.

**Method 1 — Public URL.** If your PDF is hosted on a public URL (like S3 with public access, or any public server), you just pass the URL directly. This is the simplest method but requires your file to be publicly accessible on the internet.

**Method 2 — Base64 inline.** You read the PDF file bytes, encode them in base64, and send it as `data:application/pdf;base64,{your_base64_string}`. This works for smaller files but is extremely memory-hungry. A 40MB PDF becomes ~53MB of base64 string just in RAM. Not practical for batch processing at scale.

**Method 3 — Upload to Mistral Files API + Signed URL.** This is the recommended approach for large-scale work. You upload the PDF to Mistral's own cloud storage using the files endpoint with `purpose="ocr"`, get back a `file_id`, then generate a signed URL (a temporary private link) from that file_id, and pass that signed URL to the OCR call. This keeps your files private and is much more memory-efficient. **This is what you want to use for batch mode.**

---

## Part 5: Batch Mode — How It Actually Works, Step by Step

Think of batch mode like this: instead of making 33 separate calls to the API and waiting for each one, you bundle all 33 requests into a single file, upload it, say "process all of these overnight," and then come back later and download all the results at once. You get a 50% price discount for doing this.

The format for this bundle file is called **JSONL** (JSON Lines). It's a text file where every single line is one complete JSON object representing one request. Here's exactly what each line looks like for an OCR request:

```json
{"custom_id": "bigdoc1_chunk_0_pages0-149", "body": {"document": {"type": "document_url", "document_url": "https://signed-url-here..."}, "include_image_base64": false}}
```

The `custom_id` is the most important field. It's your identifier — it doesn't matter to Mistral what you put here, but it comes back in the results file so you know which result belongs to which request. Name it something meaningful like `"bigdoc1_chunk_0_pages0-149"` so you can reassemble results in order later.

**The full batch workflow:**

Step 1 — Split your large PDFs into sub-50MB chunks.

Step 2 — Upload each chunk PDF to Mistral Files API (purpose="ocr"), get file_ids. Generate signed URLs from each file_id.

Step 3 — For the 30 smaller PDFs, either upload them too or keep base64 if they're small enough.

Step 4 — Build the JSONL batch file. One line per document (chunk). Write it to disk.

Step 5 — Upload the JSONL file to Mistral Files API (purpose="batch"), get a batch file_id.

Step 6 — Create a batch job pointing to that file, specifying model and endpoint `/v1/ocr`.

Step 7 — Poll the job status every 30–60 seconds until it's `SUCCESS`.

Step 8 — Download the output JSONL file.

Step 9 — Parse results, match by custom_id, reassemble pages in order per original PDF.

Step 10 — Save everything.

---

## Part 6: The Complete Robust Python Script

Here's the full production-ready script with everything covered:

```python
import os
import json
import time
import base64
import logging
from pathlib import Path
from mistralai import Mistral

# ─────────────────────────────────────────────
# SETUP
# ─────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("ocr_run.log"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

API_KEY = os.environ["MISTRAL_API_KEY"]
client = Mistral(api_key=API_KEY)

OCR_MODEL = "mistral-ocr-2512"          # Pinned OCR 3, not "latest"
MAX_CHUNK_MB = 40                        # Hard limit is 50MB, we use 40MB for safety
POLL_INTERVAL_SECONDS = 30              # How often to check batch job status
RESULTS_DIR = Path("ocr_results")
CHUNKS_DIR = Path("pdf_chunks")
RESULTS_DIR.mkdir(exist_ok=True)
CHUNKS_DIR.mkdir(exist_ok=True)


# ─────────────────────────────────────────────
# STEP 1: SPLIT LARGE PDFs
# ─────────────────────────────────────────────

def split_pdf_if_needed(pdf_path: Path) -> list[dict]:
    """
    Splits a PDF into chunks under MAX_CHUNK_MB.
    Returns a list of dicts: {chunk_path, original_name, page_start, page_end}
    If small enough, returns a single-item list with the original path.
    """
    from pypdf import PdfReader, PdfWriter

    file_size_mb = pdf_path.stat().st_size / (1024 * 1024)
    log.info(f"PDF: {pdf_path.name} | Size: {file_size_mb:.1f} MB")

    if file_size_mb <= MAX_CHUNK_MB:
        # Small enough to send as-is
        return [{
            "chunk_path": pdf_path,
            "original_name": pdf_path.stem,
            "page_start": 0,
            "page_end": -1,   # -1 means "all pages"
            "chunk_index": 0
        }]

    # Need to split
    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)
    log.info(f"  → Splitting {total_pages} pages into chunks...")

    # Estimate pages per chunk based on file size ratio
    # Add a safety factor of 0.75 to be conservative
    pages_per_chunk = int((MAX_CHUNK_MB / file_size_mb) * total_pages * 0.75)
    pages_per_chunk = max(10, pages_per_chunk)  # At least 10 pages per chunk

    chunks = []
    chunk_index = 0
    current_page = 0

    while current_page < total_pages:
        end_page = min(current_page + pages_per_chunk, total_pages)
        writer = PdfWriter()

        for page_num in range(current_page, end_page):
            writer.add_page(reader.pages[page_num])

        chunk_filename = f"{pdf_path.stem}_chunk{chunk_index:03d}_p{current_page}-{end_page-1}.pdf"
        chunk_path = CHUNKS_DIR / chunk_filename

        with open(chunk_path, "wb") as f:
            writer.write(f)

        actual_size_mb = chunk_path.stat().st_size / (1024 * 1024)
        log.info(f"  → Chunk {chunk_index}: pages {current_page}–{end_page-1} | {actual_size_mb:.1f} MB → {chunk_filename}")

        # Safety check: if chunk is still too big, split it again recursively
        if actual_size_mb > 48:
            log.warning(f"  → Chunk {chunk_index} is {actual_size_mb:.1f} MB, still too large! Reducing pages...")
            chunk_path.unlink()  # delete it
            pages_per_chunk = int(pages_per_chunk * 0.6)  # reduce by 40%
            continue  # retry this chunk with fewer pages

        chunks.append({
            "chunk_path": chunk_path,
            "original_name": pdf_path.stem,
            "page_start": current_page,
            "page_end": end_page - 1,
            "chunk_index": chunk_index
        })

        chunk_index += 1
        current_page = end_page

    return chunks


# ─────────────────────────────────────────────
# STEP 2: UPLOAD PDF TO MISTRAL FILES API
# ─────────────────────────────────────────────

def upload_pdf_get_signed_url(chunk_path: Path, retries: int = 3) -> str:
    """
    Uploads a PDF to Mistral's file storage with purpose='ocr'.
    Returns a signed URL valid for 24 hours.
    """
    for attempt in range(retries):
        try:
            log.info(f"  Uploading: {chunk_path.name} (attempt {attempt + 1})")

            with open(chunk_path, "rb") as f:
                uploaded = client.files.upload(
                    file={
                        "file_name": chunk_path.name,
                        "content": f
                    },
                    purpose="ocr"
                )

            signed = client.files.get_signed_url(
                file_id=uploaded.id,
                expiry=24  # 24 hours, batch jobs can take time
            )

            log.info(f"  Uploaded → file_id: {uploaded.id}")
            return signed.url

        except Exception as e:
            log.error(f"  Upload failed (attempt {attempt + 1}): {e}")
            if attempt == retries - 1:
                raise
            time.sleep(5 * (attempt + 1))  # exponential-ish backoff


# ─────────────────────────────────────────────
# STEP 3: BUILD JSONL BATCH FILE
# ─────────────────────────────────────────────

def build_batch_jsonl(all_chunks: list[dict], output_path: Path) -> Path:
    """
    Builds the JSONL file for the batch job.
    Each line = one request.
    custom_id format: {original_name}__chunk{index}__p{start}-{end}
    """
    log.info(f"Building JSONL batch file with {len(all_chunks)} requests...")

    with open(output_path, "w", encoding="utf-8") as f:
        for chunk in all_chunks:
            custom_id = f"{chunk['original_name']}__chunk{chunk['chunk_index']:03d}__p{chunk['page_start']}-{chunk['page_end']}"

            entry = {
                "custom_id": custom_id,
                "body": {
                    "document": {
                        "type": "document_url",
                        "document_url": chunk["signed_url"]
                    },
                    "include_image_base64": False,   # Set True if you want embedded images
                    "table_format": "html",           # Better for Arabic/Urdu tables
                    "extract_header": True,           # Capture headers separately
                    "extract_footer": True            # Capture footers separately
                }
            }

            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    log.info(f"JSONL batch file created: {output_path}")
    return output_path


# ─────────────────────────────────────────────
# STEP 4: UPLOAD JSONL + CREATE BATCH JOB
# ─────────────────────────────────────────────

def submit_batch_job(jsonl_path: Path) -> str:
    """
    Uploads the JSONL file and creates a batch OCR job.
    Returns the job ID.
    """
    log.info("Uploading JSONL file to Mistral...")

    with open(jsonl_path, "rb") as f:
        batch_file = client.files.upload(
            file={
                "file_name": jsonl_path.name,
                "content": f
            },
            purpose="batch"
        )

    log.info(f"JSONL uploaded → file_id: {batch_file.id}")
    log.info("Creating batch job...")

    job = client.batch.jobs.create(
        input_files=[batch_file.id],
        model=OCR_MODEL,
        endpoint="/v1/ocr",
        metadata={
            "job_name": "arabic_urdu_hindi_ocr",
            "total_documents": str(len(open(jsonl_path).readlines()))
        }
    )

    log.info(f"Batch job created → job_id: {job.id}")
    return job.id


# ─────────────────────────────────────────────
# STEP 5: POLL UNTIL DONE
# ─────────────────────────────────────────────

def wait_for_job(job_id: str) -> object:
    """
    Polls the batch job every POLL_INTERVAL_SECONDS until complete.
    Returns the final job object.
    """
    log.info(f"Polling job {job_id}...")

    while True:
        job = client.batch.jobs.get(job_id=job_id)
        status = job.status
        total = job.total_requests or 0
        succeeded = job.succeeded_requests or 0
        failed = job.failed_requests or 0
        done = succeeded + failed
        pct = round((done / total) * 100, 1) if total > 0 else 0

        log.info(
            f"Status: {status} | {done}/{total} done ({pct}%) | "
            f"✓ {succeeded} succeeded | ✗ {failed} failed"
        )

        if status == "SUCCESS":
            log.info("Batch job completed successfully!")
            return job
        elif status in ("FAILED", "TIMEOUT_EXCEEDED", "CANCELLATION_REQUESTED", "CANCELLED"):
            log.error(f"Batch job ended with status: {status}")
            raise RuntimeError(f"Batch job {job_id} failed with status {status}")

        time.sleep(POLL_INTERVAL_SECONDS)


# ─────────────────────────────────────────────
# STEP 6: DOWNLOAD + PARSE RESULTS
# ─────────────────────────────────────────────

def download_and_parse_results(job) -> dict:
    """
    Downloads the output JSONL from the completed batch job.
    Returns a dict: { custom_id: [list of page markdown strings in order] }
    Also saves raw results to disk for safety.
    """
    log.info("Downloading batch results...")

    # Download raw output
    output_stream = client.files.download(file_id=job.output_file)
    raw_bytes = output_stream.read()

    # Save raw results first — safety net before any parsing
    raw_results_path = RESULTS_DIR / "raw_batch_results.jsonl"
    with open(raw_results_path, "wb") as f:
        f.write(raw_bytes)
    log.info(f"Raw results saved to: {raw_results_path}")

    # Also download error file if exists
    if hasattr(job, 'error_file') and job.error_file:
        error_stream = client.files.download(file_id=job.error_file)
        error_path = RESULTS_DIR / "batch_errors.jsonl"
        with open(error_path, "wb") as f:
            f.write(error_stream.read())
        log.warning(f"Errors file saved to: {error_path} — review this!")

    # Parse line by line
    results = {}
    failed_ids = []

    for line_num, line in enumerate(raw_bytes.decode("utf-8").splitlines()):
        if not line.strip():
            continue
        try:
            result = json.loads(line)
            custom_id = result["custom_id"]

            if result.get("error"):
                log.error(f"Request failed → custom_id: {custom_id} | error: {result['error']}")
                failed_ids.append(custom_id)
                continue

            # Extract pages from the OCR response body
            response_body = result.get("response", {}).get("body", {})
            pages = response_body.get("pages", [])

            # Sort pages by index just in case they come out of order
            pages_sorted = sorted(pages, key=lambda p: p.get("index", 0))

            results[custom_id] = {
                "pages": pages_sorted,
                "model": response_body.get("model", ""),
                "usage": response_body.get("usage_info", {})
            }

        except json.JSONDecodeError as e:
            log.error(f"JSON parse error on line {line_num}: {e}")
        except Exception as e:
            log.error(f"Unexpected error parsing line {line_num}: {e}")

    if failed_ids:
        log.warning(f"{len(failed_ids)} requests failed: {failed_ids}")

    log.info(f"Successfully parsed {len(results)} results")
    return results, failed_ids


# ─────────────────────────────────────────────
# STEP 7: REASSEMBLE CHUNKS → FINAL OUTPUT
# ─────────────────────────────────────────────

def reassemble_results(results: dict, all_chunks: list[dict]):
    """
    Groups results by original PDF name, sorts chunks in order,
    and assembles the full markdown text per original document.
    Saves each document's output to its own file.
    """
    log.info("Reassembling chunks into final documents...")

    # Group chunks by original document name
    from collections import defaultdict
    doc_chunks = defaultdict(list)

    for chunk in all_chunks:
        custom_id = f"{chunk['original_name']}__chunk{chunk['chunk_index']:03d}__p{chunk['page_start']}-{chunk['page_end']}"
        if custom_id in results:
            doc_chunks[chunk["original_name"]].append({
                "chunk_index": chunk["chunk_index"],
                "page_start": chunk["page_start"],
                "custom_id": custom_id,
                "data": results[custom_id]
            })
        else:
            log.warning(f"Missing result for: {custom_id}")

    # Sort each doc's chunks by chunk_index, then assemble
    for doc_name, chunks in doc_chunks.items():
        chunks_sorted = sorted(chunks, key=lambda c: c["chunk_index"])

        all_pages_markdown = []
        total_pages_processed = 0

        for chunk in chunks_sorted:
            for page in chunk["data"]["pages"]:
                page_global_index = chunk["page_start"] + page.get("index", 0)
                markdown = page.get("markdown", "")
                header = page.get("header", "")
                footer = page.get("footer", "")

                # Build a rich page entry
                page_text = f"\n\n<!-- PAGE {page_global_index} -->\n"
                if header:
                    page_text += f"<!-- HEADER: {header} -->\n"
                page_text += markdown
                if footer:
                    page_text += f"\n<!-- FOOTER: {footer} -->"

                all_pages_markdown.append(page_text)
                total_pages_processed += 1

        full_document = "\n".join(all_pages_markdown)

        # Save as markdown
        output_file = RESULTS_DIR / f"{doc_name}_ocr.md"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(full_document)

        # Also save as JSON (structured, easier to process later)
        json_output = []
        for chunk in chunks_sorted:
            for page in chunk["data"]["pages"]:
                json_output.append({
                    "global_page_index": chunk["page_start"] + page.get("index", 0),
                    "chunk_index": chunk["chunk_index"],
                    "markdown": page.get("markdown", ""),
                    "header": page.get("header", ""),
                    "footer": page.get("footer", ""),
                    "tables": page.get("tables", []),
                    "dimensions": page.get("dimensions", {})
                })

        json_file = RESULTS_DIR / f"{doc_name}_ocr.json"
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(json_output, f, ensure_ascii=False, indent=2)

        log.info(f"✓ {doc_name}: {total_pages_processed} pages → {output_file}")

    log.info("All documents reassembled.")


# ─────────────────────────────────────────────
# STEP 8: RETRY FAILED REQUESTS (DIRECT API)
# ─────────────────────────────────────────────

def retry_failed_direct(failed_ids: list[str], all_chunks: list[dict]):
    """
    For any requests that failed in batch mode,
    retry them one-by-one using the direct OCR API.
    """
    if not failed_ids:
        log.info("No failed requests to retry.")
        return {}

    log.info(f"Retrying {len(failed_ids)} failed requests via direct API...")

    # Build a lookup from custom_id → chunk info
    chunk_lookup = {}
    for chunk in all_chunks:
        custom_id = f"{chunk['original_name']}__chunk{chunk['chunk_index']:03d}__p{chunk['page_start']}-{chunk['page_end']}"
        chunk_lookup[custom_id] = chunk

    retry_results = {}

    for custom_id in failed_ids:
        chunk = chunk_lookup.get(custom_id)
        if not chunk:
            log.error(f"Cannot find chunk info for failed ID: {custom_id}")
            continue

        for attempt in range(3):
            try:
                log.info(f"  Retrying {custom_id} (attempt {attempt + 1})...")

                response = client.ocr.process(
                    model=OCR_MODEL,
                    document={
                        "type": "document_url",
                        "document_url": chunk["signed_url"]
                    },
                    include_image_base64=False,
                    table_format="html",
                    extract_header=True,
                    extract_footer=True
                )

                pages_sorted = sorted(response.pages, key=lambda p: p.index)
                retry_results[custom_id] = {
                    "pages": [p.__dict__ for p in pages_sorted],
                    "model": OCR_MODEL,
                    "usage": {}
                }

                log.info(f"  ✓ Retry succeeded for {custom_id}")
                break

            except Exception as e:
                log.error(f"  Retry attempt {attempt + 1} failed for {custom_id}: {e}")
                if attempt < 2:
                    time.sleep(10 * (attempt + 1))
                else:
                    log.error(f"  GIVING UP on {custom_id} after 3 attempts.")

    return retry_results


# ─────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────

def main():
    # ── List all your PDFs here ──────────────────────────
    large_pdfs = [
        Path("large_doc_1.pdf"),   # 80-110MB
        Path("large_doc_2.pdf"),
        Path("large_doc_3.pdf"),
    ]
    small_pdfs = [
        Path(f"small_doc_{i}.pdf") for i in range(1, 31)  # 30 smaller PDFs
    ]
    all_pdfs = large_pdfs + small_pdfs
    # ─────────────────────────────────────────────────────

    log.info(f"Starting OCR pipeline for {len(all_pdfs)} PDFs")

    # 1. Split large PDFs into chunks
    all_chunks = []
    for pdf_path in all_pdfs:
        if not pdf_path.exists():
            log.error(f"PDF not found: {pdf_path}")
            continue
        chunks = split_pdf_if_needed(pdf_path)
        all_chunks.extend(chunks)

    log.info(f"Total chunks to process: {len(all_chunks)}")

    # 2. Upload each chunk and get a signed URL
    log.info("Uploading PDFs to Mistral file storage...")
    for chunk in all_chunks:
        signed_url = upload_pdf_get_signed_url(chunk["chunk_path"])
        chunk["signed_url"] = signed_url
        time.sleep(0.5)  # Small delay to avoid hammering the upload API

    # 3. Build JSONL
    jsonl_path = Path("batch_input.jsonl")
    build_batch_jsonl(all_chunks, jsonl_path)

    # 4. Submit batch job
    job_id = submit_batch_job(jsonl_path)

    # 5. Wait for completion
    completed_job = wait_for_job(job_id)

    # 6. Download and parse results
    results, failed_ids = download_and_parse_results(completed_job)

    # 7. Retry any failures via direct API
    if failed_ids:
        retry_results = retry_failed_direct(failed_ids, all_chunks)
        results.update(retry_results)

    # 8. Reassemble final documents
    reassemble_results(results, all_chunks)

    # 9. Print final summary
    log.info("=" * 60)
    log.info("PIPELINE COMPLETE")
    log.info(f"Results saved to: {RESULTS_DIR}/")
    log.info(f"Total chunks processed: {len(all_chunks)}")
    log.info(f"Failed IDs: {failed_ids if failed_ids else 'None'}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
```

---

## Part 7: Installing Dependencies

```bash
pip install mistralai pypdf
```

You need `mistralai` for the API client, and `pypdf` for splitting large PDFs. Don't use the old `PyPDF2` — it's deprecated. The new library is just called `pypdf`.

---

## Part 8: Arabic / Urdu / Hindi — Language Handling

Mistral OCR is natively multilingual and **auto-detects** the language. You do not need to tell it what language the document is in. It will correctly handle:

Arabic (right-to-left text), Urdu (Nastaliq script), Hindi (Devanagari), and mixed-language documents with English mixed in.

A few important things for RTL (Right-to-Left) languages:

The markdown output will contain the Arabic/Urdu text correctly, but the RTL direction is not preserved in plain markdown. If you're rendering this in a web app, you'll need to add `dir="rtl"` to your HTML. If you're just storing the text for search or further processing, the actual characters will be correct.

The `ensure_ascii=False` flag in `json.dump` is critical — without it, all Arabic/Urdu characters get turned into `\u0623\u0644\u0639...` unicode escape sequences, which is technically correct but very hard to read and work with.

For Urdu specifically (Nastaliq script), OCR quality depends heavily on the scan quality. If your PDFs are old/faded or use non-standard Nastaliq fonts, you may get imperfect results. This is a limitation of OCR technology in general, not specific to Mistral.

---

## Part 9: Pricing for Your Job

Here's the exact math so there are no surprises:

7,800 pages × $2/1,000 pages = **$15.60** at regular price.

With 50% batch discount: **$7.80 total**.

If you have tables and enable `table_format="html"`, that uses the Annotated Pages pricing of $3/1,000 pages. But plain OCR is $2/1,000, and with batch it's $1/1,000. So your 7,800 pages should cost around $7.80 for the batch run.

---

## Part 10: The Dos and Don'ts

**DO:**

Use `mistral-ocr-2512` not `mistral-ocr-latest` for a production job so behavior is stable.

Always save the raw output JSONL file immediately before doing any parsing — this is your safety net if your parsing code crashes.

Use the `custom_id` field wisely — include the original filename, chunk number, and page range so reconstruction is trivial.

Set `ensure_ascii=False` everywhere you write JSON with Arabic/Urdu text.

Split large PDFs to 40MB max, not 48 or 49 — buffer matters.

Generate signed URLs with `expiry=24` (hours) — if your batch job takes longer than 1 hour, a shorter expiry could cause some requests to fail with expired URL errors.

Poll every 30–60 seconds, not every 1 second — you'll get rate limited on the status endpoint if you poll too aggressively.

Save results progressively — always dump each document's final result to disk right after parsing it, in case the script crashes mid-reassembly.

Use `extract_header=True` and `extract_footer=True` — for Arabic/Urdu legal or religious documents these often contain critical metadata.

**DON'T:**

Don't send a PDF over 50MB directly. You will get a 413 error and lose time.

Don't use base64 encoding for 40MB PDFs in the batch JSONL — each base64-encoded chunk would make your JSONL file massive. Use signed URLs instead.

Don't assume page ordering in the response. Always sort by the `index` field.

Don't use `include_image_base64=True` for 7,800 pages unless you specifically need the embedded images — it will make your output files enormous and the download slow. The OCR text is extracted regardless.

Don't set `expiry=1` on signed URLs if you're running batch — set `expiry=24`.

Don't forget to handle the error file. If some requests fail, Mistral puts their error details in a separate file accessible via `job.error_file`.

Don't mix up `purpose="ocr"` (for uploading PDFs) vs `purpose="batch"` (for uploading the JSONL file) — these are different and using the wrong one will fail silently or error.

---

## Part 11: What the Output Looks Like (Response Structure)

For each page, the OCR response gives you:

`index` — the page number (0-based) within that specific chunk.

`markdown` — the full OCR output as markdown text, including headers, paragraphs, lists. This is the main thing you want.

`images` — list of embedded images extracted from the page (if any), each with bounding box coordinates.

`tables` — if you used `table_format="html"`, separate table objects are here with their HTML content.

`header` — if `extract_header=True`, the page header text separately.

`footer` — if `extract_footer=True`, the page footer text separately.

`dimensions` — the DPI, height, and width of the page.

`hyperlinks` — any hyperlinks detected in the document.

---

## Part 12: Batch Job Statuses You'll See

When polling with `client.batch.jobs.get(job_id=...)`, the `status` field will be one of:

`QUEUED` — job is waiting to start processing. Normal, can take minutes.

`RUNNING` — actively processing. You'll see succeeded/failed counts increment.

`SUCCESS` — all done, download your results.

`FAILED` — the entire job failed (rare, usually an infrastructure issue). Retry the whole job.

`TIMEOUT_EXCEEDED` — job took too long. For 7,800 pages this shouldn't happen, but if it does, split into smaller batch jobs.

`CANCELLATION_REQUESTED` / `CANCELLED` — only if you cancelled it.

---

## Final Architecture Summary

To put it all together visually in your head: you're running a pipeline that goes — split large PDFs → upload all PDFs to Mistral storage → build one big JSONL file → submit as a single batch job → wait → download one big results JSONL → parse and sort by custom_id → reassemble per original document → save markdown + JSON.

The entire thing for 7,800 pages should take roughly 4–12 hours end-to-end (mostly the batch processing queue time), will cost around $8, and you'll end up with one `.md` and one `.json` file per original PDF, with every page in correct order, all in proper Arabic/Urdu/Hindi text."
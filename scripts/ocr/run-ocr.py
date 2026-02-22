from __future__ import annotations

import argparse
import json
import logging
import shutil
import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from config import OcrConfig
from ocr_pipeline import OcrPipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Batch OCR pipeline for resources/ PDFs using Mistral OCR"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="Project root path (default: auto-detected)",
    )
    parser.add_argument(
        "--resources-dir",
        type=Path,
        default=Path("resources"),
        help="PDF source directory, relative to project root",
    )
    parser.add_argument(
        "--chunk-dir",
        type=Path,
        default=Path("pdf_chunks"),
        help="Directory for split chunks, relative to project root",
    )
    parser.add_argument(
        "--extracted-dir",
        type=Path,
        default=Path("extracted"),
        help="Directory for OCR outputs, relative to project root",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        default=Path("ocr_artifacts"),
        help="Directory for state, raw batch output, and jsonl input",
    )
    parser.add_argument(
        "--state-file",
        type=Path,
        default=Path("ocr_artifacts/state.json"),
        help="State file path, relative to project root",
    )
    parser.add_argument("--model", default="mistral-ocr-2512")
    parser.add_argument("--max-chunk-mb", type=int, default=40)
    parser.add_argument("--poll-interval", type=int, default=30)
    parser.add_argument(
        "--submit-only",
        action="store_true",
        help="Stop after submitting batch job (do not wait/download)",
    )
    parser.add_argument(
        "--simple-body",
        action="store_true",
        help="Disable table/header/footer extraction fields for max compatibility",
    )
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Delete prior state/chunks/artifacts before starting",
    )
    parser.add_argument(
        "--no-direct-fallback",
        action="store_true",
        help="Fail immediately if batch mode is rejected",
    )
    return parser.parse_args()


def configure_logging(project_root: Path) -> None:
    log_path = project_root / "ocr_run.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )


def resolve_path(project_root: Path, value: Path) -> Path:
    if value.is_absolute():
        return value
    return (project_root / value).resolve()


def main() -> int:
    args = parse_args()
    project_root = args.project_root.resolve()
    configure_logging(project_root)

    resources_dir = resolve_path(project_root, args.resources_dir)
    chunk_dir = resolve_path(project_root, args.chunk_dir)
    extracted_dir = resolve_path(project_root, args.extracted_dir)
    artifacts_dir = resolve_path(project_root, args.artifacts_dir)
    state_path = resolve_path(project_root, args.state_file)
    state_path.parent.mkdir(parents=True, exist_ok=True)

    if not resources_dir.exists():
        raise RuntimeError(f"Resources directory not found: {resources_dir}")

    if args.fresh:
        if chunk_dir.exists():
            shutil.rmtree(chunk_dir)
        if artifacts_dir.exists():
            shutil.rmtree(artifacts_dir)
        if state_path.exists():
            state_path.unlink()
        logging.info("Fresh mode enabled: cleared old chunks/artifacts/state.")

    config = OcrConfig(
        project_root=project_root,
        resources_dir=resources_dir,
        chunk_dir=chunk_dir,
        extracted_dir=extracted_dir,
        artifacts_dir=artifacts_dir,
        state_path=state_path,
        model=args.model,
        max_chunk_mb=args.max_chunk_mb,
        poll_interval_seconds=args.poll_interval,
        table_format=None if args.simple_body else "html",
        extract_header=not args.simple_body,
        extract_footer=not args.simple_body,
        allow_direct_fallback=not args.no_direct_fallback,
    )

    logging.info("Starting OCR pipeline")
    logging.info("Project root: %s", project_root)
    logging.info("Resources dir: %s", resources_dir)
    logging.info("State file: %s", state_path)

    pipeline = OcrPipeline(config)
    result = pipeline.run(submit_only=args.submit_only)

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

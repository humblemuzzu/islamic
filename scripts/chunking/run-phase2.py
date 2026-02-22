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

from config import ChunkingConfig
from pipeline import run_phase2_pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 2: chunking + embeddings")
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
    )
    parser.add_argument(
        "--extracted-dir",
        type=Path,
        default=Path("extracted"),
        help="OCR output directory",
    )
    parser.add_argument(
        "--chunks-dir",
        type=Path,
        default=Path("chunks"),
        help="Output directory for chunking + embedding artifacts",
    )
    parser.add_argument(
        "--state-file",
        type=Path,
        default=Path("chunks/state.json"),
    )
    parser.add_argument("--provider", choices=["gemini", "mistral"], default="gemini")
    parser.add_argument("--embedding-model", default="text-embedding-004")
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--fresh", action="store_true")
    parser.add_argument("--min-words", type=int, default=80)
    parser.add_argument("--target-words", type=int, default=280)
    parser.add_argument("--max-words", type=int, default=500)
    parser.add_argument("--overlap-words", type=int, default=50)
    return parser.parse_args()


def configure_logging(project_root: Path) -> None:
    log_path = project_root / "phase2_run.log"
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

    extracted_dir = resolve_path(project_root, args.extracted_dir)
    chunks_dir = resolve_path(project_root, args.chunks_dir)
    state_path = resolve_path(project_root, args.state_file)

    if not extracted_dir.exists():
        raise RuntimeError(f"Extracted directory not found: {extracted_dir}")

    if args.fresh:
        if chunks_dir.exists():
            shutil.rmtree(chunks_dir)
        if state_path.exists():
            state_path.unlink()
        logging.info("Fresh mode enabled: cleared chunking artifacts.")

    config = ChunkingConfig(
        project_root=project_root,
        extracted_dir=extracted_dir,
        chunks_dir=chunks_dir,
        state_path=state_path,
        min_chunk_words=args.min_words,
        target_chunk_words=args.target_words,
        max_chunk_words=args.max_words,
        overlap_words=args.overlap_words,
        embedding_provider=args.provider,
        embedding_model=args.embedding_model,
        embedding_batch_size=args.batch_size,
    )

    result = run_phase2_pipeline(config)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

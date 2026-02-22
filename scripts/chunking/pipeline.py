from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from chunk_builder import build_chunks_from_extracted, summarize_chunk_quality
from config import ChunkingConfig
from embedding import embed_chunks


def run_phase2_pipeline(config: ChunkingConfig) -> dict[str, Any]:
    logger = logging.getLogger("phase2")
    config.chunks_dir.mkdir(parents=True, exist_ok=True)
    config.state_path.parent.mkdir(parents=True, exist_ok=True)

    state = load_state(config.state_path)

    chunks = maybe_build_chunks(config, state, logger)
    embedded_chunks, embedding_report = embed_chunks(chunks, config, logger)

    write_embedded_outputs(config, embedded_chunks)

    quality = summarize_chunk_quality(chunks)
    report = {
        "generated_at": state.get("updated_at"),
        "source": str(config.extracted_dir),
        "chunk_count": len(chunks),
        "quality": quality,
        "embedding": embedding_report,
    }

    with config.report_path().open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    state["phase2"] = {
        "status": "completed",
        "chunk_count": len(chunks),
        "embedded_count": len(embedded_chunks),
        "report_path": str(config.report_path()),
        "all_chunks_path": str(config.all_chunks_path()),
        "embedded_chunks_path": str(config.embedded_chunks_path()),
    }
    save_state(config.state_path, state)

    logger.info("Phase 2 complete. Chunks=%s Embedded=%s", len(chunks), len(embedded_chunks))

    return {
        "status": "completed",
        "chunk_count": len(chunks),
        "embedded_count": len(embedded_chunks),
        "report": str(config.report_path()),
        "all_chunks": str(config.all_chunks_path()),
        "embedded_chunks": str(config.embedded_chunks_path()),
    }


def maybe_build_chunks(
    config: ChunkingConfig,
    state: dict[str, Any],
    logger: logging.Logger,
) -> list[dict[str, Any]]:
    if config.all_chunks_path().exists():
        logger.info("Reusing existing chunks file: %s", config.all_chunks_path())
        return json.loads(config.all_chunks_path().read_text(encoding="utf-8"))

    chunks, report = build_chunks_from_extracted(
        extracted_dir=config.extracted_dir,
        min_chunk_words=config.min_chunk_words,
        target_chunk_words=config.target_chunk_words,
        max_chunk_words=config.max_chunk_words,
        overlap_words=config.overlap_words,
        logger=logger,
    )

    with config.all_chunks_path().open("w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False)

    state["chunking"] = {
        "status": "completed",
        "chunk_count": len(chunks),
        "report": report,
        "all_chunks_path": str(config.all_chunks_path()),
    }
    save_state(config.state_path, state)
    return chunks


def write_embedded_outputs(config: ChunkingConfig, embedded_chunks: list[dict[str, Any]]) -> None:
    with config.embedded_chunks_path().open("w", encoding="utf-8") as f:
        json.dump(embedded_chunks, f, ensure_ascii=False)

    with config.embedded_chunks_jsonl_path().open("w", encoding="utf-8") as f:
        for chunk in embedded_chunks:
            f.write(json.dumps(chunk, ensure_ascii=False) + "\n")


def load_state(path: Path) -> dict[str, Any]:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"version": 1}


def save_state(path: Path, state: dict[str, Any]) -> None:
    state["updated_at"] = now_iso()
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()

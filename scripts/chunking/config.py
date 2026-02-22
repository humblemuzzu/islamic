from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class ChunkingConfig:
    project_root: Path
    extracted_dir: Path
    chunks_dir: Path
    state_path: Path
    min_chunk_words: int = 80
    target_chunk_words: int = 280
    max_chunk_words: int = 500
    overlap_words: int = 50

    embedding_provider: str = "gemini"  # gemini | mistral
    embedding_model: str = "gemini-embedding-001"
    embedding_batch_size: int = 20
    embedding_retries: int = 5
    embed_task_type: str = "RETRIEVAL_DOCUMENT"

    # Gemini endpoint (REST)
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"

    # Mistral embedding fallback
    mistral_embedding_model: str = "mistral-embed"

    def all_chunks_path(self) -> Path:
        return self.chunks_dir / "all-chunks.json"

    def embedded_chunks_path(self) -> Path:
        return self.chunks_dir / "all-chunks-embedded.json"

    def embedded_chunks_jsonl_path(self) -> Path:
        return self.chunks_dir / "all-chunks-embedded.jsonl"

    def report_path(self) -> Path:
        return self.chunks_dir / "chunking-report.json"

    def embedding_progress_path(self) -> Path:
        return self.chunks_dir / "embedding-progress.jsonl"

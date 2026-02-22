from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class OcrConfig:
    project_root: Path
    resources_dir: Path
    chunk_dir: Path
    extracted_dir: Path
    artifacts_dir: Path
    state_path: Path
    model: str = "mistral-ocr-2512"
    max_chunk_mb: int = 40
    max_request_pages: int = 1000
    max_request_mb: int = 50
    poll_interval_seconds: int = 30
    upload_retries: int = 4
    process_retries: int = 3
    signed_url_expiry_hours: int = 24
    include_image_base64: bool = False
    table_format: str | None = "html"
    extract_header: bool = True
    extract_footer: bool = True
    allow_direct_fallback: bool = True

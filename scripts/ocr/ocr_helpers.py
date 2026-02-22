from __future__ import annotations

import hashlib
import random
import re
from datetime import datetime, timezone
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def stable_doc_key(text: str) -> str:
    safe = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]
    safe = safe[:40] if safe else "book"
    return f"{safe}-{digest}"


def backoff_seconds(attempt: int) -> float:
    base = min(60, (2**attempt) * 1.5)
    jitter = random.uniform(0.1, 0.9)
    return base + jitter


def to_plain(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: to_plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_plain(v) for v in value]
    if hasattr(value, "model_dump"):
        return to_plain(value.model_dump())
    if hasattr(value, "dict"):
        return to_plain(value.dict())
    return value


def get_field(obj: Any, field_name: str) -> Any:
    if isinstance(obj, dict):
        return obj.get(field_name)
    return getattr(obj, field_name, None)


def extract_id(obj: Any) -> str:
    identifier = get_field(obj, "id")
    if not identifier:
        raise RuntimeError(f"Response object has no id: {obj}")
    return str(identifier)


def extract_file_id(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return get_field(value, "id")


def extract_signed_url(obj: Any) -> str | None:
    value = get_field(obj, "url")
    if value:
        return str(value)
    return None


def extract_status(obj: Any) -> str:
    status = get_field(obj, "status")
    return str(status) if status else "UNKNOWN"


def extract_progress(obj: Any) -> dict[str, int]:
    total = int(get_field(obj, "total_requests") or 0)
    succeeded = int(get_field(obj, "succeeded_requests") or 0)
    failed = int(get_field(obj, "failed_requests") or 0)
    return {
        "total": total,
        "succeeded": succeeded,
        "failed": failed,
        "done": succeeded + failed,
    }


def read_download_payload(payload_obj: Any) -> bytes:
    if isinstance(payload_obj, bytes):
        return payload_obj
    if isinstance(payload_obj, bytearray):
        return bytes(payload_obj)
    if hasattr(payload_obj, "read"):
        return payload_obj.read()
    if hasattr(payload_obj, "data"):
        data = payload_obj.data
        if isinstance(data, bytes):
            return data
        if isinstance(data, str):
            return data.encode("utf-8")
    raise RuntimeError("Unknown download payload type")

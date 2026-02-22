from __future__ import annotations

import json
import os
import random
import time
from pathlib import Path
from typing import Any

import requests
from mistralai import Mistral

from config import ChunkingConfig


def embed_chunks(
    chunks: list[dict[str, Any]],
    config: ChunkingConfig,
    logger,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    provider = resolve_provider(config.embedding_provider)
    logger.info("Embedding provider: %s", provider)

    progress_path = config.embedding_progress_path()
    progress_map = load_embedding_progress(progress_path)
    logger.info("Found %s existing embeddings in progress file", len(progress_map))

    missing_ids = [chunk["id"] for chunk in chunks if chunk["id"] not in progress_map]
    logger.info("Chunks needing embedding: %s", len(missing_ids))

    if missing_ids:
        if provider == "gemini":
            gemini_embed_missing(chunks, progress_map, progress_path, config, logger)
        elif provider == "mistral":
            mistral_embed_missing(chunks, progress_map, progress_path, config, logger)
        else:
            raise RuntimeError(f"Unsupported embedding provider: {provider}")

    embedded_chunks: list[dict[str, Any]] = []
    dims = set()
    for chunk in chunks:
        emb = progress_map.get(chunk["id"])
        if not emb:
            raise RuntimeError(f"Missing embedding for chunk {chunk['id']}")
        dims.add(len(emb))
        item = dict(chunk)
        item["embedding"] = emb
        embedded_chunks.append(item)

    report = {
        "provider": provider,
        "embedding_model": config.embedding_model
        if provider == "gemini"
        else config.mistral_embedding_model,
        "chunk_count": len(embedded_chunks),
        "embedding_dimensions": sorted(dims),
        "progress_file": str(progress_path),
    }
    return embedded_chunks, report


def resolve_provider(requested: str) -> str:
    requested = (requested or "gemini").strip().lower()
    if requested == "gemini":
        if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
            return "gemini"
        if os.getenv("MISTRAL_API_KEY"):
            return "mistral"
        raise RuntimeError("No GEMINI_API_KEY/GOOGLE_API_KEY or MISTRAL_API_KEY found")
    if requested == "mistral":
        if not os.getenv("MISTRAL_API_KEY"):
            raise RuntimeError("MISTRAL_API_KEY is required for mistral embedding provider")
        return "mistral"
    raise RuntimeError(f"Unknown provider: {requested}")


def load_embedding_progress(path: Path) -> dict[str, list[float]]:
    mapping: dict[str, list[float]] = {}
    if not path.exists():
        return mapping

    with path.open("r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            row = json.loads(line)
            mapping[row["id"]] = row["embedding"]
    return mapping


def append_progress(path: Path, chunk_id: str, embedding: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"id": chunk_id, "embedding": embedding}, ensure_ascii=False) + "\n")


def gemini_embed_missing(
    chunks: list[dict[str, Any]],
    progress_map: dict[str, list[float]],
    progress_path: Path,
    config: ChunkingConfig,
    logger,
) -> None:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY not set")

    endpoint = f"{config.gemini_base_url}/models/{config.embedding_model}:batchEmbedContents"
    pending = [chunk for chunk in chunks if chunk["id"] not in progress_map]

    for start in range(0, len(pending), config.embedding_batch_size):
        batch = pending[start : start + config.embedding_batch_size]
        requests_payload = []
        for chunk in batch:
            req = {
                "model": f"models/{config.embedding_model}",
                "content": {"parts": [{"text": chunk["textOriginal"]}]},
                "taskType": config.embed_task_type,
            }
            # gemini-embedding-001 defaults to 3072 dims; reduce to 768 for storage
            if "gemini-embedding" in config.embedding_model:
                req["outputDimensionality"] = 768
            requests_payload.append(req)

        payload = {"requests": requests_payload}

        response_data = request_with_retries(
            method="POST",
            url=f"{endpoint}?key={api_key}",
            json_payload=payload,
            retries=config.embedding_retries,
        )

        embeddings = response_data.get("embeddings", [])
        if len(embeddings) != len(batch):
            raise RuntimeError(
                f"Gemini embeddings mismatch: expected {len(batch)} got {len(embeddings)}"
            )

        for chunk, emb_obj in zip(batch, embeddings):
            emb = emb_obj.get("values") or []
            if not emb:
                raise RuntimeError(f"Gemini returned empty embedding for {chunk['id']}")
            progress_map[chunk["id"]] = emb
            append_progress(progress_path, chunk["id"], emb)

        done = len(progress_map)
        total = len(chunks)
        logger.info("Gemini embedding progress: %s/%s", done, total)


def mistral_embed_missing(
    chunks: list[dict[str, Any]],
    progress_map: dict[str, list[float]],
    progress_path: Path,
    config: ChunkingConfig,
    logger,
) -> None:
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY not set")

    client = Mistral(api_key=api_key)
    pending = [chunk for chunk in chunks if chunk["id"] not in progress_map]

    for start in range(0, len(pending), config.embedding_batch_size):
        batch = pending[start : start + config.embedding_batch_size]
        texts = [chunk["textOriginal"] for chunk in batch]

        response = mistral_embed_with_retries(
            client=client,
            model=config.mistral_embedding_model,
            inputs=texts,
            retries=config.embedding_retries,
        )
        data = getattr(response, "data", None) or []
        if len(data) != len(batch):
            raise RuntimeError(
                f"Mistral embeddings mismatch: expected {len(batch)} got {len(data)}"
            )

        for chunk, item in zip(batch, data):
            emb = item.embedding
            progress_map[chunk["id"]] = emb
            append_progress(progress_path, chunk["id"], emb)

        done = len(progress_map)
        total = len(chunks)
        logger.info("Mistral embedding progress: %s/%s", done, total)


def request_with_retries(
    method: str,
    url: str,
    json_payload: dict[str, Any],
    retries: int,
) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = requests.request(
                method=method,
                url=url,
                json=json_payload,
                timeout=120,
            )
            if response.status_code >= 400:
                raise RuntimeError(
                    f"HTTP {response.status_code}: {response.text[:500]}"
                )
            return response.json()
        except Exception as err:  # noqa: BLE001
            last_error = err
            if attempt == retries:
                break
            time.sleep(backoff(attempt))

    raise RuntimeError(f"Request failed after {retries} attempts: {last_error}")


def mistral_embed_with_retries(client: Mistral, model: str, inputs: list[str], retries: int):
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return client.embeddings.create(model=model, inputs=inputs)
        except Exception as err:  # noqa: BLE001
            last_error = err
            if attempt == retries:
                break
            time.sleep(backoff(attempt))

    raise RuntimeError(f"Mistral embedding failed after {retries} attempts: {last_error}")


def backoff(attempt: int) -> float:
    return min(30, 1.5 * (2**attempt)) + random.uniform(0.1, 0.8)

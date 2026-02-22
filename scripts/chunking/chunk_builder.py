from __future__ import annotations

import json
import logging
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from topic_keywords import TOPIC_KEYWORDS
from text_utils import (
    clean_header_footer,
    clean_markdown_text,
    detect_language,
    html_table_to_text,
    join_non_empty,
    normalize_for_search,
    normalize_source_short,
    source_book_name,
    stable_source_key,
    tail_words,
    word_count,
)


def discover_ocr_json_files(extracted_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in extracted_dir.rglob("*_ocr.json")
        if path.name != "_manifest.json"
    )


def build_chunks_from_extracted(
    extracted_dir: Path,
    min_chunk_words: int,
    target_chunk_words: int,
    max_chunk_words: int,
    overlap_words: int,
    logger: logging.Logger,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    files = discover_ocr_json_files(extracted_dir)
    if not files:
        raise RuntimeError(f"No *_ocr.json files found under {extracted_dir}")

    chunks: list[dict[str, Any]] = []
    chunks_per_book: Counter[str] = Counter()
    pages_per_book: dict[str, int] = {}
    topic_counts: Counter[str] = Counter()

    for file_path in files:
        pages = json.loads(file_path.read_text(encoding="utf-8"))
        source_pdf = infer_source_pdf(file_path)
        source_short = normalize_source_short(source_pdf)
        source_book = source_book_name(source_pdf)
        pages_per_book[source_pdf] = len(pages)

        local_chunks = build_chunks_for_book(
            pages=pages,
            source_pdf=source_pdf,
            source_short=source_short,
            source_book=source_book,
            min_chunk_words=min_chunk_words,
            target_chunk_words=target_chunk_words,
            max_chunk_words=max_chunk_words,
            overlap_words=overlap_words,
        )

        for chunk in local_chunks:
            chunks.append(chunk)
            chunks_per_book[source_pdf] += 1
            for tag in chunk.get("topicTags", []):
                topic_counts[tag] += 1

        logger.info("Chunked %s -> %s chunks", source_pdf, len(local_chunks))

    report = {
        "books": len(files),
        "total_chunks": len(chunks),
        "total_pages": sum(pages_per_book.values()),
        "chunks_per_book": dict(chunks_per_book),
        "pages_per_book": pages_per_book,
        "topic_counts": dict(topic_counts),
        "avg_chunk_words": round(sum(c["wordCount"] for c in chunks) / max(len(chunks), 1), 2),
    }
    return chunks, report


def build_chunks_for_book(
    pages: list[dict[str, Any]],
    source_pdf: str,
    source_short: str,
    source_book: str,
    min_chunk_words: int,
    target_chunk_words: int,
    max_chunk_words: int,
    overlap_words: int,
) -> list[dict[str, Any]]:
    page_units: list[dict[str, Any]] = []

    for page in pages:
        page_index = int(page.get("global_page_index", 0))
        page_text = page_to_text(page)
        if word_count(page_text) < 8:
            continue

        page_units.append(
            {
                "page": page_index,
                "header": clean_header_footer(page.get("header")),
                "text": page_text,
            }
        )

    merged_units = merge_short_page_units(page_units, min_chunk_words, max_chunk_words)

    final_units: list[dict[str, Any]] = []
    for unit in merged_units:
        wc = word_count(unit["text"])
        if wc <= max_chunk_words:
            final_units.append(unit)
            continue

        splits = split_long_unit(
            unit=unit,
            target_chunk_words=target_chunk_words,
            max_chunk_words=max_chunk_words,
            overlap_words=overlap_words,
        )
        final_units.extend(splits)

    final_units = enforce_min_unit_size(final_units, min_chunk_words, max_chunk_words)

    source_key = stable_source_key(source_pdf)
    chunks: list[dict[str, Any]] = []
    for index, unit in enumerate(final_units):
        text_original = unit["text"].strip()
        text_normalized = normalize_for_search(text_original)
        if word_count(text_normalized) < 20:
            continue

        topic_tags = detect_topic_tags(text_original, text_normalized)
        chunk_id = f"{source_key}-c{index:05d}"

        chunk = {
            "id": chunk_id,
            "textOriginal": text_original,
            "textNormalized": text_normalized,
            "sourceBook": source_book,
            "sourcePdf": source_pdf,
            "sourceBookShort": source_short,
            "sourceKey": source_key,
            "pageStart": unit["page_start"],
            "pageEnd": unit["page_end"],
            "chapterHeader": unit.get("header") or None,
            "topicTags": topic_tags,
            "language": detect_language(text_original),
            "wordCount": word_count(text_original),
        }
        chunks.append(chunk)

    return chunks


def infer_source_pdf(ocr_json_path: Path) -> str:
    as_posix = ocr_json_path.as_posix()
    marker = "/extracted/"
    if marker in as_posix:
        tail = as_posix.split(marker, 1)[1]
        if tail.startswith("resources/"):
            return re.sub(r"_ocr\.json$", ".pdf", tail)
    # fallback
    name = ocr_json_path.name.replace("_ocr.json", ".pdf")
    return f"resources/{name}"


def page_to_text(page: dict[str, Any]) -> str:
    header = clean_header_footer(page.get("header"))
    footer = clean_header_footer(page.get("footer"))
    markdown = clean_markdown_text(page.get("markdown", ""))

    table_texts: list[str] = []
    for table in page.get("tables", []):
        html_content = table.get("content") or ""
        table_plain = html_table_to_text(html_content)
        if table_plain:
            table_texts.append(table_plain)

    return join_non_empty([header, markdown, "\n\n".join(table_texts), footer])


def merge_short_page_units(
    units: list[dict[str, Any]],
    min_chunk_words: int,
    max_chunk_words: int,
) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    for unit in units:
        unit_words = word_count(unit["text"])
        if current is None:
            current = {
                "page_start": unit["page"],
                "page_end": unit["page"],
                "header": unit.get("header", ""),
                "text": unit["text"],
            }
            continue

        current_words = word_count(current["text"])
        should_merge = False
        if current_words < min_chunk_words:
            should_merge = True
        elif unit_words < 40 and current_words + unit_words <= int(max_chunk_words * 1.2):
            should_merge = True

        if should_merge:
            current["page_end"] = unit["page"]
            current["text"] = join_non_empty([current["text"], unit["text"]])
            if not current.get("header"):
                current["header"] = unit.get("header", "")
        else:
            merged.append(current)
            current = {
                "page_start": unit["page"],
                "page_end": unit["page"],
                "header": unit.get("header", ""),
                "text": unit["text"],
            }

    if current is not None:
        merged.append(current)

    return merged


def enforce_min_unit_size(
    units: list[dict[str, Any]],
    min_chunk_words: int,
    max_chunk_words: int,
) -> list[dict[str, Any]]:
    if not units:
        return units

    adjusted: list[dict[str, Any]] = []
    i = 0
    max_merge_words = int(max_chunk_words * 1.2)

    while i < len(units):
        unit = dict(units[i])
        unit_words = word_count(unit["text"])

        if unit_words >= min_chunk_words:
            adjusted.append(unit)
            i += 1
            continue

        merged = False
        if i + 1 < len(units):
            nxt = units[i + 1]
            combined_words = unit_words + word_count(nxt["text"])
            if combined_words <= max_merge_words:
                adjusted.append(
                    {
                        "page_start": unit["page_start"],
                        "page_end": nxt["page_end"],
                        "header": unit.get("header") or nxt.get("header"),
                        "text": join_non_empty([unit["text"], nxt["text"]]),
                    }
                )
                i += 2
                merged = True

        if merged:
            continue

        if adjusted:
            prev_words = word_count(adjusted[-1]["text"])
            if prev_words + unit_words <= max_merge_words:
                adjusted[-1]["page_end"] = unit["page_end"]
                adjusted[-1]["text"] = join_non_empty([adjusted[-1]["text"], unit["text"]])
                i += 1
                continue

        adjusted.append(unit)
        i += 1

    normalized: list[dict[str, Any]] = []
    for unit in adjusted:
        unit_words = word_count(unit["text"])
        if unit_words <= max_chunk_words:
            normalized.append(unit)
            continue

        normalized.extend(
            split_long_unit(
                unit=unit,
                target_chunk_words=max(int(max_chunk_words * 0.7), min_chunk_words),
                max_chunk_words=max_chunk_words,
                overlap_words=min(40, max(10, min_chunk_words // 2)),
            )
        )

    return normalized


def split_long_unit(
    unit: dict[str, Any],
    target_chunk_words: int,
    max_chunk_words: int,
    overlap_words: int,
) -> list[dict[str, Any]]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", unit["text"]) if p.strip()]
    if not paragraphs:
        return [unit]

    split_units: list[dict[str, Any]] = []
    current_parts: list[str] = []
    current_words = 0

    def flush_current() -> None:
        nonlocal current_parts, current_words
        if not current_parts:
            return
        chunk_text = join_non_empty(current_parts)
        split_units.append(
            {
                "page_start": unit["page_start"],
                "page_end": unit["page_end"],
                "header": unit.get("header", ""),
                "text": chunk_text,
            }
        )
        overlap = tail_words(chunk_text, overlap_words)
        current_parts = [overlap] if overlap else []
        current_words = word_count(overlap)

    for para in paragraphs:
        para_words = word_count(para)

        if para_words > max_chunk_words:
            if current_parts:
                flush_current()

            giant_words = para.split()
            start = 0
            while start < len(giant_words):
                end = min(start + target_chunk_words, len(giant_words))
                piece = " ".join(giant_words[start:end])
                split_units.append(
                    {
                        "page_start": unit["page_start"],
                        "page_end": unit["page_end"],
                        "header": unit.get("header", ""),
                        "text": piece,
                    }
                )
                if end >= len(giant_words):
                    break
                start = max(0, end - overlap_words)
            current_parts = []
            current_words = 0
            continue

        would_exceed = current_words + para_words > max_chunk_words
        target_reached = current_words >= target_chunk_words

        if current_parts and (would_exceed or target_reached):
            flush_current()

        current_parts.append(para)
        current_words += para_words

    if current_parts:
        split_units.append(
            {
                "page_start": unit["page_start"],
                "page_end": unit["page_end"],
                "header": unit.get("header", ""),
                "text": join_non_empty(current_parts),
            }
        )

    return split_units


def detect_topic_tags(text_original: str, text_normalized: str) -> list[str]:
    haystack = f"{text_original}\n{text_normalized}".lower()
    tags: list[str] = []
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(keyword.lower() in haystack for keyword in keywords):
            tags.append(topic)
    return sorted(tags)


def summarize_chunk_quality(chunks: list[dict[str, Any]]) -> dict[str, Any]:
    if not chunks:
        return {
            "min_words": 0,
            "max_words": 0,
            "avg_words": 0,
            "too_short": 0,
            "too_long": 0,
        }

    words = [c["wordCount"] for c in chunks]
    return {
        "min_words": min(words),
        "max_words": max(words),
        "avg_words": round(sum(words) / len(words), 2),
        "too_short": sum(1 for w in words if w < 80),
        "too_long": sum(1 for w in words if w > 500),
    }


def group_chunks_by_book(chunks: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for chunk in chunks:
        grouped[chunk["sourcePdf"]].append(chunk)
    return grouped

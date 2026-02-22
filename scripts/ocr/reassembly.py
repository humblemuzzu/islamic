from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ocr_helpers import now_iso


def reassemble_results(
    project_root: Path,
    extracted_dir: Path,
    resources_dir: Path,
    chunks: list[dict[str, Any]],
    results: dict[str, Any],
    failed_ids: list[str],
    model: str,
) -> Path:
    by_source: dict[str, list[dict[str, Any]]] = {}
    for chunk in chunks:
        by_source.setdefault(chunk["source_pdf"], []).append(chunk)

    manifest_books: list[dict[str, Any]] = []

    for source_pdf, source_chunks in by_source.items():
        source_chunks = sorted(source_chunks, key=lambda c: c["chunk_index"])
        markdown_parts: list[str] = []
        json_pages: list[dict[str, Any]] = []
        missing_custom_ids: list[str] = []

        for chunk in source_chunks:
            custom_id = chunk["custom_id"]
            if custom_id not in results:
                missing_custom_ids.append(custom_id)
                continue

            for page in results[custom_id]["pages"]:
                local_index = int(page.get("index", 0))
                global_index = chunk["page_start"] + local_index
                markdown = page.get("markdown", "")
                header = page.get("header")
                footer = page.get("footer")

                page_block = [f"<!-- PAGE {global_index} -->"]
                if header:
                    page_block.append(f"<!-- HEADER: {header} -->")
                page_block.append(markdown)
                if footer:
                    page_block.append(f"<!-- FOOTER: {footer} -->")
                markdown_parts.append("\n".join(page_block))

                json_pages.append(
                    {
                        "global_page_index": global_index,
                        "chunk_index": chunk["chunk_index"],
                        "markdown": markdown,
                        "header": header,
                        "footer": footer,
                        "tables": page.get("tables", []),
                        "dimensions": page.get("dimensions", {}),
                    }
                )

        rel_without_ext = Path(source_pdf).with_suffix("")
        md_path = extracted_dir / rel_without_ext.parent / f"{rel_without_ext.name}_ocr.md"
        json_path = extracted_dir / rel_without_ext.parent / f"{rel_without_ext.name}_ocr.json"
        md_path.parent.mkdir(parents=True, exist_ok=True)

        with md_path.open("w", encoding="utf-8") as md_file:
            md_file.write("\n\n".join(markdown_parts))
        with json_path.open("w", encoding="utf-8") as json_file:
            json.dump(json_pages, json_file, ensure_ascii=False, indent=2)

        manifest_books.append(
            {
                "source_pdf": source_pdf,
                "output_markdown": str(md_path.relative_to(project_root)),
                "output_json": str(json_path.relative_to(project_root)),
                "total_chunks": len(source_chunks),
                "ocr_pages": len(json_pages),
                "missing_chunks": missing_custom_ids,
                "failed_chunk_count": len(missing_custom_ids),
            }
        )

    manifest = {
        "generated_at": now_iso(),
        "model": model,
        "source_root": str(resources_dir.relative_to(project_root)),
        "books": manifest_books,
        "failed_custom_ids": failed_ids,
    }

    manifest_path = extracted_dir / "_manifest.json"
    with manifest_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    return manifest_path

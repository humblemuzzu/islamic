from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path
from typing import Any

from pypdf import PdfReader, PdfWriter

from ocr_helpers import stable_doc_key

MB = 1024 * 1024


def prepare_chunks(
    project_root: Path,
    resources_dir: Path,
    chunk_dir: Path,
    max_chunk_mb: int,
    max_request_mb: int,
    max_request_pages: int,
    existing_chunks: list[dict[str, Any]] | None,
    logger: logging.Logger,
) -> list[dict[str, Any]]:
    if existing_chunks:
        valid_existing = []
        for chunk in existing_chunks:
            if Path(chunk["chunk_path"]).exists():
                valid_existing.append(chunk)
        if len(valid_existing) == len(existing_chunks):
            logger.info("Reusing %s chunks from previous state.", len(valid_existing))
            return valid_existing

    pdf_paths = sorted(resources_dir.rglob("*.pdf"))
    if not pdf_paths:
        raise RuntimeError(f"No PDFs found in {resources_dir}")

    logger.info("Found %s PDFs under %s", len(pdf_paths), resources_dir)

    all_chunks: list[dict[str, Any]] = []
    for pdf_path in pdf_paths:
        rel_pdf = pdf_path.relative_to(project_root)
        file_size_mb = pdf_path.stat().st_size / MB
        total_pages = get_total_pages(pdf_path)

        needs_split = file_size_mb > max_chunk_mb or total_pages > max_request_pages
        if not needs_split:
            all_chunks.append(
                build_chunk_record(
                    pdf_path=pdf_path,
                    relative_pdf=rel_pdf,
                    chunk_path=pdf_path,
                    chunk_index=0,
                    page_start=0,
                    page_end=total_pages - 1,
                    total_pages=total_pages,
                )
            )
            continue

        split_chunks = split_pdf(
            pdf_path=pdf_path,
            relative_pdf=rel_pdf,
            total_pages=total_pages,
            chunk_dir=chunk_dir,
            max_chunk_mb=max_chunk_mb,
            max_request_mb=max_request_mb,
            max_request_pages=max_request_pages,
            logger=logger,
        )
        all_chunks.extend(split_chunks)

    logger.info("Prepared %s OCR requests after splitting.", len(all_chunks))
    return all_chunks


def get_total_pages(pdf_path: Path) -> int:
    pdfinfo_bin = shutil.which("pdfinfo")
    if pdfinfo_bin:
        result = subprocess.run(
            [pdfinfo_bin, str(pdf_path)],
            capture_output=True,
            text=True,
            check=True,
        )
        for line in result.stdout.splitlines():
            if line.startswith("Pages:"):
                return int(line.split(":", 1)[1].strip())

    reader = PdfReader(str(pdf_path))
    return len(reader.pages)


def build_chunk_record(
    pdf_path: Path,
    relative_pdf: Path,
    chunk_path: Path,
    chunk_index: int,
    page_start: int,
    page_end: int,
    total_pages: int,
) -> dict[str, Any]:
    relative_without_suffix = relative_pdf.with_suffix("")
    source_key = stable_doc_key(str(relative_without_suffix))
    custom_id = f"{source_key}__c{chunk_index:03d}__p{page_start}-{page_end}"

    return {
        "source_pdf": str(relative_pdf),
        "source_key": source_key,
        "chunk_index": chunk_index,
        "page_start": page_start,
        "page_end": page_end,
        "total_pages": total_pages,
        "chunk_path": str(chunk_path),
        "custom_id": custom_id,
        "uploaded_file_id": None,
        "signed_url": None,
    }


def split_pdf(
    pdf_path: Path,
    relative_pdf: Path,
    total_pages: int,
    chunk_dir: Path,
    max_chunk_mb: int,
    max_request_mb: int,
    max_request_pages: int,
    logger: logging.Logger,
) -> list[dict[str, Any]]:
    gs_bin = shutil.which("gs")
    if gs_bin:
        return split_pdf_with_ghostscript(
            gs_bin=gs_bin,
            pdf_path=pdf_path,
            relative_pdf=relative_pdf,
            total_pages=total_pages,
            chunk_dir=chunk_dir,
            max_chunk_mb=max_chunk_mb,
            max_request_mb=max_request_mb,
            max_request_pages=max_request_pages,
            logger=logger,
        )

    logger.warning("Ghostscript not found. Falling back to pypdf splitter.")
    return split_pdf_with_pypdf(
        pdf_path=pdf_path,
        relative_pdf=relative_pdf,
        total_pages=total_pages,
        chunk_dir=chunk_dir,
        max_chunk_mb=max_chunk_mb,
        max_request_mb=max_request_mb,
        max_request_pages=max_request_pages,
        logger=logger,
    )


def split_pdf_with_ghostscript(
    gs_bin: str,
    pdf_path: Path,
    relative_pdf: Path,
    total_pages: int,
    chunk_dir: Path,
    max_chunk_mb: int,
    max_request_mb: int,
    max_request_pages: int,
    logger: logging.Logger,
) -> list[dict[str, Any]]:
    file_size_mb = pdf_path.stat().st_size / MB
    pages_guess = int(
        max(
            20,
            min(max_request_pages, (max_chunk_mb / max(file_size_mb, 1)) * total_pages * 0.9),
        )
    )
    pages_guess = max(1, pages_guess)
    target_mb = min(max_chunk_mb, int(max_request_mb * 0.95))

    logger.info(
        "Splitting %s (%s pages, %.1fMB), initial guess: %s pages/chunk",
        relative_pdf,
        total_pages,
        file_size_mb,
        pages_guess,
    )

    chunks: list[dict[str, Any]] = []
    chunk_index = 0
    current_page = 0

    while current_page < total_pages:
        pages_per_chunk = pages_guess

        while True:
            end_page = min(current_page + pages_per_chunk, total_pages)
            chunk_target_dir = chunk_dir / relative_pdf.parent
            chunk_target_dir.mkdir(parents=True, exist_ok=True)
            chunk_name = (
                f"{pdf_path.stem}_chunk{chunk_index:03d}_"
                f"p{current_page:04d}-{end_page - 1:04d}.pdf"
            )
            chunk_path = chunk_target_dir / chunk_name

            run_ghostscript_slice(
                gs_bin=gs_bin,
                source_pdf=pdf_path,
                first_page=current_page + 1,
                last_page=end_page,
                output_pdf=chunk_path,
            )

            chunk_mb = chunk_path.stat().st_size / MB
            chunk_pages = end_page - current_page
            too_big = chunk_mb > target_mb
            too_many_pages = chunk_pages > max_request_pages

            if not too_big and not too_many_pages:
                chunks.append(
                    build_chunk_record(
                        pdf_path=pdf_path,
                        relative_pdf=relative_pdf,
                        chunk_path=chunk_path,
                        chunk_index=chunk_index,
                        page_start=current_page,
                        page_end=end_page - 1,
                        total_pages=total_pages,
                    )
                )
                logger.info(
                    "  chunk %03d pages %s-%s (%.1fMB)",
                    chunk_index,
                    current_page,
                    end_page - 1,
                    chunk_mb,
                )

                if chunk_mb < target_mb * 0.6:
                    pages_guess = min(max_request_pages, int(max(pages_per_chunk + 1, pages_per_chunk * 1.2)))
                else:
                    pages_guess = pages_per_chunk

                chunk_index += 1
                current_page = end_page
                break

            chunk_path.unlink(missing_ok=True)
            if pages_per_chunk == 1:
                raise RuntimeError(
                    f"Single-page chunk exceeds limit for {pdf_path} page {current_page}"
                )
            pages_per_chunk = max(1, int(pages_per_chunk * 0.7))
            logger.warning(
                "  reducing pages/chunk to %s (candidate %.1fMB)",
                pages_per_chunk,
                chunk_mb,
            )

    return chunks


def run_ghostscript_slice(
    gs_bin: str,
    source_pdf: Path,
    first_page: int,
    last_page: int,
    output_pdf: Path,
) -> None:
    cmd = [
        gs_bin,
        "-q",
        "-dBATCH",
        "-dNOPAUSE",
        "-sDEVICE=pdfwrite",
        f"-dFirstPage={first_page}",
        f"-dLastPage={last_page}",
        "-o",
        str(output_pdf),
        str(source_pdf),
    ]
    subprocess.run(cmd, capture_output=True, check=True)


def split_pdf_with_pypdf(
    pdf_path: Path,
    relative_pdf: Path,
    total_pages: int,
    chunk_dir: Path,
    max_chunk_mb: int,
    max_request_mb: int,
    max_request_pages: int,
    logger: logging.Logger,
) -> list[dict[str, Any]]:
    reader = PdfReader(str(pdf_path))
    file_size_mb = pdf_path.stat().st_size / MB
    pages_guess = int(
        max(
            20,
            min(max_request_pages, (max_chunk_mb / max(file_size_mb, 1)) * total_pages * 0.85),
        )
    )
    pages_guess = max(1, pages_guess)

    chunks: list[dict[str, Any]] = []
    chunk_index = 0
    current_page = 0

    while current_page < total_pages:
        pages_per_chunk = pages_guess

        while True:
            end_page = min(current_page + pages_per_chunk, total_pages)
            chunk_target_dir = chunk_dir / relative_pdf.parent
            chunk_target_dir.mkdir(parents=True, exist_ok=True)
            chunk_name = (
                f"{pdf_path.stem}_chunk{chunk_index:03d}_"
                f"p{current_page:04d}-{end_page - 1:04d}.pdf"
            )
            chunk_path = chunk_target_dir / chunk_name

            writer = PdfWriter()
            for page_no in range(current_page, end_page):
                writer.add_page(reader.pages[page_no])
            with chunk_path.open("wb") as chunk_file:
                writer.write(chunk_file)

            chunk_mb = chunk_path.stat().st_size / MB
            too_big = chunk_mb > max_chunk_mb
            if not too_big:
                chunks.append(
                    build_chunk_record(
                        pdf_path=pdf_path,
                        relative_pdf=relative_pdf,
                        chunk_path=chunk_path,
                        chunk_index=chunk_index,
                        page_start=current_page,
                        page_end=end_page - 1,
                        total_pages=total_pages,
                    )
                )
                logger.info(
                    "  pypdf chunk %03d pages %s-%s (%.1fMB)",
                    chunk_index,
                    current_page,
                    end_page - 1,
                    chunk_mb,
                )
                chunk_index += 1
                current_page = end_page
                break

            chunk_path.unlink(missing_ok=True)
            if pages_per_chunk == 1:
                raise RuntimeError(
                    f"Single-page pypdf chunk exceeds limit for {pdf_path} page {current_page}"
                )
            pages_per_chunk = max(1, int(pages_per_chunk * 0.7))
            if pages_per_chunk > max_request_pages:
                pages_per_chunk = max_request_pages

    return chunks

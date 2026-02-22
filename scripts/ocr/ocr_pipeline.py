from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

from mistralai import Mistral

from chunking import prepare_chunks
from config import OcrConfig
from ocr_helpers import (
    backoff_seconds,
    extract_file_id,
    extract_id,
    extract_progress,
    extract_signed_url,
    extract_status,
    get_field,
    now_iso,
    read_download_payload,
    to_plain,
)
from reassembly import reassemble_results

TERMINAL_BATCH_STATUSES = {
    "SUCCESS",
    "FAILED",
    "TIMEOUT_EXCEEDED",
    "CANCELLATION_REQUESTED",
    "CANCELLED",
}


class OcrPipeline:
    def __init__(self, config: OcrConfig) -> None:
        self.config = config
        self.logger = logging.getLogger("ocr-pipeline")
        self.client = Mistral(api_key=self._get_api_key())
        self.state = self._load_state()

        self.config.chunk_dir.mkdir(parents=True, exist_ok=True)
        self.config.extracted_dir.mkdir(parents=True, exist_ok=True)
        self.config.artifacts_dir.mkdir(parents=True, exist_ok=True)

    def run(self, submit_only: bool = False) -> dict[str, Any]:
        chunks = prepare_chunks(
            project_root=self.config.project_root,
            resources_dir=self.config.resources_dir,
            chunk_dir=self.config.chunk_dir,
            max_chunk_mb=self.config.max_chunk_mb,
            max_request_mb=self.config.max_request_mb,
            max_request_pages=self.config.max_request_pages,
            existing_chunks=self.state.get("chunks"),
            logger=self.logger,
        )
        self.state["chunks"] = chunks
        self._save_state()

        self._upload_chunks(chunks)

        mode = "batch"
        results: dict[str, Any]
        failed_ids: list[str]

        try:
            batch_input_path = self._build_batch_input_jsonl(chunks)
            self._submit_batch_job(batch_input_path, len(chunks))

            if submit_only:
                return {
                    "status": "submitted",
                    "mode": "batch",
                    "job_id": self.state["batch"].get("job_id"),
                    "requests": len(chunks),
                }

            job = self._wait_for_completion()
            self._download_job_outputs(job)
            results, failed_ids = self._parse_batch_results()
            if failed_ids:
                retry_results, still_failed = self._retry_failed_direct(failed_ids)
                results.update(retry_results)
                failed_ids = still_failed

        except Exception as err:  # noqa: BLE001
            if not self.config.allow_direct_fallback:
                raise
            self.logger.warning(
                "Batch pipeline failed (%s). Falling back to direct OCR mode.",
                err,
            )
            mode = "direct"
            if submit_only:
                return {
                    "status": "batch_rejected",
                    "mode": "batch",
                    "error": str(err),
                }
            results, failed_ids = self._process_all_direct(chunks)

        manifest = reassemble_results(
            project_root=self.config.project_root,
            extracted_dir=self.config.extracted_dir,
            resources_dir=self.config.resources_dir,
            chunks=chunks,
            results=results,
            failed_ids=failed_ids,
            model=self.config.model,
        )

        self.state["final"] = {
            "completed_at": now_iso(),
            "failed_custom_ids": failed_ids,
            "manifest_path": str(manifest),
            "mode": mode,
        }
        self._save_state()

        return {
            "status": "completed",
            "mode": mode,
            "job_id": self.state.get("batch", {}).get("job_id"),
            "failed_requests": len(failed_ids),
            "manifest": str(manifest),
        }

    def _get_api_key(self) -> str:
        import os

        api_key = os.getenv("MISTRAL_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError(
                "MISTRAL_API_KEY is not set. Export it before running this script."
            )
        return api_key

    def _load_state(self) -> dict[str, Any]:
        if self.config.state_path.exists():
            with self.config.state_path.open("r", encoding="utf-8") as f:
                return json.load(f)

        return {
            "version": 1,
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "chunks": [],
            "batch": {},
            "results": {},
            "final": {},
        }

    def _save_state(self) -> None:
        self.state["updated_at"] = now_iso()
        tmp_path = self.config.state_path.with_suffix(".tmp")
        with tmp_path.open("w", encoding="utf-8") as f:
            json.dump(self.state, f, ensure_ascii=False, indent=2)
        tmp_path.replace(self.config.state_path)

    def _upload_chunks(self, chunks: list[dict[str, Any]]) -> None:
        for chunk in chunks:
            if chunk.get("uploaded_file_id") and chunk.get("signed_url"):
                continue

            chunk_path = Path(chunk["chunk_path"])
            for attempt in range(1, self.config.upload_retries + 1):
                try:
                    with chunk_path.open("rb") as f:
                        uploaded = self.client.files.upload(
                            file={"file_name": chunk_path.name, "content": f},
                            purpose="ocr",
                        )
                    file_id = extract_id(uploaded)

                    signed = self.client.files.get_signed_url(
                        file_id=file_id,
                        expiry=self.config.signed_url_expiry_hours,
                    )
                    signed_url = extract_signed_url(signed)
                    if not signed_url:
                        raise RuntimeError("Signed URL missing in response")

                    chunk["uploaded_file_id"] = file_id
                    chunk["signed_url"] = signed_url
                    self._save_state()
                    break
                except Exception as err:  # noqa: BLE001
                    if attempt == self.config.upload_retries:
                        raise RuntimeError(
                            f"Upload failed for {chunk_path} after {attempt} attempts"
                        ) from err

                    wait = backoff_seconds(attempt)
                    self.logger.warning(
                        "Upload failed for %s (attempt %s/%s): %s. Retrying in %.1fs",
                        chunk_path,
                        attempt,
                        self.config.upload_retries,
                        err,
                        wait,
                    )
                    time.sleep(wait)

    def _build_batch_input_jsonl(self, chunks: list[dict[str, Any]]) -> Path:
        existing = self.state.get("batch", {}).get("input_jsonl_path")
        if existing and Path(existing).exists():
            return Path(existing)

        batch_dir = self.config.artifacts_dir / "batch"
        batch_dir.mkdir(parents=True, exist_ok=True)
        jsonl_path = batch_dir / "batch_input.jsonl"

        with jsonl_path.open("w", encoding="utf-8") as f:
            for chunk in chunks:
                body: dict[str, Any] = {
                    "document": {
                        "type": "document_url",
                        "document_url": chunk["signed_url"],
                    },
                    "include_image_base64": self.config.include_image_base64,
                }
                if self.config.table_format:
                    body["table_format"] = self.config.table_format
                if self.config.extract_header:
                    body["extract_header"] = True
                if self.config.extract_footer:
                    body["extract_footer"] = True

                entry = {"custom_id": chunk["custom_id"], "body": body}
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        self.state.setdefault("batch", {})["input_jsonl_path"] = str(jsonl_path)
        self._save_state()
        return jsonl_path

    def _submit_batch_job(self, jsonl_path: Path, total_requests: int) -> None:
        if self.state.get("batch", {}).get("job_id"):
            return

        with jsonl_path.open("rb") as f:
            batch_file = self.client.files.upload(
                file={"file_name": jsonl_path.name, "content": f},
                purpose="batch",
            )

        input_file_id = extract_id(batch_file)
        job = self.client.batch.jobs.create(
            input_files=[input_file_id],
            model=self.config.model,
            endpoint="/v1/ocr",
            metadata={"requests": str(total_requests), "source": "mariam-resources"},
        )

        batch_state = self.state.setdefault("batch", {})
        batch_state["input_file_id"] = input_file_id
        batch_state["job_id"] = extract_id(job)
        batch_state["status"] = extract_status(job)
        self._save_state()

    def _wait_for_completion(self) -> Any:
        job_id = self.state.get("batch", {}).get("job_id")
        if not job_id:
            raise RuntimeError("Missing batch job id in state")

        while True:
            job = self.client.batch.jobs.get(job_id=job_id)
            status = extract_status(job)
            progress = extract_progress(job)

            self.logger.info(
                "Batch %s | status=%s | done=%s/%s | success=%s failed=%s",
                job_id,
                status,
                progress["done"],
                progress["total"],
                progress["succeeded"],
                progress["failed"],
            )

            batch_state = self.state.setdefault("batch", {})
            batch_state["status"] = status
            batch_state["last_progress"] = progress
            self._save_state()

            if status in TERMINAL_BATCH_STATUSES:
                if status != "SUCCESS":
                    raise RuntimeError(f"Batch job ended with status={status}")
                return job

            time.sleep(self.config.poll_interval_seconds)

    def _download_job_outputs(self, job: Any) -> None:
        output_file_id = extract_file_id(get_field(job, "output_file"))
        error_file_id = extract_file_id(get_field(job, "error_file"))

        if not output_file_id:
            raise RuntimeError("Batch succeeded but output_file is missing")

        results_dir = self.config.artifacts_dir / "results"
        results_dir.mkdir(parents=True, exist_ok=True)

        output_path = results_dir / "batch_output_raw.jsonl"
        self._download_file(output_file_id, output_path)

        results_state = self.state.setdefault("results", {})
        results_state["raw_output_path"] = str(output_path)
        results_state["output_file_id"] = output_file_id

        if error_file_id:
            error_path = results_dir / "batch_error_raw.jsonl"
            self._download_file(error_file_id, error_path)
            results_state["raw_error_path"] = str(error_path)
            results_state["error_file_id"] = error_file_id

        self._save_state()

    def _download_file(self, file_id: str, target_path: Path) -> None:
        stream = self.client.files.download(file_id=file_id)
        payload = read_download_payload(stream)
        with target_path.open("wb") as f:
            f.write(payload)

    def _parse_batch_results(self) -> tuple[dict[str, Any], list[str]]:
        raw_output_path = self.state.get("results", {}).get("raw_output_path")
        if not raw_output_path:
            raise RuntimeError("Missing raw output path in state")

        parsed: dict[str, Any] = {}
        failed: list[str] = []

        with Path(raw_output_path).open("r", encoding="utf-8", errors="replace") as f:
            for line_no, line in enumerate(f, start=1):
                if not line.strip():
                    continue

                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    self.logger.warning("Malformed JSON on line %s", line_no)
                    continue

                custom_id = row.get("custom_id")
                if not custom_id:
                    continue

                if row.get("error"):
                    failed.append(custom_id)
                    continue

                response = row.get("response", {})
                status_code = response.get("status_code", 200)
                body = response.get("body", {})
                if status_code >= 400:
                    failed.append(custom_id)
                    continue

                pages = body.get("pages", [])
                parsed[custom_id] = {
                    "pages": sorted(pages, key=lambda p: p.get("index", 0)),
                    "model": body.get("model", self.config.model),
                    "usage": body.get("usage_info", {}),
                }

        self.state.setdefault("results", {})["parsed_ok_count"] = len(parsed)
        self.state.setdefault("results", {})["failed_count"] = len(failed)
        self._save_state()
        return parsed, failed

    def _process_all_direct(self, chunks: list[dict[str, Any]]) -> tuple[dict[str, Any], list[str]]:
        direct_dir = self.config.artifacts_dir / "results" / "direct"
        direct_dir.mkdir(parents=True, exist_ok=True)

        results: dict[str, Any] = {}
        failed: list[str] = []

        for chunk in chunks:
            custom_id = chunk["custom_id"]
            result_path = direct_dir / f"{custom_id}.json"

            if result_path.exists():
                with result_path.open("r", encoding="utf-8") as f:
                    results[custom_id] = json.load(f)
                continue

            if not chunk.get("signed_url"):
                failed.append(custom_id)
                continue

            success = False
            for attempt in range(1, self.config.process_retries + 1):
                try:
                    request_body: dict[str, Any] = {
                        "model": self.config.model,
                        "document": {
                            "type": "document_url",
                            "document_url": chunk["signed_url"],
                        },
                        "include_image_base64": self.config.include_image_base64,
                    }
                    if self.config.table_format:
                        request_body["table_format"] = self.config.table_format
                    if self.config.extract_header:
                        request_body["extract_header"] = True
                    if self.config.extract_footer:
                        request_body["extract_footer"] = True

                    response = self.client.ocr.process(**request_body)
                    pages = to_plain(get_field(response, "pages") or [])
                    payload = {
                        "pages": sorted(pages, key=lambda p: p.get("index", 0)),
                        "model": self.config.model,
                        "usage": {},
                    }
                    with result_path.open("w", encoding="utf-8") as f:
                        json.dump(payload, f, ensure_ascii=False)

                    results[custom_id] = payload
                    success = True
                    if len(results) % 10 == 0:
                        self.logger.info("Direct OCR progress: %s/%s", len(results), len(chunks))
                    break
                except Exception as err:  # noqa: BLE001
                    if attempt == self.config.process_retries:
                        self.logger.error(
                            "Direct processing failed for %s after %s attempts: %s",
                            custom_id,
                            attempt,
                            err,
                        )
                        break
                    time.sleep(backoff_seconds(attempt))

            if not success:
                failed.append(custom_id)

        self.state.setdefault("results", {})["direct_mode_count"] = len(results)
        self.state.setdefault("results", {})["direct_mode_failed"] = len(failed)
        self._save_state()
        return results, failed

    def _retry_failed_direct(
        self,
        failed_ids: list[str],
    ) -> tuple[dict[str, Any], list[str]]:
        chunk_by_id = {chunk["custom_id"]: chunk for chunk in self.state["chunks"]}
        recovered: dict[str, Any] = {}
        still_failed: list[str] = []

        for custom_id in failed_ids:
            chunk = chunk_by_id.get(custom_id)
            if not chunk or not chunk.get("signed_url"):
                still_failed.append(custom_id)
                continue

            success = False
            for attempt in range(1, self.config.process_retries + 1):
                try:
                    request_body: dict[str, Any] = {
                        "model": self.config.model,
                        "document": {
                            "type": "document_url",
                            "document_url": chunk["signed_url"],
                        },
                        "include_image_base64": self.config.include_image_base64,
                    }
                    if self.config.table_format:
                        request_body["table_format"] = self.config.table_format
                    if self.config.extract_header:
                        request_body["extract_header"] = True
                    if self.config.extract_footer:
                        request_body["extract_footer"] = True

                    response = self.client.ocr.process(**request_body)
                    pages = to_plain(get_field(response, "pages") or [])
                    recovered[custom_id] = {
                        "pages": sorted(pages, key=lambda p: p.get("index", 0)),
                        "model": self.config.model,
                        "usage": {},
                    }
                    success = True
                    break
                except Exception as err:  # noqa: BLE001
                    if attempt == self.config.process_retries:
                        self.logger.error(
                            "Direct retry failed for %s after %s attempts: %s",
                            custom_id,
                            attempt,
                            err,
                        )
                        break
                    time.sleep(backoff_seconds(attempt))

            if not success:
                still_failed.append(custom_id)

        return recovered, still_failed

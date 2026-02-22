from __future__ import annotations

import hashlib
import html
import re
import unicodedata
from typing import Iterable

ARABIC_DIACRITICS_RE = re.compile(r"[\u064B-\u065F\u0670\u06D6-\u06ED]")
IMAGE_MD_RE = re.compile(r"!\[[^\]]*\]\([^\)]*\)")
TABLE_LINK_RE = re.compile(r"\[tbl-[^\]]*\]\([^\)]*\)")
URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
PHONE_RE = re.compile(r"\b\d{7,}\b")
MULTISPACE_RE = re.compile(r"\s+")
HTML_TAG_RE = re.compile(r"<[^>]+>")


def clean_markdown_text(markdown: str) -> str:
    text = markdown or ""
    text = IMAGE_MD_RE.sub(" ", text)
    text = TABLE_LINK_RE.sub(" ", text)
    text = text.replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def clean_header_footer(value: str | None) -> str:
    if not value:
        return ""
    text = value.strip()
    lower = text.lower()
    if URL_RE.search(lower):
        return ""
    if "darul" in lower or "dar-ul" in lower:
        return ""
    if PHONE_RE.search(text):
        return ""
    if len(text) <= 2:
        return ""
    return text


def html_table_to_text(html_content: str) -> str:
    plain = HTML_TAG_RE.sub(" ", html.unescape(html_content or ""))
    return MULTISPACE_RE.sub(" ", plain).strip()


def normalize_for_search(text: str) -> str:
    value = unicodedata.normalize("NFKC", text)
    value = ARABIC_DIACRITICS_RE.sub("", value)
    value = value.lower()
    value = value.replace("ؐ", "").replace("ﷺ", "")
    value = value.replace("۔", ".")
    value = re.sub(r"[\t\r\n]+", " ", value)
    value = re.sub(r"[\[\]{}()<>]", " ", value)
    value = re.sub(r"[^\w\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0900-\u097F\s.-]", " ", value)
    value = MULTISPACE_RE.sub(" ", value)
    return value.strip()


def word_count(text: str) -> int:
    return len([w for w in MULTISPACE_RE.split(text.strip()) if w])


def tail_words(text: str, count: int) -> str:
    words = [w for w in text.strip().split() if w]
    if len(words) <= count:
        return " ".join(words)
    return " ".join(words[-count:])


def detect_language(text: str) -> str:
    arabic_chars = len(re.findall(r"[\u0600-\u06FF]", text))
    devanagari_chars = len(re.findall(r"[\u0900-\u097F]", text))
    latin_chars = len(re.findall(r"[A-Za-z]", text))

    if arabic_chars >= max(devanagari_chars, latin_chars):
        return "ur"
    if devanagari_chars > arabic_chars and devanagari_chars >= latin_chars:
        return "hi"
    return "ru"


def join_non_empty(parts: Iterable[str]) -> str:
    return "\n\n".join([p.strip() for p in parts if p and p.strip()]).strip()


def normalize_source_short(source_pdf: str) -> str:
    value = source_pdf.lower().replace("\\", "/")
    value = value.replace("resources/", "")
    value = re.sub(r"\.pdf$", "", value)
    value = re.sub(r"[^a-z0-9/]+", "-", value)
    value = re.sub(r"/+", "/", value).strip("-/")
    return value


def source_book_name(source_pdf: str) -> str:
    name = source_pdf.split("/")[-1]
    name = re.sub(r"\.pdf$", "", name, flags=re.IGNORECASE)
    return name.strip()


def stable_source_key(source_pdf: str) -> str:
    short = normalize_source_short(source_pdf)
    safe = re.sub(r"[^a-z0-9]+", "-", short).strip("-")
    if not safe:
        safe = "book"
    digest = hashlib.sha1(source_pdf.encode("utf-8")).hexdigest()[:10]
    return f"{safe[:40]}-{digest}"

#!/usr/bin/env python3

from __future__ import annotations

import json
import mimetypes
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
VIEWER_DIR = ROOT / "viewer"
DOCS_DIR = ROOT / "documents"
DIST_DIR = ROOT / "dist"
DATA_DIR = DIST_DIR / "data"
CONFIG_PATH = ROOT / "site.config.json"

HTML_EXTENSIONS = {".html", ".htm"}
SVG_EXTENSIONS = {".svg"}
PDF_EXTENSIONS = {".pdf"}
MARKDOWN_EXTENSIONS = {".md", ".markdown", ".mdown"}
TEXT_EXTENSIONS = {
    ".txt",
    ".log",
    ".ini",
    ".cfg",
    ".conf",
    ".toml",
    ".yaml",
    ".yml",
    ".xml",
    ".sql",
    ".sh",
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".css",
    ".scss",
    ".json",
}
DATA_EXTENSIONS = {".csv", ".tsv"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".m4v"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}
OFFICE_EXTENSIONS = {
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".odt",
    ".ods",
    ".odp",
}
ARCHIVE_EXTENSIONS = {".zip", ".7z", ".rar", ".tar", ".gz"}


def load_config() -> dict[str, Any]:
    config: dict[str, Any] = {
        "title": ROOT.name,
        "subtitle": "Document Library",
        "tagline": "Plans, analyses, and supporting files.",
        "documents_root": "documents",
    }
    if CONFIG_PATH.exists():
        config.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
    return config


def reset_dist() -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    shutil.copytree(VIEWER_DIR, DIST_DIR)
    shutil.copytree(DOCS_DIR, DIST_DIR / "documents")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DIST_DIR / ".nojekyll").write_text("", encoding="utf-8")


def title_from_filename(path: Path) -> str:
    return path.stem.replace("_", " ").replace("-", " ").strip().title()


def human_size(size: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(value)} {unit}"
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def classify(path: Path) -> tuple[str, str]:
    suffix = path.suffix.lower()
    if suffix in HTML_EXTENSIONS:
        return "page", "html"
    if suffix in SVG_EXTENSIONS:
        return "drawing", "svg"
    if suffix in PDF_EXTENSIONS:
        return "pdf", "pdf"
    if suffix in MARKDOWN_EXTENSIONS:
        return "text", "markdown"
    if suffix in DATA_EXTENSIONS:
        return "data", "table"
    if suffix in IMAGE_EXTENSIONS:
        return "image", "image"
    if suffix in VIDEO_EXTENSIONS:
        return "media", "video"
    if suffix in AUDIO_EXTENSIONS:
        return "media", "audio"
    if suffix in OFFICE_EXTENSIONS:
        return "office", "office"
    if suffix in ARCHIVE_EXTENSIONS:
        return "download", "download"
    if suffix in TEXT_EXTENSIONS:
        return "text", "text"
    return "download", "download"


def document_records() -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    for path in sorted(DOCS_DIR.rglob("*")):
        if not path.is_file():
            continue
        if any(part.startswith(".") for part in path.relative_to(DOCS_DIR).parts):
            continue

        relative = path.relative_to(DOCS_DIR)
        site_path = Path("documents") / relative
        stat = path.stat()
        category, preview_type = classify(path)
        mime_type, _ = mimetypes.guess_type(path.name)
        folder = relative.parent.as_posix()
        modified_at = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)

        documents.append(
            {
                "title": title_from_filename(relative),
                "name": relative.name,
                "path": site_path.as_posix(),
                "relative_path": relative.as_posix(),
                "folder": "" if folder == "." else folder,
                "extension": path.suffix.lower(),
                "extension_label": path.suffix.lower().lstrip(".").upper() or "FILE",
                "size_bytes": stat.st_size,
                "size_label": human_size(stat.st_size),
                "modified_at": modified_at.isoformat(),
                "category": category,
                "preview_type": preview_type,
                "mime_type": mime_type or "application/octet-stream",
            }
        )
    return documents


def build_payload(config: dict[str, Any], documents: list[dict[str, Any]]) -> dict[str, Any]:
    folders = sorted({entry["folder"] for entry in documents if entry["folder"]})
    category_counts = Counter(entry["category"] for entry in documents)
    total_size = sum(entry["size_bytes"] for entry in documents)
    latest_update = max((entry["modified_at"] for entry in documents), default=None)
    folder_count = 0 if not documents else 1 + len(folders)

    return {
        "site": {
            "title": config["title"],
            "subtitle": config["subtitle"],
            "tagline": config["tagline"],
            "documents_root": config["documents_root"],
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        },
        "stats": {
            "file_count": len(documents),
            "folder_count": folder_count,
            "total_size_bytes": total_size,
            "total_size_label": human_size(total_size),
            "latest_update": latest_update,
            "category_counts": dict(category_counts),
        },
        "documents": documents,
    }


def main() -> None:
    if not VIEWER_DIR.exists():
        raise SystemExit("viewer/ is missing")
    if not DOCS_DIR.exists():
        raise SystemExit("documents/ is missing")

    config = load_config()
    reset_dist()
    documents = document_records()
    payload = build_payload(config, documents)
    (DATA_DIR / "documents.json").write_text(
        json.dumps(payload, indent=2),
        encoding="utf-8",
    )
    print(
        f"Built dist/ with {payload['stats']['file_count']} files "
        f"across {payload['stats']['folder_count']} folders"
    )


if __name__ == "__main__":
    main()

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Tuple


def ensure_local_out_dir() -> Path:
    out_dir = os.getenv("LOCAL_OUT_DIR", ".local_out")
    p = Path(out_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def save_bytes_local(data: bytes, suffix: str) -> Tuple[str, Path]:
    out_dir = ensure_local_out_dir() / "contracts"
    out_dir.mkdir(parents=True, exist_ok=True)
    file_id = f"{uuid.uuid4().hex}{suffix}"
    path = out_dir / file_id
    path.write_bytes(data)
    return file_id, path


def get_download_url(file_id: str) -> str:
    base = os.getenv("DOWNLOAD_BASE_URL", "http://localhost:7071/api/download_contract")
    return f"{base}?id={file_id}"

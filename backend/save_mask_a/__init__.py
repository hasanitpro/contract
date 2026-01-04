from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime
import uuid

import azure.functions as func

from src.shared.errors import json_response, error_response
from src.shared.normalize import normalize_mask_a


def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
    except Exception:
        return error_response("Invalid JSON body.", 400)

    mask_a = normalize_mask_a(body if isinstance(body, dict) else {})
    out_dir = Path(".local_out") / "maskA"
    out_dir.mkdir(parents=True, exist_ok=True)

    file_id = f"maskA_{datetime.utcnow().strftime('%Y%m%dT%H%M%S')}_{uuid.uuid4().hex}.json"
    (out_dir / file_id).write_text(json.dumps(mask_a, ensure_ascii=False, indent=2), encoding="utf-8")

    return json_response({"ok": True, "id": file_id})

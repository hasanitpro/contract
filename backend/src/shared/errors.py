from __future__ import annotations

import json
from typing import Any, Dict, Optional

import azure.functions as func


def json_response(payload: Dict[str, Any], status_code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        body=json.dumps(payload, ensure_ascii=False),
        status_code=status_code,
        mimetype="application/json",
    )


def error_response(message: str, status_code: int = 400, *, details: Optional[Dict[str, Any]] = None) -> func.HttpResponse:
    payload: Dict[str, Any] = {"ok": False, "error": message}
    if details:
        payload["details"] = details
    return json_response(payload, status_code=status_code)

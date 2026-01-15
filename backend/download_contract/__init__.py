from __future__ import annotations

import logging
import azure.functions as func
from azure.core.exceptions import ResourceNotFoundError

from src.shared.errors import error_response
from src.shared.storage import read_bytes_blob

_logger = logging.getLogger(__name__)


def main(req: func.HttpRequest) -> func.HttpResponse:
    blob_name = (req.params.get("id") or "").strip()
    if not blob_name:
        return error_response("Missing query param: id", 400)

    try:
        data = read_bytes_blob(blob_name)
    except ResourceNotFoundError:
        return error_response("File not found.", 404)
    except Exception as e:
        _logger.exception("download_contract failed for blob=%s", blob_name)
        return error_response(f"Download failed: {type(e).__name__}: {e}", 500)

    headers = {
        "Content-Disposition": f'attachment; filename="{blob_name}"',
        "Content-Length": str(len(data)),
        "Cache-Control": "no-store",
    }

    return func.HttpResponse(
        body=data,
        status_code=200,
        headers=headers,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

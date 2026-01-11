from __future__ import annotations

import azure.functions as func

from src.shared.errors import json_response, error_response
from src.shared.normalize import normalize_mask_a, normalize_mask_b, apply_defaults
from src.shared.validate import validate_core
from src.shared.mapping import build_render_context
from src.shared.generator_docx import generate_docx_from_template
from src.shared.storage import save_bytes_blob, get_download_url


def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
    except Exception:
        return error_response("Invalid JSON body.", 400)

    if not isinstance(body, dict):
        return error_response("Body must be a JSON object.", 400)

    mask_a = normalize_mask_a(body.get("maskA") or {})
    mask_b = normalize_mask_b(body.get("maskB") or {})

    mask_a, mask_b = apply_defaults(mask_a, mask_b)

    ok, errors = validate_core(mask_a, mask_b)
    if not ok:
        return error_response("Validation failed.", 422, details={"errors": errors})

    ctx = build_render_context(mask_a, mask_b)

    docx_bytes = generate_docx_from_template(
    template_path="templates/base_contract.docx",
    ctx=ctx,
)


    file_id = save_bytes_blob(docx_bytes, suffix=".docx")


    return json_response({
        "ok": True,
        "downloadUrl": get_download_url(file_id),
        "fileId": file_id
    })

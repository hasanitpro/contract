from __future__ import annotations

from pathlib import Path
import azure.functions as func

from src.shared.errors import error_response


def main(req: func.HttpRequest) -> func.HttpResponse:
    file_id = req.params.get("id")
    if not file_id:
        return error_response("Missing query param: id", 400)

    path = Path(".local_out") / "contracts" / file_id
    if not path.exists() or not path.is_file():
        return error_response("File not found.", 404)

    data = path.read_bytes()
    headers = {
        "Content-Disposition": f'attachment; filename="{file_id}"'
    }
    return func.HttpResponse(body=data, status_code=200, headers=headers, mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

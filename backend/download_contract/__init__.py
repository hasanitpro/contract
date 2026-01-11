from __future__ import annotations

import os
import azure.functions as func
from azure.storage.blob import BlobServiceClient

from src.shared.errors import error_response


def main(req: func.HttpRequest) -> func.HttpResponse:
    blob_name = req.params.get("id")
    if not blob_name:
        return error_response("Missing query param: id", 400)

    try:
        service = BlobServiceClient.from_connection_string(
            os.environ["AzureWebJobsStorage"]
        )
        container = os.environ.get(
            "AZURE_STORAGE_CONTAINER_CONTRACTS", "contracts-temp"
        )
        blob = service.get_container_client(container).get_blob_client(blob_name)
        data = blob.download_blob().readall()
    except Exception:
        return error_response("File not found.", 404)

    headers = {
        "Content-Disposition": f'attachment; filename="{blob_name}"'
    }

    return func.HttpResponse(
        body=data,
        status_code=200,
        headers=headers,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

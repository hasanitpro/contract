from __future__ import annotations

import os
import azure.functions as func
from azure.storage.blob import BlobServiceClient

from src.shared.errors import error_response
from src.shared.storage import LOCAL_CONTRACTS_DIR


def main(req: func.HttpRequest) -> func.HttpResponse:
    blob_name = req.params.get("id")
    if not blob_name:
        return error_response("Missing query param: id", 400)

    try:
        if os.environ.get("AzureWebJobsStorage"):
            service = BlobServiceClient.from_connection_string(
                os.environ["AzureWebJobsStorage"]
            )
            container = os.environ.get(
                "AZURE_STORAGE_CONTAINER_CONTRACTS", "contracts-temp"
            )
            blob = service.get_container_client(container).get_blob_client(blob_name)
            data = blob.download_blob().readall()
        else:
            file_path = os.path.join(LOCAL_CONTRACTS_DIR, blob_name)
            with open(file_path, "rb") as handle:
                data = handle.read()
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

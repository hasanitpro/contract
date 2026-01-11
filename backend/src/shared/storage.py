from __future__ import annotations

import os
import uuid
from typing import Tuple
from datetime import datetime, timedelta

from azure.storage.blob import BlobServiceClient, ContentSettings


def _get_blob_service():
    conn = os.environ["AzureWebJobsStorage"]
    return BlobServiceClient.from_connection_string(conn)


def save_bytes_blob(data: bytes, suffix=".docx") -> str:
    """
    Saves file to Azure Blob Storage and returns blob name.
    """
    container = os.environ.get("AZURE_STORAGE_CONTAINER_CONTRACTS", "contracts-temp")
    blob_service = _get_blob_service()
    blob_client = blob_service.get_container_client(container)

    blob_name = f"{uuid.uuid4().hex}{suffix}"
    blob_client.upload_blob(
        name=blob_name,
        data=data,
        overwrite=True,
        content_settings=ContentSettings(
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
    )
    return blob_name


def get_download_url(blob_name: str) -> str:
    """
    Return relative API URL (frontend resolves against API base).
    """
    return f"/api/download_contract?id={blob_name}"

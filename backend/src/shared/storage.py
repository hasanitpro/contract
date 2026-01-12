from __future__ import annotations

import os
import uuid
from typing import Tuple
from datetime import datetime, timedelta

from azure.core.exceptions import ResourceExistsError
from azure.storage.blob import BlobServiceClient, ContentSettings

LOCAL_CONTRACTS_DIR = os.environ.get("LOCAL_CONTRACTS_DIR", "/tmp/contracts-temp")


def _use_azure_storage() -> bool:
    return bool(os.environ.get("AzureWebJobsStorage"))


def _get_blob_service():
    conn = os.environ["AzureWebJobsStorage"]
    return BlobServiceClient.from_connection_string(conn)


def save_bytes_blob(data: bytes, suffix=".docx") -> str:
    """
    Saves file to Azure Blob Storage and returns blob name.
    Falls back to local storage when Azure configuration is missing.
    """
    blob_name = f"{uuid.uuid4().hex}{suffix}"
    if not _use_azure_storage():
        os.makedirs(LOCAL_CONTRACTS_DIR, exist_ok=True)
        file_path = os.path.join(LOCAL_CONTRACTS_DIR, blob_name)
        with open(file_path, "wb") as handle:
            handle.write(data)
        return blob_name

    container = os.environ.get("AZURE_STORAGE_CONTAINER_CONTRACTS", "contracts-temp")
    blob_service = _get_blob_service()
    blob_client = blob_service.get_container_client(container)
    try:
        blob_client.create_container()
    except ResourceExistsError:
        pass

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

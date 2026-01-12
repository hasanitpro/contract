from __future__ import annotations

import os
import uuid
from typing import Tuple
from datetime import datetime, timedelta

from azure.core.exceptions import (
    ResourceExistsError,
    ResourceNotFoundError,
    ServiceRequestError,
)
from azure.storage.blob import BlobServiceClient, ContentSettings

LOCAL_CONTRACTS_DIR = os.environ.get("LOCAL_CONTRACTS_DIR", "/tmp/contracts-temp")


def _use_azure_storage() -> bool:
    return bool(os.environ.get("AzureWebJobsStorage"))


def _get_blob_service():
    conn = os.environ["AzureWebJobsStorage"]
    return BlobServiceClient.from_connection_string(conn)


def _write_local(blob_name: str, data: bytes) -> str:
    os.makedirs(LOCAL_CONTRACTS_DIR, exist_ok=True)
    file_path = os.path.join(LOCAL_CONTRACTS_DIR, blob_name)
    with open(file_path, "wb") as handle:
        handle.write(data)
    return blob_name


def _read_local(blob_name: str) -> bytes:
    file_path = os.path.join(LOCAL_CONTRACTS_DIR, blob_name)
    with open(file_path, "rb") as handle:
        return handle.read()


def save_bytes_blob(data: bytes, suffix=".docx") -> str:
    """
    Saves file to Azure Blob Storage and returns blob name.
    Falls back to local storage when Azure configuration is missing.
    """
    blob_name = f"{uuid.uuid4().hex}{suffix}"
    if not _use_azure_storage():
        return _write_local(blob_name, data)

    container = os.environ.get("AZURE_STORAGE_CONTAINER_CONTRACTS", "contracts-temp")
    blob_service = _get_blob_service()
    blob_client = blob_service.get_container_client(container)
    try:
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
    except ServiceRequestError:
        return _write_local(blob_name, data)


def read_bytes_blob(blob_name: str) -> bytes:
    """
    Read file from Azure Blob Storage or local storage.
    Falls back to local storage when Azure is unavailable.
    """
    if not _use_azure_storage():
        return _read_local(blob_name)

    container = os.environ.get("AZURE_STORAGE_CONTAINER_CONTRACTS", "contracts-temp")
    blob_service = _get_blob_service()
    blob_client = blob_service.get_container_client(container).get_blob_client(blob_name)
    try:
        return blob_client.download_blob().readall()
    except ServiceRequestError:
        return _read_local(blob_name)
    except ResourceNotFoundError:
        if os.path.exists(os.path.join(LOCAL_CONTRACTS_DIR, blob_name)):
            return _read_local(blob_name)
        raise


def get_download_url(blob_name: str) -> str:
    """
    Return relative API URL (frontend resolves against API base).
    """
    return f"/api/download_contract?id={blob_name}"

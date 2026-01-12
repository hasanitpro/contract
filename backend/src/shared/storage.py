from __future__ import annotations

import logging
import os
import threading
import uuid
from time import perf_counter
from typing import Tuple
from datetime import datetime, timedelta

from azure.core.exceptions import (
    HttpResponseError,
    ResourceExistsError,
    ResourceNotFoundError,
    ServiceRequestError,
)
from azure.core.pipeline.policies import RetryPolicy
from azure.core.pipeline.transport import RequestsTransport
from azure.storage.blob import BlobServiceClient, ContentSettings

LOCAL_CONTRACTS_DIR = os.environ.get("LOCAL_CONTRACTS_DIR", "/tmp/contracts-temp")
_container_client = None
_container_created = False
_container_lock = threading.Lock()
_logger = logging.getLogger(__name__)


class _NoHostsRequestsTransport(RequestsTransport):
    def send(self, request, **kwargs):
        kwargs.pop("hosts", None)
        kwargs.pop("location_mode", None)
        return super().send(request, **kwargs)


def _use_azure_storage() -> bool:
    return bool(os.environ.get("AzureWebJobsStorage"))


def _get_blob_service():
    conn = os.environ["AzureWebJobsStorage"]
    api_version = os.environ.get("AZURE_STORAGE_API_VERSION", "2021-12-02")
    retry_policy = RetryPolicy(total_retries=3)
    transport = _NoHostsRequestsTransport(connection_timeout=10, read_timeout=30)
    return BlobServiceClient.from_connection_string(
        conn,
        api_version=api_version,
        retry_policy=retry_policy,
        transport=transport,
    )


def _get_container_client():
    global _container_client
    if _container_client is None:
        container = os.environ.get("AZURE_STORAGE_CONTAINER_CONTRACTS", "contracts-temp")
        _container_client = _get_blob_service().get_container_client(container)
    return _container_client


def _ensure_container_created():
    global _container_created
    if _container_created:
        return
    with _container_lock:
        if _container_created:
            return
        try:
            _get_container_client().create_container()
        except ResourceExistsError:
            pass
        _container_created = True


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

    blob_client = _get_container_client()
    try:
        _ensure_container_created()
        start_time = perf_counter()
        blob_client.upload_blob(
            name=blob_name,
            data=data,
            overwrite=True,
            content_settings=ContentSettings(
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ),
        )
        elapsed = perf_counter() - start_time
        _logger.info("Uploaded blob %s in %.2fs", blob_name, elapsed)
        return blob_name
    except (HttpResponseError, ServiceRequestError):
        return _write_local(blob_name, data)


def read_bytes_blob(blob_name: str) -> bytes:
    """
    Read file from Azure Blob Storage or local storage.
    Falls back to local storage when Azure is unavailable.
    """
    if not _use_azure_storage():
        return _read_local(blob_name)

    blob_client = _get_container_client().get_blob_client(blob_name)
    try:
        start_time = perf_counter()
        payload = blob_client.download_blob().readall()
        elapsed = perf_counter() - start_time
        _logger.info("Downloaded blob %s in %.2fs", blob_name, elapsed)
        return payload
    except (HttpResponseError, ServiceRequestError):
        return _read_local(blob_name)
    except ResourceNotFoundError:
        if os.path.exists(os.path.join(LOCAL_CONTRACTS_DIR, blob_name)):
            return _read_local(blob_name)
        raise


def get_download_url(blob_name: str, request_url: str | None = None) -> str:
    """
    Return download URL for the blob.
    """
    if _use_azure_storage():
        conn = os.environ.get("AzureWebJobsStorage", "")
        if "UseDevelopmentStorage=true" in conn or "UseDevelopmentStorage=True" in conn:
            container = os.environ.get("AZURE_STORAGE_CONTAINER_CONTRACTS", "contracts-temp")
            azurite_endpoint = os.environ.get(
                "AZURITE_BLOB_ENDPOINT",
                "http://127.0.0.1:10000/devstoreaccount1",
            )
            return f"{azurite_endpoint}/{container}/{blob_name}"
    if request_url:
        from urllib.parse import urlsplit

        parts = urlsplit(request_url)
        base_url = f"{parts.scheme}://{parts.netloc}"
        return f"{base_url}/api/download_contract?id={blob_name}"
    return f"/api/download_contract?id={blob_name}"

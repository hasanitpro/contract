# Höfele Contract Automation — Backend (Azure Functions, Python)

This backend matches the frontend endpoints:
- POST /api/save_mask_a
- POST /api/generate_contract
- GET  /api/download_contract?id=<id>

Local dev stores data and generated DOCX in `.local_out/`.

## Quick start (local)
1) Create venv, install deps
2) Run `func start`
3) Frontend can call `http://localhost:7071/api/...`

See `IMPLEMENTATION.md` for step-by-step instructions.

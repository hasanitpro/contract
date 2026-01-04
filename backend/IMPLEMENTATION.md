# Step-by-step implementation guide (beginner friendly)

## 1) Prerequisites
- Python 3.11+ installed
- Azure Functions Core Tools v4 installed
- (Optional) VS Code + Azure Functions extension

## 2) Create and activate a virtual environment
Windows PowerShell:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

## 3) Install dependencies
```bash
pip install -r requirements.txt
```

## 4) Configure local settings
This repo includes `local.settings.json` for local runs.
It writes output to `backend/.local_out/` and serves download links via `/api/download_contract`.

> NOTE: Do not commit real secrets. For production, move secrets to Azure Key Vault.

## 5) Run the Functions host
```bash
func start
```

You should see:
- http://localhost:7071/api/save_mask_a
- http://localhost:7071/api/generate_contract
- http://localhost:7071/api/download_contract

## 6) Test quickly with curl
### Save Mask A
```bash
curl -X POST http://localhost:7071/api/save_mask_a \
  -H "Content-Type: application/json" \
  -d '{"rolle":"Vermieter","vermieter_name":"Max Mustermann"}'
```

### Generate contract
```bash
curl -X POST http://localhost:7071/api/generate_contract \
  -H "Content-Type: application/json" \
  -d '{
    "maskA": {"rolle":"Vermieter","vermieter_name":"Max Mustermann","mieter_name":"Erika Muster","objekt_adresse":"Musterstr. 1, 12345 Musterstadt"},
    "maskB": {"vertragsart":"unbefristet","mietbeginn":"2026-01-01"},
    "templatePath":"source_of_truth/contract-template-annotated.html",
    "placeholderMapping": {}
  }'
```

Response contains:
- `downloadUrl` (open in browser to download DOCX)

## 7) How to integrate Azure Blob Storage later (production)
1) Set these env vars (or use Key Vault):
- `STORAGE_ACCOUNT_URL`
- `STORAGE_CONTAINER_NAME`
- `AZURE_STORAGE_SAS_TOKEN` (or use Managed Identity)
2) Replace `src/shared/storage.py` implementation to upload to Blob and return a SAS URL.

## 8) Where to implement real contract logic
Right now, `generator_docx.py` builds a minimal DOCX to prove the pipeline.
To implement the final lawyer-approved contract:
- Add a DOCX template at `templates/base_contract.docx`
- Implement placeholder replacement + conditional blocks in `src/shared/generator_docx.py`
- Keep all decision/logic in `build_render_context()` (mapping.py)

## 9) Troubleshooting
- If frontend gets CORS errors: run functions with:
  `func start --cors http://localhost:5173 --cors-credentials`
- If port differs: ensure frontend points to the same base URL.

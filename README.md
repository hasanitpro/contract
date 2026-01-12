# Contract Generator App

Beginner-friendly guide to run the app locally and deploy it to **Azure** end-to-end (backend API + frontend UI), including basic testing steps.

## Overview

This repo contains:

- **Backend**: Azure Functions (Python) providing API endpoints for generating/downloading contracts.
- **Frontend**: Vite + React app that calls the backend API.

## Repository Layout

```
backend/   # Azure Functions (Python)
frontend/  # Vite + React UI
```

## Prerequisites

Install these before you start:

- **Git**
- **Node.js 18+** (for the frontend)
- **Python 3.11+** (for Azure Functions)
- **Azure CLI** (`az`)
- **Azure Functions Core Tools v4** (`func`)

Helpful links:

- Azure CLI: https://learn.microsoft.com/cli/azure/install-azure-cli
- Azure Functions Core Tools: https://learn.microsoft.com/azure/azure-functions/functions-run-local

## 1) Clone the repo

```bash
git clone <YOUR_REPO_URL>
cd contract
```

## 2) Run locally (recommended before deploying)

### Backend (Azure Functions)

1. Create and activate a virtual environment:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Configure local settings for Azure Storage:

   ```bash
   cp local.settings.json.example local.settings.json
   ```

   Update `local.settings.json` with either:

   - **Azurite** (local emulator): keep `AzureWebJobsStorage=UseDevelopmentStorage=true` and run Azurite.
   - **Azure Storage**: replace `AzureWebJobsStorage` with a real connection string from your storage account.

   Optionally customize `AZURE_STORAGE_CONTAINER_CONTRACTS` if you want a different container name.
   In Azure, configure the same `AZURE_STORAGE_CONTAINER_CONTRACTS` setting under **Function App → Settings → Configuration → Application settings** and ensure the container exists (or let the app create it) in your Storage Account’s **Containers** blade.

4. Start the local Functions host:

   ```bash
   func start
   ```

5. You should see the host running at `http://localhost:7071`.

### Frontend (Vite + React)

Open a new terminal tab/window:

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

> **Note:** The frontend reads the API base URL from `VITE_API_BASE` (see **Step 7** below). If it is not set, it falls back to `/api`.

## 3) Sign in to Azure

```bash
az login
```

Optional: set your subscription if you have more than one:

```bash
az account set --subscription "<SUBSCRIPTION_ID_OR_NAME>"
```

## 4) Create Azure resources

Pick a unique name prefix for your resources (lowercase, no spaces). Example: `contractdemo`.

```bash
export RESOURCE_GROUP="contract-rg"
export LOCATION="eastus"
export STORAGE_NAME="contractdemo$RANDOM"
export FUNCTION_APP_NAME="contractdemo-func-$RANDOM"
```

Create the resource group:

```bash
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
```

Create a storage account (required by Azure Functions):

```bash
az storage account create \
  --name "$STORAGE_NAME" \
  --location "$LOCATION" \
  --resource-group "$RESOURCE_GROUP" \
  --sku Standard_LRS
```

Fetch the storage connection string (used by the Functions app and blob uploads):

```bash
export STORAGE_CONNECTION_STRING=$(
  az storage account show-connection-string \
    --name "$STORAGE_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query connectionString \
    --output tsv
)
```

Create the Function App:

```bash
az functionapp create \
  --resource-group "$RESOURCE_GROUP" \
  --consumption-plan-location "$LOCATION" \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --name "$FUNCTION_APP_NAME" \
  --storage-account "$STORAGE_NAME"
```

Set required app settings for the Functions app:

```bash
az functionapp config appsettings set \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings \
    "AzureWebJobsStorage=$STORAGE_CONNECTION_STRING" \
    "AZURE_STORAGE_CONTAINER_CONTRACTS=contracts-temp"
```

## 5) Deploy the backend (Azure Functions)

From the `backend/` directory:

```bash
cd backend
func azure functionapp publish "$FUNCTION_APP_NAME"
```

### Deploy with VS Code (optional)

If you prefer a GUI workflow, you can publish the Function App from Visual Studio Code:

1. Install **Visual Studio Code** and the **Azure Functions** extension.
2. Open the `contract` folder in VS Code.
3. Open the Command Palette (**View → Command Palette…**), then run:

   ```
   Azure Functions: Deploy to Function App...
   ```

4. When prompted:
   - Select **Python** runtime if asked.
   - Choose your Azure subscription.
   - Pick the existing Function App: **$FUNCTION_APP_NAME**.
5. Confirm the deployment and wait for the publish to complete.

Once deployed, Azure prints your Function App URL. It looks like:

```
https://<FUNCTION_APP_NAME>.azurewebsites.net
```

Your API endpoints will be under:

```
https://<FUNCTION_APP_NAME>.azurewebsites.net/api/<endpoint>
```

## 6) Azure resource settings (step-by-step)

Use the **Azure Portal** to verify the Function App and Storage Account settings after creation/deployment.

### Function App → Configuration → Application settings

1. Open **Function App** → **Configuration** → **Application settings**.
2. Confirm these app settings exist (or add them):
   - `AzureWebJobsStorage`: Storage connection string for your account (example: `DefaultEndpointsProtocol=https;AccountName=contractdemo1234;AccountKey=...;EndpointSuffix=core.windows.net`).
   - `AZURE_STORAGE_CONTAINER_CONTRACTS`: Container name for uploads (example: `contracts`).
   - `AZURE_STORAGE_API_VERSION`: (optional) override Azure Storage API version (default: `2021-12-02`).
   - Any other required settings used by your functions (compare with `backend/local.settings.json.example`).
3. **Save** and **Restart** the Function App if prompted.

### Function App → CORS

1. Open **Function App** → **CORS**.
2. Add your frontend/Static Website URL (example: `https://contractdemo.z13.web.core.windows.net`).
3. **Save** changes.

### Storage Account → Containers

1. Open **Storage Account** → **Containers**.
2. Confirm the container from `AZURE_STORAGE_CONTAINER_CONTRACTS` exists (example: `contracts`).
   - If it does not exist, the backend will auto-create it on first upload (assuming the storage account key is valid).

> **Callout:** Keep `VITE_API_BASE` aligned with the **deployed Function App URL** (Step 7) so the frontend points to the correct API host.

## 7) Configure the frontend API base URL

The frontend reads the API base URL from `VITE_API_BASE`. Create a `.env` file in `frontend/` (copy from `.env.example`) and set the value to your local or deployed Functions URL.

### Local development

In `frontend/.env`:

```bash
VITE_API_BASE=http://localhost:7071/api
```

### Azure deployment

After deploying the Functions app, set the base URL to:

```bash
VITE_API_BASE=https://<FUNCTION_APP_NAME>.azurewebsites.net/api
```

If `VITE_API_BASE` is not set, the frontend falls back to `/api` (useful if you proxy `/api` to the Functions host).

## 8) Build and deploy the frontend

### Option A: Azure Static Website (Storage Account)

1. Build the production assets:

   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. Enable static website hosting on your storage account:

   ```bash
   az storage blob service-properties update \
     --account-name "$STORAGE_NAME" \
     --static-website \
     --index-document index.html
   ```

3. Upload the build output:

   ```bash
   az storage blob upload-batch \
     --account-name "$STORAGE_NAME" \
     --destination '$web' \
     --source dist
   ```

4. Get the website URL:

   ```bash
   az storage account show \
     --name "$STORAGE_NAME" \
     --resource-group "$RESOURCE_GROUP" \
     --query "primaryEndpoints.web" \
     --output tsv
   ```

Open that URL to view your frontend.

#### Deploy with VS Code (optional)

You can also upload the frontend using the **Azure Storage** VS Code extension:

1. Install the **Azure Storage** extension in VS Code.
2. Build the frontend:

   ```bash
   cd frontend
   npm run build
   ```

3. In VS Code, open the **Azure** sidebar.
4. Expand your subscription → **Storage Accounts** → your `$STORAGE_NAME`.
5. Expand **Blob Containers**, then select the **$web** container.
6. Right‑click **$web** → **Deploy to Static Website**.
7. Select the `frontend/dist` folder when prompted.

VS Code will upload the files; then open the static website URL from Step 8 to verify.

### Option B (optional): Azure Static Web Apps

If you prefer GitHub-based CI/CD, you can use **Azure Static Web Apps** instead. Create the resource in the Azure Portal and link it to your GitHub repo. Point the app to:

- **App location**: `frontend`
- **Output location**: `dist`

## 9) Test the deployment

### Test the backend API

Use `curl` to verify your API is reachable (replace the endpoint name with a real one):

```bash
curl -i "https://<FUNCTION_APP_NAME>.azurewebsites.net/api/<endpoint>"
```

You should see a `200 OK` or a helpful error response.

### Test the frontend

1. Open the frontend URL from Step 8.
2. Perform an action in the UI that calls the backend (for example, generate or download a contract).
3. Confirm that the request succeeds (check the browser network tab for a `200` response).

## Troubleshooting

- **CORS errors**: In Azure Portal → Function App → *API* → **CORS**, add your frontend URL.
- **Function App not running**: Ensure you published from the `backend/` directory and that the app uses Python 3.11.
- **Frontend shows blank screen**: Confirm that `VITE_API_BASE` points to your deployed Function App and that the build was uploaded to `$web`.

## Runbook

### Function dependencies (backend/)

- **generate_contract**
  - Requires `AzureWebJobsStorage` and `AZURE_STORAGE_CONTAINER_CONTRACTS` for blob storage.
  - Uses template file: `backend/templates/base_contract.docx` (mapped from `templatePath=base_contract.docx`).
- **download_contract**
  - Requires `AzureWebJobsStorage` and `AZURE_STORAGE_CONTAINER_CONTRACTS` to fetch the blob.
- **save_mask_a**
  - Writes JSON to `.local_out/maskA/` on the local filesystem.
  - **Note:** this is fine for local development, but Azure Functions file storage is ephemeral. For production, prefer blob storage (or another durable store) instead of relying on `.local_out/`.

### Required Azure App Settings

These settings are required for the functions that read/write blobs:

- `AzureWebJobsStorage` — storage connection string for the Function App.
- `AZURE_STORAGE_CONTAINER_CONTRACTS` — blob container for contract files (default: `contracts-temp`).
- `AZURE_STORAGE_API_VERSION` — optional API version override (default: `2021-12-02`).

### Local settings (backend/local.settings.json)

The example file already includes the required values for local development:

- `AzureWebJobsStorage=UseDevelopmentStorage=true` (for Azurite)
- `AZURE_STORAGE_CONTAINER_CONTRACTS=contracts-temp`
- `FUNCTIONS_WORKER_RUNTIME=python`
- `AZURE_FUNCTIONS_ENVIRONMENT=Development`

### Manual verification checklist (no test execution)

#### Local (Functions Core Tools)

1. Start the host:

   ```bash
   cd backend
   func start
   ```

2. Generate a contract:

   ```bash
   curl -sS -X POST "http://localhost:7071/api/generate_contract" \
     -H "Content-Type: application/json" \
     -d '{"maskA":{},"maskB":{},"templatePath":"base_contract.docx"}'
   ```

   Copy the `fileId` from the response.

3. Download the contract:

   ```bash
   curl -sS -o contract.docx "http://localhost:7071/api/download_contract?id=<fileId>"
   ```

4. Save mask A locally:

   ```bash
   curl -sS -X POST "http://localhost:7071/api/save_mask_a" \
     -H "Content-Type: application/json" \
     -d '{"name":"Example"}'
   ```

   Confirm a new file appears under `backend/.local_out/maskA/`.

#### Azure (deployed Functions app)

1. Generate a contract:

   ```bash
   curl -sS -X POST "https://<FUNCTION_APP_NAME>.azurewebsites.net/api/generate_contract" \
     -H "Content-Type: application/json" \
     -d '{"maskA":{},"maskB":{},"templatePath":"base_contract.docx"}'
   ```

   Copy the `fileId` from the response.

2. Download the contract:

   ```bash
   curl -sS -o contract.docx "https://<FUNCTION_APP_NAME>.azurewebsites.net/api/download_contract?id=<fileId>"
   ```

3. Save mask A (note: currently writes to the function’s local filesystem):

   ```bash
   curl -sS -X POST "https://<FUNCTION_APP_NAME>.azurewebsites.net/api/save_mask_a" \
     -H "Content-Type: application/json" \
     -d '{"name":"Example"}'
   ```

## Cleanup (optional)

To delete everything and avoid charges:

```bash
az group delete --name "$RESOURCE_GROUP" --yes --no-wait
```

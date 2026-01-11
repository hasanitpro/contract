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

3. Start the local Functions host:

   ```bash
   func start
   ```

4. You should see the host running at `http://localhost:7071`.

### Frontend (Vite + React)

Open a new terminal tab/window:

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

> **Note:** The frontend currently calls the API at `http://localhost:7071/api`. When you deploy, you must update that base URL to your Azure Function URL (see **Step 6** below).

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

## 5) Deploy the backend (Azure Functions)

From the `backend/` directory:

```bash
cd backend
func azure functionapp publish "$FUNCTION_APP_NAME"
```

Once deployed, Azure prints your Function App URL. It looks like:

```
https://<FUNCTION_APP_NAME>.azurewebsites.net
```

Your API endpoints will be under:

```
https://<FUNCTION_APP_NAME>.azurewebsites.net/api/<endpoint>
```

## 6) Update the frontend API base URL

The frontend currently uses a local URL. Update it to the Azure Functions URL.

In `frontend/src/App.jsx`, change:

```js
const API_BASE = "http://localhost:7071/api";
```

to:

```js
const API_BASE = "https://<FUNCTION_APP_NAME>.azurewebsites.net/api";
```

> Tip: For production, you can also switch this to a Vite environment variable (e.g. `import.meta.env.VITE_API_BASE`).

## 7) Build and deploy the frontend

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

### Option B (optional): Azure Static Web Apps

If you prefer GitHub-based CI/CD, you can use **Azure Static Web Apps** instead. Create the resource in the Azure Portal and link it to your GitHub repo. Point the app to:

- **App location**: `frontend`
- **Output location**: `dist`

## 8) Test the deployment

### Test the backend API

Use `curl` to verify your API is reachable (replace the endpoint name with a real one):

```bash
curl -i "https://<FUNCTION_APP_NAME>.azurewebsites.net/api/<endpoint>"
```

You should see a `200 OK` or a helpful error response.

### Test the frontend

1. Open the frontend URL from Step 7.
2. Perform an action in the UI that calls the backend (for example, generate or download a contract).
3. Confirm that the request succeeds (check the browser network tab for a `200` response).

## Troubleshooting

- **CORS errors**: In Azure Portal → Function App → *API* → **CORS**, add your frontend URL.
- **Function App not running**: Ensure you published from the `backend/` directory and that the app uses Python 3.11.
- **Frontend shows blank screen**: Confirm that `API_BASE` points to your deployed Function App and that the build was uploaded to `$web`.

## Cleanup (optional)

To delete everything and avoid charges:

```bash
az group delete --name "$RESOURCE_GROUP" --yes --no-wait
```

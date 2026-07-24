# Klima Deployment Guide

This document outlines the deployment strategy for the Klima Full-Stack Application, using Cloudflare Pages for the frontend and Cloudflare Workers for the backend.

## Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed globally (`npm install -g wrangler`)
- Cloudflare Account with an active API Token
- GitHub Repository (for CI/CD with GitHub Actions)

## 1. Backend Deployment (Cloudflare Workers)

The FastAPI backend is deployed to Cloudflare's edge network for ultra-low latency using Cloudflare Workers.

### Local Development
1. Navigate to the `backend` directory.
2. Create a virtual environment: `python -m venv venv && source venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Run locally (if not using wrangler dev): `uvicorn main:app --reload`
5. Test with Wrangler: `wrangler dev`

### Production Deployment
1. Ensure your `wrangler.toml` is correctly configured in the `backend` directory.
2. Authenticate Wrangler (if not already done): `wrangler login`
3. Deploy to production: `wrangler deploy`

## 2. Frontend Deployment (Cloudflare Pages)

The React + Tailwind CSS frontend is deployed to Cloudflare Pages.

### Local Development
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`

### Production Deployment
1. Build the production assets: `npm run build`
2. Deploy the `dist` directory to Cloudflare Pages:
   ```bash
   wrangler pages deploy dist --project-name klima-frontend
   ```

## 3. CI/CD Pipeline (GitHub Actions)

We use GitHub Actions to automate deployments whenever code is pushed to the `main` branch. 

### GitHub Secrets Configuration
Ensure the following secrets are added to your GitHub repository:
- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API Token (must have edit permissions for Workers and Pages).
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID.

### Workflow Overview (`.github/workflows/deploy.yml`)
1. **Frontend Job**: 
   - Checks out the code.
   - Installs Node.js dependencies and builds the React app.
   - Uses `cloudflare/pages-action` to deploy the built assets.
2. **Backend Job**:
   - Checks out the code.
   - Uses `cloudflare/wrangler-action` to deploy the FastAPI app as a Worker.

By committing to the `main` branch, the GitHub Action will automatically trigger and deploy both the frontend and backend.

# Klima Backend Testing Guide (Cloudflare Workers)

This document provides a step-by-step guide for testing the FastAPI backend **strictly through Cloudflare Workers**—both locally using Wrangler worker emulation and on live Cloudflare Workers deployment.

---

## 1. Local Testing via Cloudflare Workers (`wrangler dev`)

To test the backend worker locally on your machine using Cloudflare's exact edge runtime emulator:

### Step 1: Start Wrangler Local Worker Emulator
In your terminal at the root of `Klima`, run:
```bash
npx wrangler dev
```
> **Local Worker URL:** `http://localhost:8787` or `http://127.0.0.1:8787`

---

## 2. API Endpoints Test Suite (Cloudflare Workers Local & Live)

Replace `http://localhost:8787` with your live Cloudflare Worker URL (e.g., `https://klima-backend.<your-subdomain>.workers.dev`) when testing production.

### Endpoint 1: Edge Worker Health Check
* **Method:** `GET`
* **cURL Command:**
  ```bash
  curl -X GET "http://localhost:8787/"
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "status": "online",
    "service": "Klima Climate Refuge Engine",
    "edge_runtime": "Cloudflare Workers"
  }
  ```

---

### Endpoint 2: Primary Climate Refuge Ranking (`/api/v1/refuges`)
Consolidates WeatherAPI, TomTom Search, BestTime.app crowds, OpenRouteService walking routes, and Open-Elevation data on Cloudflare Workers edge.

* **Method:** `GET`
* **Parameters:**
  - `lat` (float, required): User latitude (e.g., `13.118022`)
  - `lon` (float, required): User longitude (e.g., `77.641051`)
  - `radius` (int, optional): Search radius in meters (default: `2000`)
* **cURL Command:**
  ```bash
  curl -X GET "http://localhost:8787/api/v1/refuges?lat=13.118022&lon=77.641051&radius=2000"
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "current_weather": {
      "temp_c": 38.5,
      "feelslike_c": 42.0,
      "heat_index_c": 43.2,
      "aqi": 156,
      "condition": "Clear"
    },
    "top_refuges": [
      {
        "id": "loc_1",
        "name": "Central City Library",
        "category": "Library",
        "address": "124 Civic Center Plaza",
        "lat": 13.121022,
        "lon": 77.643051,
        "score": 92.4,
        "distance_m": 412.5,
        "duration_min": 4.9,
        "crowd_level": "Low",
        "elevation_m": 18.5,
        "indoor_cooling": true,
        "polyline": [
          [13.118022, 77.641051],
          [13.119522, 77.642051],
          [13.121022, 77.643051]
        ]
      },
      {
        "id": "loc_3",
        "name": "Community Recreation Hub",
        "category": "Community Center",
        "address": "88 Park Avenue",
        "lat": 13.119022,
        "lon": 77.635051,
        "score": 87.1,
        "distance_m": 670.0,
        "duration_min": 8.0,
        "crowd_level": "Moderate",
        "elevation_m": 22.0,
        "indoor_cooling": true,
        "polyline": [...]
      },
      {
        "id": "loc_2",
        "name": "Metropolitan Underground Station",
        "category": "Transit Station",
        "address": "45 Main Street",
        "lat": 13.114022,
        "lon": 77.646051,
        "score": 74.0,
        "distance_m": 720.0,
        "duration_min": 8.6,
        "crowd_level": "High",
        "elevation_m": 12.0,
        "indoor_cooling": true,
        "polyline": [...]
      }
    ]
  }
  ```

---

### Endpoint 3: Live Weather Lookup (`/api/v1/weather`)
* **Method:** `GET`
* **cURL Command:**
  ```bash
  curl -X GET "http://localhost:8787/api/v1/weather?lat=13.118022&lon=77.641051"
  ```

---

### Endpoint 4: Facilities Discovery (`/api/v1/facilities`)
* **Method:** `GET`
* **cURL Command:**
  ```bash
  curl -X GET "http://localhost:8787/api/v1/facilities?lat=13.118022&lon=77.641051&radius=2000"
  ```

---

## 3. Live Cloudflare Worker Verification

To deploy directly to Cloudflare Workers from CLI (or via GitHub Actions):
```bash
npx wrangler deploy
```

Once deployed, test using your worker endpoint:
```bash
curl -X GET "https://klima-backend.<YOUR-SUBDOMAIN>.workers.dev/api/v1/refuges?lat=13.118022&lon=77.641051"
```

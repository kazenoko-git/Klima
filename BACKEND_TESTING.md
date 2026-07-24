# Klima Backend Testing Guide (Cloudflare Workers)

This document provides a step-by-step guide for testing the FastAPI backend **strictly through Cloudflare Workers**—both locally using Wrangler worker emulation and on our live deployed Cloudflare Worker edge instance.

---

## 1. Production Live Cloudflare Worker URL

Our backend is deployed live on Cloudflare Workers edge network:
* **Base URL:** `https://klima-backend.kazenoko-main.workers.dev`

---

## 2. API Endpoints Test Suite (Cloudflare Workers Live & Local)

You can run these exact cURL commands against the live production worker URL or locally using `npx wrangler dev` (`http://localhost:8787`).

### Endpoint 1: Edge Worker Health Check
* **Method:** `GET`
* **cURL Command:**
  ```bash
  curl -X GET "https://klima-backend.kazenoko-main.workers.dev/"
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
  curl -X GET "https://klima-backend.kazenoko-main.workers.dev/api/v1/refuges?lat=13.118022&lon=77.641051&radius=2000"
  ```
* **Verified Live Response (`200 OK`):**
  ```json
  {
    "current_weather": {
      "temp_c": 25.3,
      "feelslike_c": 26.2,
      "heat_index_c": 27.5,
      "aqi": 35,
      "condition": "Partly cloudy"
    },
    "top_refuges": [
      {
        "id": "tomtom_niAmYW4C0kUt32j8tHrpsQ",
        "name": "Delhi Public School",
        "category": "high school",
        "address": "35/1A, Bagalur Cross Road, Bagalur, Bengaluru 562149, Karnataka",
        "lat": 13.118699,
        "lon": 77.641793,
        "score": 79.4,
        "distance_m": 110.1,
        "duration_min": 1.3,
        "crowd_level": "Moderate",
        "elevation_m": 931.0,
        "indoor_cooling": true,
        "polyline": [
          [13.118022, 77.641051],
          [13.1183605, 77.641422],
          [13.118699, 77.641793]
        ]
      },
      {
        "id": "tomtom_JpPe0L6Cm6yUtBvmQH0BTw",
        "name": "Westline Public School",
        "category": "high school",
        "address": "1St Main Bande Road, Srinivaspur, Tirumanahalli, Bengaluru 560064, Karnataka",
        "lat": 13.104045,
        "lon": 77.633575,
        "score": 71.2,
        "distance_m": 1752.4,
        "duration_min": 20.9,
        "crowd_level": "Moderate",
        "elevation_m": 921.0,
        "indoor_cooling": true,
        "polyline": [...]
      },
      {
        "id": "tomtom_iWNW4vw4PaMLGjm40eV6BA",
        "name": "Lumbini International Public School",
        "category": "pre school",
        "address": "52/1, Palanahalli Road, Srinivaspur, Tirumanahalli, Bengaluru 560064, Karnataka",
        "lat": 13.116028,
        "lon": 77.624724,
        "score": 71.1,
        "distance_m": 1782.0,
        "duration_min": 21.2,
        "crowd_level": "Moderate",
        "elevation_m": 908.0,
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
  curl -X GET "https://klima-backend.kazenoko-main.workers.dev/api/v1/weather?lat=13.118022&lon=77.641051"
  ```

---

### Endpoint 4: Facilities Discovery (`/api/v1/facilities`)
* **Method:** `GET`
* **cURL Command:**
  ```bash
  curl -X GET "https://klima-backend.kazenoko-main.workers.dev/api/v1/facilities?lat=13.118022&lon=77.641051&radius=2000"
  ```

---

## 3. Local Emulator Testing (`npx wrangler dev`)

To test locally using Cloudflare's Wrangler emulator:
1. Run `npx wrangler dev` in terminal.
2. Replace `https://klima-backend.kazenoko-main.workers.dev` with `http://localhost:8787` in any of the cURL commands above.

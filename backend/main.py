from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

from backend.models.schemas import RefugeResponse
from backend.services.optimizer import calculate_and_rank_refuges
from backend.services.integrations import fetch_weather_data, fetch_tomtom_facilities

# Explicitly define core FastAPI application instance for Cloudflare Worker & ASGI runtime
app = FastAPI(
    title="Klima Climate Refuge API",
    description="Emergency environmental mapping service for identifying optimal safe zones during extreme weather.",
    version="1.0.0"
)

# Enable CORS for Cloudflare Pages frontend and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    """Health check endpoint for Cloudflare Worker deployment."""
    return {"status": "online", "service": "Klima Climate Refuge Engine", "edge_runtime": "Cloudflare Workers"}

@app.get("/api/v1/refuges", response_model=RefugeResponse)
async def get_top_refuges(
    lat: float = Query(..., description="Latitude of user location"),
    lon: float = Query(..., description="Longitude of user location"),
    radius: int = Query(2000, description="Search radius in meters")
):
    """
    Primary Core Endpoint: Consolidates WeatherAPI, TomTom, BestTime, OpenRoute, and Open-Elevation data.
    Returns the top 3 climate refuges sorted by AI safety score.
    """
    try:
        return await calculate_and_rank_refuges(user_lat=lat, user_lon=lon, radius_m=radius)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate climate refuges: {str(e)}")

@app.get("/api/v1/weather")
async def get_weather(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude")
):
    """Auxiliary Endpoint: Fetches live weather, Heat Index, and AQI for a given location."""
    try:
        return await fetch_weather_data(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch weather: {str(e)}")

@app.get("/api/v1/facilities")
async def get_facilities(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius: int = Query(2000, description="Search radius in meters")
):
    """Auxiliary Endpoint: Fetches nearby public facilities within search radius."""
    try:
        return await fetch_tomtom_facilities(lat, lon, radius)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch facilities: {str(e)}")

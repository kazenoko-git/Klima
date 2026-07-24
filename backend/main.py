from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.models.schemas import RefugeResponse
from backend.services.optimizer import calculate_and_rank_refuges

# Explicitly instantiate the core FastAPI app instance
app = FastAPI(
    title="Klima Climate Refuge API",
    description="Emergency environmental mapping service for identifying optimal safe zones during extreme weather.",
    version="1.0.0"
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    """Simple health check endpoint."""
    return {"status": "online", "message": "Klima Climate Refuge Engine Active"}

@app.get("/api/v1/refuges", response_model=RefugeResponse)
async def get_top_refuges(
    lat: float = Query(..., description="Latitude of user current location"),
    lon: float = Query(..., description="Longitude of user current location"),
    radius: int = Query(2000, description="Search radius in meters")
):
    """
    Primary Endpoint: Consolidates WeatherAPI, TomTom, BestTime, OpenRoute, and Open-Elevation data.
    Returns the top 3 climate refuges sorted by AI safety score.
    """
    try:
        response = await calculate_and_rank_refuges(user_lat=lat, user_lon=lon, radius_m=radius)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate refuges: {str(e)}")

# Serve static frontend files if static directory exists
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

import json
import urllib.parse

try:
    from backend.models.schemas import RefugeResponse
    from backend.services.optimizer import calculate_and_rank_refuges
    from backend.services.integrations import fetch_weather_data, fetch_tomtom_facilities
except ImportError:
    from models.schemas import RefugeResponse
    from services.optimizer import calculate_and_rank_refuges
    from services.integrations import fetch_weather_data, fetch_tomtom_facilities

# Safely import FastAPI if available in local environment
try:
    from fastapi import FastAPI, Query, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    
    app = FastAPI(
        title="Klima Climate Refuge API",
        description="Emergency environmental mapping service for identifying optimal safe zones during extreme weather.",
        version="1.0.0"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    def health_check():
        return {"status": "online", "service": "Klima Climate Refuge Engine", "edge_runtime": "Cloudflare Workers"}

    @app.get("/api/v1/refuges", response_model=RefugeResponse)
    async def get_top_refuges(
        lat: float = Query(..., description="Latitude"),
        lon: float = Query(..., description="Longitude"),
        radius: int = Query(2000, description="Search radius in meters")
    ):
        try:
            return await calculate_and_rank_refuges(user_lat=lat, user_lon=lon, radius_m=radius)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to calculate refuges: {str(e)}")

    @app.get("/api/v1/weather")
    async def get_weather(lat: float = Query(...), lon: float = Query(...)):
        try:
            return await fetch_weather_data(lat, lon)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Weather fetch failed: {str(e)}")

    @app.get("/api/v1/facilities")
    async def get_facilities(lat: float = Query(...), lon: float = Query(...), radius: int = Query(2000)):
        try:
            return await fetch_tomtom_facilities(lat, lon, radius)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Facilities fetch failed: {str(e)}")
except ImportError:
    app = None

# Native Cloudflare Workers Entry Point
async def on_fetch(request, env=None):
    """
    Cloudflare Workers Native Entry Point.
    """
    try:
        from js import Response, Headers
    except ImportError:
        pass

    url_str = str(request.url)
    parsed = urllib.parse.urlparse(url_str)
    path = parsed.path
    query = urllib.parse.parse_qs(parsed.query)

    headers = Headers.new() if 'Headers' in locals() else {}
    if hasattr(headers, 'set'):
        headers.set("Access-Control-Allow-Origin", "*")
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        headers.set("Access-Control-Allow-Headers", "*")
        headers.set("Content-Type", "application/json")

    def make_response(body_dict, status=200):
        body_str = json.dumps(body_dict)
        try:
            from js import Response
            return Response.new(body_str, status=status, headers=headers)
        except Exception:
            return body_str

    if request.method == "OPTIONS":
        return make_response({}, status=200)

    if path == "/" or path == "":
        return make_response({"status": "online", "service": "Klima Climate Refuge Engine", "edge_runtime": "Cloudflare Workers"})

    try:
        if path == "/api/v1/refuges":
            lat = float(query.get("lat", [13.118022])[0])
            lon = float(query.get("lon", [77.641051])[0])
            radius = int(query.get("radius", [2000])[0])

            res_data = await calculate_and_rank_refuges(lat, lon, radius)
            dict_data = res_data.model_dump() if hasattr(res_data, 'model_dump') else (res_data.dict() if hasattr(res_data, 'dict') else res_data)
            return make_response(dict_data)

        if path == "/api/v1/weather":
            lat = float(query.get("lat", [13.118022])[0])
            lon = float(query.get("lon", [77.641051])[0])
            res_data = await fetch_weather_data(lat, lon)
            return make_response(res_data)

        if path == "/api/v1/facilities":
            lat = float(query.get("lat", [13.118022])[0])
            lon = float(query.get("lon", [77.641051])[0])
            radius = int(query.get("radius", [2000])[0])
            res_data = await fetch_tomtom_facilities(lat, lon, radius)
            return make_response(res_data)
    except Exception as exc:
        return make_response({"error": str(exc)}, status=500)

    return make_response({"error": "Not Found"}, status=404)

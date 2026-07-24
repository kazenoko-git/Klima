import logging
import json
from typing import List, Dict, Any

try:
    from config import settings
except ImportError:
    from backend.config import settings

logger = logging.getLogger("klima.integrations")

async def async_http_get(url: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    if params:
        query_str = "&".join([f"{k}={v}" for k, v in params.items()])
        full_url = f"{url}?{query_str}"
    else:
        full_url = url

    try:
        from js import fetch
        response = await fetch(full_url)
        text = await response.text()
        return json.loads(text)
    except Exception:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(url, params=params)
            return res.json()

async def async_http_post(url: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    try:
        from js import fetch, Headers
        headers = Headers.new()
        headers.set("Content-Type", "application/x-www-form-urlencoded")
        
        query_str = "&".join([f"{k}={v}" for k, v in params.items()]) if params else ""
        
        options = {
            "method": "POST",
            "body": query_str,
            "headers": headers
        }
        from js import Object
        js_options = Object.fromEntries(options.items()) if hasattr(Object, "fromEntries") else options
        response = await fetch(url, js_options)
        text = await response.text()
        return json.loads(text)
    except Exception:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.post(url, params=params)
            return res.json()

async def fetch_weather_data(lat: float, lon: float) -> Dict[str, Any]:
    if not getattr(settings, "WEATHER_API_KEY", None):
        return {
            "temp_c": 38.5,
            "feelslike_c": 42.0,
            "heat_index_c": 43.2,
            "aqi": 156,
            "condition": "Extreme Heat",
            "is_raining": False
        }

    url = "http://api.weatherapi.com/v1/current.json"
    params = {
        "key": settings.WEATHER_API_KEY,
        "q": f"{lat},{lon}",
        "aqi": "yes"
    }

    try:
        data = await async_http_get(url, params)
        current = data.get("current", {})
        air_quality = current.get("air_quality", {})
        
        aqi_val = int(air_quality.get("us-epa-index", 3) * 35)
        condition_text = current.get("condition", {}).get("text", "").lower()
        is_raining = "rain" in condition_text or "storm" in condition_text or current.get("precip_mm", 0) > 0.5
        
        return {
            "temp_c": current.get("temp_c", 35.0),
            "feelslike_c": current.get("feelslike_c", 38.0),
            "heat_index_c": current.get("heatindex_c", current.get("feelslike_c", 38.0)),
            "aqi": aqi_val,
            "condition": current.get("condition", {}).get("text", "Clear"),
            "is_raining": is_raining
        }
    except Exception as e:
        logger.error(f"WeatherAPI fetch error: {e}")

    return {
        "temp_c": 38.5,
        "feelslike_c": 42.0,
        "heat_index_c": 43.2,
        "aqi": 156,
        "condition": "Sunny",
        "is_raining": False
    }

async def fetch_tomtom_facilities(lat: float, lon: float, radius_m: int = 2000) -> List[Dict[str, Any]]:
    if not getattr(settings, "TOMTOM_API_KEY", None):
        return [
            {"id": "loc_1", "name": "Central City Library", "category": "Library", "address": "124 Civic Center Plaza", "lat": lat + 0.003, "lon": lon + 0.002, "indoor_cooling": True},
            {"id": "loc_2", "name": "Metropolitan Underground Station", "category": "Transit Station", "address": "45 Main Street", "lat": lat - 0.004, "lon": lon + 0.005, "indoor_cooling": True},
            {"id": "loc_3", "name": "Community Recreation & Cooling Hub", "category": "Community Center", "address": "88 Park Avenue", "lat": lat + 0.001, "lon": lon - 0.006, "indoor_cooling": True}
        ]

    url = f"https://api.tomtom.com/search/2/poiSearch/public.json"
    params = {
        "key": settings.TOMTOM_API_KEY,
        "lat": lat,
        "lon": lon,
        "radius": radius_m,
        "limit": 10
    }

    try:
        data = await async_http_get(url, params)
        results = data.get("results", [])
        facilities = []
        for idx, res in enumerate(results):
            poi = res.get("poi", {})
            pos = res.get("position", {})
            facilities.append({
                "id": f"tomtom_{res.get('id', idx)}",
                "name": poi.get("name", "Public Refuge Facility"),
                "category": poi.get("categories", ["Safe Space"])[0] if poi.get("categories") else "Public Facility",
                "address": res.get("address", {}).get("freeformAddress", "Nearby Safe Zone"),
                "lat": pos.get("lat", lat),
                "lon": pos.get("lon", lon),
                "indoor_cooling": True
            })
        if facilities:
            return facilities
    except Exception as e:
        logger.error(f"TomTom API fetch error: {e}")

    return [
        {"id": "loc_1", "name": "Central City Library", "category": "Library", "address": "124 Civic Center Plaza", "lat": lat + 0.003, "lon": lon + 0.002, "indoor_cooling": True},
        {"id": "loc_2", "name": "Metropolitan Underground Station", "category": "Transit Station", "address": "45 Main Street", "lat": lat - 0.004, "lon": lon + 0.005, "indoor_cooling": True},
        {"id": "loc_3", "name": "Community Recreation Hub", "category": "Community Center", "address": "88 Park Avenue", "lat": lat + 0.001, "lon": lon - 0.006, "indoor_cooling": True}
    ]

async def fetch_besttime_crowds(venue_name: str) -> str:
    if not getattr(settings, "BESTTIME_API_KEY", None):
        levels = ["Low", "Moderate", "High"]
        return levels[len(venue_name) % 3]

    url = "https://besttime.app/api/v1/forecasts/live"
    params = {
        "api_key_private": settings.BESTTIME_API_KEY,
        "venue_name": venue_name
    }

    try:
        data = await async_http_post(url, params)
        busyness = data.get("analysis", {}).get("venue_forecasted_busyness", 50)
        if busyness < 40:
            return "Low"
        elif busyness < 75:
            return "Moderate"
        else:
            return "High"
    except Exception as e:
        logger.error(f"BestTime API fetch error: {e}")

    return "Moderate"

async def fetch_walking_route(start_lat: float, start_lon: float, end_lat: float, end_lon: float) -> Dict[str, Any]:
    import math
    R = 6371000
    phi1 = math.radians(start_lat)
    phi2 = math.radians(end_lat)
    delta_phi = math.radians(end_lat - start_lat)
    delta_lambda = math.radians(end_lon - start_lon)

    a = math.sin(delta_phi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    dist_m = R * c
    duration_min = round((dist_m / 84.0), 1)

    polyline = [
        [start_lat, start_lon],
        [(start_lat + end_lat) / 2, (start_lon + end_lon) / 2],
        [end_lat, end_lon]
    ]

    return {
        "distance_m": round(dist_m, 1),
        "duration_min": max(1.0, duration_min),
        "polyline": polyline
    }

async def fetch_elevation(lat: float, lon: float) -> float:
    url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lon}"
    try:
        data = await async_http_get(url)
        results = data.get("results", [])
        if results:
            return float(results[0].get("elevation", 15.0))
    except Exception as e:
        logger.error(f"Open-Elevation fetch error: {e}")

    return 18.5

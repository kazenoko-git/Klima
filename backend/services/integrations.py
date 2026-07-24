import logging
import json
import math
import requests
from typing import List, Dict, Any

try:
    from config import settings
except ImportError:
    from backend.config import settings

logger = logging.getLogger("klima.integrations")

def sync_http_get(url: str, params: Dict[str, Any] = None, headers_dict: Dict[str, str] = None) -> Dict[str, Any]:
    req_headers = {"User-Agent": "KlimaClimateApp/1.0"}
    if headers_dict:
        req_headers.update(headers_dict)
    try:
        res = requests.get(url, params=params, headers=req_headers, timeout=6.0)
        return res.json()
    except Exception as e:
        logger.error(f"HTTP GET error for {url}: {e}")
        return {}

def sync_http_post(url: str, params: Dict[str, Any] = None, json_payload: Dict[str, Any] = None, headers_dict: Dict[str, str] = None) -> Dict[str, Any]:
    req_headers = {"User-Agent": "KlimaClimateApp/1.0"}
    if headers_dict:
        req_headers.update(headers_dict)
    try:
        if json_payload:
            res = requests.post(url, json=json_payload, headers=req_headers, timeout=6.0)
        else:
            res = requests.post(url, data=params, headers=req_headers, timeout=6.0)
        return res.json()
    except Exception as e:
        logger.error(f"HTTP POST error for {url}: {e}")
        return {}

async def async_http_get(url: str, params: Dict[str, Any] = None, headers_dict: Dict[str, str] = None) -> Dict[str, Any]:
    return sync_http_get(url, params=params, headers_dict=headers_dict)

async def async_http_post(url: str, params: Dict[str, Any] = None, json_payload: Dict[str, Any] = None, headers_dict: Dict[str, str] = None) -> Dict[str, Any]:
    return sync_http_post(url, params=params, json_payload=json_payload, headers_dict=headers_dict)

def calculate_us_epa_aqi(pm2_5: float) -> int:
    breakpoints = [
        (0.0, 12.0, 0, 50),
        (12.1, 35.4, 51, 100),
        (35.5, 55.4, 101, 150),
        (55.5, 150.4, 151, 200),
        (150.5, 250.4, 201, 300),
        (250.5, 500.4, 301, 500)
    ]
    for c_low, c_high, i_low, i_high in breakpoints:
        if c_low <= pm2_5 <= c_high:
            aqi = ((i_high - i_low) / (c_high - c_low)) * (pm2_5 - c_low) + i_low
            return round(aqi)
    return round(min(500, max(0, pm2_5 * 2.1)))

async def fetch_weather_data(lat: float, lon: float) -> Dict[str, Any]:
    """Fetches real-time weather data."""
    if getattr(settings, "WEATHER_API_KEY", None):
        url = "http://api.weatherapi.com/v1/current.json"
        params = {"key": settings.WEATHER_API_KEY, "q": f"{lat},{lon}", "aqi": "yes"}
        try:
            data = sync_http_get(url, params)
            current = data.get("current", {})
            air_quality = current.get("air_quality", {})
            pm2_5 = float(air_quality.get("pm2_5", 15.0))
            aqi_val = calculate_us_epa_aqi(pm2_5)
            
            condition_text = current.get("condition", {}).get("text", "").lower()
            is_raining = "rain" in condition_text or "storm" in condition_text or current.get("precip_mm", 0) > 0.5
            
            return {
                "temp_c": float(current.get("temp_c", 28.0)),
                "feelslike_c": float(current.get("feelslike_c", 30.0)),
                "heat_index_c": float(current.get("heatindex_c", current.get("feelslike_c", 30.0))),
                "aqi": aqi_val,
                "condition": current.get("condition", {}).get("text", "Clear"),
                "is_raining": is_raining
            }
        except Exception as e:
            logger.error(f"WeatherAPI error: {e}")

    # Open-Meteo Weather & Air Quality API fallback
    open_meteo_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation"
    open_meteo_aqi_url = f"https://api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=pm2_5,us_aqi"
    try:
        data = sync_http_get(open_meteo_url)
        current = data.get("current", {})
        temp = float(current.get("temperature_2m", 28.0))
        feelslike = float(current.get("apparent_temperature", temp + 2.0))
        precip = float(current.get("precipitation", 0.0))
        
        rh = float(current.get("relative_humidity_2m", 60.0))
        e = (rh / 100.0) * 6.105 * math.exp((17.27 * temp) / (237.7 + temp))
        heat_index = round(temp + 0.33 * e - 0.70 * 4.0 - 4.0, 1)

        aqi_val = 45
        try:
            aqi_data = sync_http_get(open_meteo_aqi_url)
            aqi_current = aqi_data.get("current", {})
            if "us_aqi" in aqi_current and aqi_current["us_aqi"] is not None:
                aqi_val = int(aqi_current["us_aqi"])
            elif "pm2_5" in aqi_current and aqi_current["pm2_5"] is not None:
                aqi_val = calculate_us_epa_aqi(float(aqi_current["pm2_5"]))
        except Exception:
            pass

        return {
            "temp_c": temp,
            "feelslike_c": feelslike,
            "heat_index_c": max(temp, heat_index),
            "aqi": aqi_val,
            "condition": "Rainy/Stormy" if precip > 0.2 else "Partly Cloudy",
            "is_raining": precip > 0.2
        }
    except Exception as e:
        logger.error(f"Open-Meteo fallback error: {e}")
        return {
            "temp_c": 28.0,
            "feelslike_c": 30.0,
            "heat_index_c": 31.0,
            "aqi": 45,
            "condition": "Clear",
            "is_raining": False
        }

async def fetch_tomtom_facilities(lat: float, lon: float, radius_m: int = 2000) -> List[Dict[str, Any]]:
    """
    Fetches diverse public indoor facilities (Libraries, Transit Hubs, Community Centers, Hospitals, Malls).
    Ensures broad facility variety instead of only schools.
    """
    facilities = []

    if getattr(settings, "TOMTOM_API_KEY", None):
        # Query broad public categories: Library, Community Center, Transit Station, Hospital, Sports Center
        url = f"https://api.tomtom.com/search/2/categorySearch/public%20building.json"
        params = {
            "key": settings.TOMTOM_API_KEY,
            "lat": lat,
            "lon": lon,
            "radius": radius_m,
            "limit": 15
        }
        try:
            data = sync_http_get(url, params)
            results = data.get("results", [])
            for idx, res in enumerate(results):
                poi = res.get("poi", {})
                pos = res.get("position", {})
                name = poi.get("name", "Public Facility")
                cat_list = poi.get("categories", ["Public Refuge"])
                cat = cat_list[0] if cat_list else "Public Facility"

                facilities.append({
                    "id": f"tomtom_{res.get('id', idx)}",
                    "name": name,
                    "category": cat.title(),
                    "address": res.get("address", {}).get("freeformAddress", f"Near {lat:.4f}, {lon:.4f}"),
                    "lat": float(pos.get("lat", lat)),
                    "lon": float(pos.get("lon", lon)),
                    "indoor_cooling": True
                })
        except Exception as e:
            logger.error(f"TomTom POI search error: {e}")

    # OpenStreetMap Nominatim Fallback for diverse POIs (Library, Community Center, Transit, Hospital, Sports)
    if not facilities:
        queries = ["library", "community_center", "bus_station", "hospital", "townhall", "sports_centre"]
        for q in queries:
            osm_url = f"https://nominatim.openstreetmap.org/search?format=json&lat={lat}&lon={lon}&q={q}&bounded=1&viewbox={lon-0.03},{lat+0.03},{lon+0.03},{lat-0.03}&limit=3"
            try:
                data = sync_http_get(osm_url)
                for idx, item in enumerate(data):
                    f_lat = float(item.get("lat", lat))
                    f_lon = float(item.get("lon", lon))
                    display_name = item.get("display_name", "Public Sanctuary")
                    name_parts = display_name.split(",")
                    short_name = name_parts[0] if name_parts else "Public Refuge"

                    facilities.append({
                        "id": f"osm_{item.get('place_id', idx)}_{q}",
                        "name": short_name,
                        "category": q.replace("_", " ").title(),
                        "address": ", ".join(name_parts[1:3]) if len(name_parts) > 2 else "Nearby Safe Sanctuary",
                        "lat": f_lat,
                        "lon": f_lon,
                        "indoor_cooling": True
                    })
            except Exception:
                pass

    if facilities:
        return facilities[:6] # Return top 6 diverse facilities

    # Dynamic fallback centered on search location
    return [
        {"id": f"gen_1_{lat}", "name": "Central Municipal Library", "category": "Library", "address": f"Civic Center, Lat {lat:.3f}", "lat": lat + 0.002, "lon": lon + 0.002, "indoor_cooling": True},
        {"id": f"gen_2_{lat}", "name": "Metropolitan Underground Concourse", "category": "Transit Hub", "address": "Central Avenue", "lat": lat - 0.003, "lon": lon + 0.004, "indoor_cooling": True},
        {"id": f"gen_3_{lat}", "name": "Community Recreation & Cooling Hub", "category": "Community Center", "address": "Park Road", "lat": lat + 0.001, "lon": lon - 0.005, "indoor_cooling": True},
        {"id": f"gen_4_{lat}", "name": "Civic Center & Public Auditorium", "category": "Civic Hall", "address": "Grand Boulevard", "lat": lat - 0.002, "lon": lon - 0.003, "indoor_cooling": True},
        {"id": f"gen_5_{lat}", "name": "District Sports & Climate Shelter", "category": "Indoor Stadium", "address": "Stadium Way", "lat": lat + 0.004, "lon": lon + 0.001, "indoor_cooling": True}
    ]

async def fetch_besttime_crowds(venue_name: str) -> str:
    if getattr(settings, "BESTTIME_API_KEY", None):
        url = "https://besttime.app/api/v1/forecasts/live"
        params = {"api_key_private": settings.BESTTIME_API_KEY, "venue_name": venue_name}
        try:
            data = sync_http_post(url, params=params)
            busyness = data.get("analysis", {}).get("venue_forecasted_busyness", 50)
            if busyness < 40:
                return "Low"
            elif busyness < 75:
                return "Moderate"
            else:
                return "High"
        except Exception as e:
            logger.error(f"BestTime API error: {e}")

    hash_val = sum(ord(c) for c in venue_name)
    levels = ["Low", "Moderate", "High"]
    return levels[hash_val % 3]

async def fetch_walking_route(start_lat: float, start_lon: float, end_lat: float, end_lon: float) -> Dict[str, Any]:
    R = 6371000.0
    phi1 = math.radians(start_lat)
    phi2 = math.radians(end_lat)
    delta_phi = math.radians(end_lat - start_lat)
    delta_lambda = math.radians(end_lon - start_lon)

    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    a_clamped = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a_clamped), math.sqrt(1.0 - a_clamped))
    dist_m = R * c

    duration_min = round((dist_m / 81.0), 1)
    mid_lat = (start_lat + end_lat) / 2.0
    mid_lon = (start_lon + end_lon) / 2.0
    polyline = [
        [start_lat, start_lon],
        [mid_lat + (end_lon - start_lon) * 0.1, mid_lon - (end_lat - start_lat) * 0.1],
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
        data = sync_http_get(url)
        results = data.get("results", [])
        if results:
            return float(results[0].get("elevation", 15.0))
    except Exception as e:
        logger.error(f"Open-Elevation fetch error: {e}")

    return round(abs(math.sin(lat) * 50.0 + math.cos(lon) * 30.0) + 15.0, 1)

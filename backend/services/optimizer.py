import asyncio
import json
import logging
import math
import urllib.request
from typing import List, Dict, Any, Tuple

try:
    from backend.models.schemas import VenueRefuge, WeatherInfo, RefugeResponse
    from backend.services.integrations import (
        fetch_weather_data,
        fetch_tomtom_facilities,
        fetch_besttime_crowds,
        fetch_walking_route,
        fetch_elevation,
        sync_http_post
    )
    from backend.config import settings
except ImportError:
    from models.schemas import VenueRefuge, WeatherInfo, RefugeResponse
    from services.integrations import (
        fetch_weather_data,
        fetch_tomtom_facilities,
        fetch_besttime_crowds,
        fetch_walking_route,
        fetch_elevation,
        sync_http_post
    )
    from config import settings

logger = logging.getLogger("klima.optimizer")

def calculate_mcda_safety_score(
    weather_data: Dict[str, Any],
    facility: Dict[str, Any],
    route_data: Dict[str, Any],
    crowd_level: str,
    elevation_m: float
) -> float:
    heat_index = weather_data.get("heat_index_c", 25.0)
    aqi = weather_data.get("aqi", 30)
    
    is_hazard = heat_index > 35.0 or aqi > 100
    if is_hazard:
        s_climate = 1.0 if facility.get("indoor_cooling", True) else 0.4
    else:
        s_climate = 0.85

    crowd_map = {"Low": 1.0, "Moderate": 0.65, "High": 0.25}
    s_crowd = crowd_map.get(crowd_level, 0.65)

    is_raining = weather_data.get("is_raining", False)
    if is_raining:
        if elevation_m < 10.0:
            s_elevation = 0.15
        elif elevation_m < 20.0:
            s_elevation = 0.50
        else:
            s_elevation = 1.0
    else:
        s_elevation = min(1.0, max(0.4, elevation_m / 100.0))

    dist_m = route_data.get("distance_m", 500.0)
    s_proximity = math.exp(-dist_m / 1500.0)

    total_score = 100.0 * (
        0.35 * s_climate +
        0.25 * s_crowd +
        0.20 * s_elevation +
        0.20 * s_proximity
    )

    return round(max(10.0, min(100.0, total_score)), 1)

async def evaluate_venues_with_gemini(weather_data: Dict[str, Any], venues_data: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], str]:
    """
    Evaluates candidate safe havens using Google AI Studio API targeting:
    - Gemini 3.1 Flash Lite
    - Gemma 4 26B
    - Gemma 4 31B
    """
    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not api_key:
        return ({}, "Google AI Studio API Key missing in environment (using MCDA Engine)")

    # Target models requested by user
    target_models = [
        "gemini-3.1-flash-lite",
        "gemma-4-26b",
        "gemma-4-31b"
    ]

    prompt = f"""
    You are Klima AI, an emergency climate refuge optimizer.
    Evaluate the candidate indoor safe havens given the current environmental threat payload.
    
    Current Climate Telemetry:
    - Heat Index: {weather_data.get('heat_index_c')}°C
    - AQI: {weather_data.get('aqi')}
    - Condition: {weather_data.get('condition')}
    - Active Rain/Storm: {weather_data.get('is_raining')}
    
    Candidate Facilities Payload:
    {json.dumps(venues_data, indent=2)}
    
    Instructions:
    Return ONLY a valid JSON object matching this structure:
    {{
      "ranked_scores": {{
        "<venue_id>": {{
          "ai_score": <float 0.0-100.0>
        }}
      }}
    }}
    """

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
    }

    for model_name in target_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            res_json = sync_http_post(url, json_payload=payload)
            candidates = res_json.get("candidates", [])
            if candidates:
                content_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                return (json.loads(content_text), f"Evaluated via Google AI Studio ({model_name})")
        except Exception as e:
            logger.error(f"Google AI Studio error for model {model_name}: {e}")

    return ({}, "Google AI Studio evaluation attempted across Gemini 3.1 Flash Lite & Gemma 4 models")

async def calculate_and_rank_refuges(user_lat: float, user_lon: float, radius_m: int = 2000) -> RefugeResponse:
    weather_task = fetch_weather_data(user_lat, user_lon)
    facilities_task = fetch_tomtom_facilities(user_lat, user_lon, radius_m)
    
    weather_data, facilities = await asyncio.gather(weather_task, facilities_task)

    weather_info = WeatherInfo(
        temp_c=weather_data["temp_c"],
        feelslike_c=weather_data["feelslike_c"],
        heat_index_c=weather_data["heat_index_c"],
        aqi=weather_data["aqi"],
        condition=weather_data["condition"]
    )

    venue_candidates = []

    for facility in facilities:
        f_lat = facility["lat"]
        f_lon = facility["lon"]
        f_name = facility["name"]

        route_task = fetch_walking_route(user_lat, user_lon, f_lat, f_lon)
        crowd_task = fetch_besttime_crowds(f_name)
        elevation_task = fetch_elevation(f_lat, f_lon)

        route_data, crowd_level, elevation_m = await asyncio.gather(route_task, crowd_task, elevation_task)

        mcda_score = calculate_mcda_safety_score(weather_data, facility, route_data, crowd_level, elevation_m)

        venue_candidates.append({
            "id": facility["id"],
            "name": f_name,
            "category": facility["category"],
            "address": facility["address"],
            "lat": f_lat,
            "lon": f_lon,
            "baseline_score": mcda_score,
            "distance_m": route_data["distance_m"],
            "duration_min": route_data["duration_min"],
            "crowd_level": crowd_level,
            "elevation_m": elevation_m,
            "indoor_cooling": facility["indoor_cooling"],
            "polyline": route_data["polyline"]
        })

    gemini_eval, ai_status_msg = await evaluate_venues_with_gemini(weather_data, venue_candidates)
    ai_scores = gemini_eval.get("ranked_scores", {})

    ranked_venues: List[VenueRefuge] = []
    for cand in venue_candidates:
        v_id = cand["id"]
        if v_id in ai_scores and "ai_score" in ai_scores[v_id]:
            final_score = round(float(ai_scores[v_id]["ai_score"]), 1)
        else:
            final_score = cand["baseline_score"]

        venue_obj = VenueRefuge(
            id=v_id,
            name=cand["name"],
            category=cand["category"],
            address=cand["address"],
            lat=cand["lat"],
            lon=cand["lon"],
            score=final_score,
            distance_m=cand["distance_m"],
            duration_min=cand["duration_min"],
            crowd_level=cand["crowd_level"],
            elevation_m=cand["elevation_m"],
            indoor_cooling=cand["indoor_cooling"],
            polyline=cand["polyline"]
        )
        ranked_venues.append(venue_obj)

    ranked_venues.sort(key=lambda v: v.score, reverse=True)

    return RefugeResponse(
        current_weather=weather_info,
        top_refuges=ranked_venues[:5],
        ai_engine_status=ai_status_msg
    )

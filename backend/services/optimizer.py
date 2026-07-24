import asyncio
from typing import List, Dict, Any

try:
    from backend.models.schemas import VenueRefuge, WeatherInfo, RefugeResponse
    from backend.services.integrations import (
        fetch_weather_data,
        fetch_tomtom_facilities,
        fetch_besttime_crowds,
        fetch_walking_route,
        fetch_elevation
    )
except ImportError:
    from models.schemas import VenueRefuge, WeatherInfo, RefugeResponse
    from services.integrations import (
        fetch_weather_data,
        fetch_tomtom_facilities,
        fetch_besttime_crowds,
        fetch_walking_route,
        fetch_elevation
    )

async def calculate_and_rank_refuges(user_lat: float, user_lon: float, radius_m: int = 2000) -> RefugeResponse:
    """
    Consolidates real-time data from WeatherAPI, TomTom, BestTime, OpenRoute, and Open-Elevation.
    Ranks facilities using our climate threat scoring algorithm and returns top 3 safest locations.
    """
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

    ranked_venues: List[VenueRefuge] = []

    for facility in facilities:
        f_lat = facility["lat"]
        f_lon = facility["lon"]
        f_name = facility["name"]

        route_task = fetch_walking_route(user_lat, user_lon, f_lat, f_lon)
        crowd_task = fetch_besttime_crowds(f_name)
        elevation_task = fetch_elevation(f_lat, f_lon)

        route_data, crowd_level, elevation_m = await asyncio.gather(route_task, crowd_task, elevation_task)

        # AI Scoring Algorithm
        score = 85.0

        if (weather_data["heat_index_c"] > 35.0 or weather_data["aqi"] > 100) and facility["indoor_cooling"]:
            score += 15.0

        if crowd_level == "High":
            score -= 25.0
        elif crowd_level == "Moderate":
            score -= 10.0

        if weather_data["is_raining"]:
            if elevation_m < 10.0:
                score -= 30.0
            elif elevation_m < 20.0:
                score -= 15.0
        else:
            if elevation_m > 25.0:
                score += 5.0

        dist_km = route_data["distance_m"] / 1000.0
        score -= dist_km * 5.0

        final_score = round(max(10.0, min(100.0, score)), 1)

        venue_obj = VenueRefuge(
            id=facility["id"],
            name=f_name,
            category=facility["category"],
            address=facility["address"],
            lat=f_lat,
            lon=f_lon,
            score=final_score,
            distance_m=route_data["distance_m"],
            duration_min=route_data["duration_min"],
            crowd_level=crowd_level,
            elevation_m=elevation_m,
            indoor_cooling=facility["indoor_cooling"],
            polyline=route_data["polyline"]
        )

        ranked_venues.append(venue_obj)

    ranked_venues.sort(key=lambda v: v.score, reverse=True)

    return RefugeResponse(
        current_weather=weather_info,
        top_refuges=ranked_venues[:3]
    )

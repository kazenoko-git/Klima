import asyncio
from typing import List, Dict, Any
from backend.models.schemas import VenueRefuge, WeatherInfo, RefugeResponse
from backend.services.integrations import (
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
    # Step 1: Concurrently fetch current weather and nearby facilities
    weather_task = fetch_weather_data(user_lat, user_lon)
    facilities_task = fetch_tomtom_facilities(user_lat, user_lon, radius_m)
    
    weather_data, facilities = await asyncio.gather(weather_task, facilities_task)

    # Convert weather dictionary into Pydantic WeatherInfo model
    weather_info = WeatherInfo(
        temp_c=weather_data["temp_c"],
        feelslike_c=weather_data["feelslike_c"],
        heat_index_c=weather_data["heat_index_c"],
        aqi=weather_data["aqi"],
        condition=weather_data["condition"]
    )

    ranked_venues: List[VenueRefuge] = []

    # Step 2: Process each facility asynchronously
    for facility in facilities:
        f_lat = facility["lat"]
        f_lon = facility["lon"]
        f_name = facility["name"]

        # Fetch route, crowd data, and elevation in parallel for efficiency
        route_task = fetch_walking_route(user_lat, user_lon, f_lat, f_lon)
        crowd_task = fetch_besttime_crowds(f_name)
        elevation_task = fetch_elevation(f_lat, f_lon)

        route_data, crowd_level, elevation_m = await asyncio.gather(route_task, crowd_task, elevation_task)

        # --- AI SCORING ALGORITHM LOGIC ---
        # Start with a base safety score of 85
        score = 85.0

        # 1. Heat & AQI Boost: Indoor cooling is prioritized during extreme temperatures (>35°C or high AQI)
        if (weather_data["heat_index_c"] > 35.0 or weather_data["aqi"] > 100) and facility["indoor_cooling"]:
            # Grant +15 points bonus for indoor climate-controlled spaces during active heat/AQI warnings
            score += 15.0

        # 2. Crowd Level Penalties: Overcrowded venues reduce available resting space and increase heat/stress
        if crowd_level == "High":
            # Heavy penalty of -25 points for high crowd density
            score -= 25.0
        elif crowd_level == "Moderate":
            # Moderate penalty of -10 points
            score -= 10.0

        # 3. Flood Risk & Elevation Penalties: Low elevation areas are at risk during storm/rain events
        if weather_data["is_raining"]:
            if elevation_m < 10.0:
                # Severe flood penalty of -30 points for low elevation under 10 meters during active rain
                score -= 30.0
            elif elevation_m < 20.0:
                # Moderate flood penalty of -15 points for elevation under 20 meters
                score -= 15.0
        else:
            # Subtle bonus for higher ground safety even in dry weather
            if elevation_m > 25.0:
                score += 5.0

        # 4. Proximity & Walking Penalty: Reduce score for long walking distances under hazardous weather
        dist_km = route_data["distance_m"] / 1000.0
        # Deduct 5 points per kilometer of walking exposure
        score -= dist_km * 5.0

        # Clamp safety score strictly between 10.0 and 100.0
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

    # Step 3: Sort venues in descending order by AI Safety Score
    ranked_venues.sort(key=lambda v: v.score, reverse=True)

    # Return top 3 safest locations along with current weather context
    return RefugeResponse(
        current_weather=weather_info,
        top_refuges=ranked_venues[:3]
    )

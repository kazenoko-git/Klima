from pydantic import BaseModel
from typing import List, Optional

class LocationQuery(BaseModel):
    lat: float
    lon: float
    radius_m: int = 2000

class VenueRefuge(BaseModel):
    id: str
    name: str
    category: str
    address: str
    lat: float
    lon: float
    score: float  # AI Safety score (0-100)
    distance_m: float
    duration_min: float
    crowd_level: str  # Low, Moderate, High, Unknown
    elevation_m: float
    indoor_cooling: bool
    polyline: Optional[List[List[float]]] = None

class WeatherInfo(BaseModel):
    temp_c: float
    feelslike_c: float
    heat_index_c: float
    aqi: int
    condition: str

class RefugeResponse(BaseModel):
    current_weather: WeatherInfo
    top_refuges: List[VenueRefuge]

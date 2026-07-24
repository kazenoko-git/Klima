from typing import List, Optional

try:
    from pydantic import BaseModel
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False

if HAS_PYDANTIC:
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
        score: float
        distance_m: float
        duration_min: float
        crowd_level: str
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
else:
    from dataclasses import dataclass, asdict

    @dataclass
    class LocationQuery:
        lat: float
        lon: float
        radius_m: int = 2000

    @dataclass
    class VenueRefuge:
        id: str
        name: str
        category: str
        address: str
        lat: float
        lon: float
        score: float
        distance_m: float
        duration_min: float
        crowd_level: str
        elevation_m: float
        indoor_cooling: bool
        polyline: Optional[List[List[float]]] = None

        def model_dump(self):
            return asdict(self)

    @dataclass
    class WeatherInfo:
        temp_c: float
        feelslike_c: float
        heat_index_c: float
        aqi: int
        condition: str

        def model_dump(self):
            return asdict(self)

    @dataclass
    class RefugeResponse:
        current_weather: WeatherInfo
        top_refuges: List[VenueRefuge]

        def model_dump(self):
            return {
                "current_weather": self.current_weather.model_dump() if hasattr(self.current_weather, "model_dump") else asdict(self.current_weather),
                "top_refuges": [r.model_dump() if hasattr(r, "model_dump") else asdict(r) for r in self.top_refuges]
            }

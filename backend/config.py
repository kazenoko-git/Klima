import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    WEATHER_API_KEY: str = os.getenv("WEATHER_API_KEY", "")
    BESTTIME_API_KEY: str = os.getenv("BESTTIME_API_KEY", "")
    TOMTOM_API_KEY: str = os.getenv("TOMTOM_API_KEY", "")
    ORS_API_KEY: str = os.getenv("ORS_API_KEY", "")

settings = Settings()

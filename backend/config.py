import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class Settings:
    WEATHER_API_KEY: str = os.getenv("WEATHER_API_KEY", "71b4bc4534a644ada68145847262307")
    BESTTIME_API_KEY: str = os.getenv("BESTTIME_API_KEY", "pri_d2744dd1f485474caba41a71be96a2c7")
    TOMTOM_API_KEY: str = os.getenv("TOMTOM_API_KEY", "Wfx7JRDSkz8u1cIMHiP4z3q17M2A4VNu")
    ORS_API_KEY: str = os.getenv("ORS_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", ""))

settings = Settings()

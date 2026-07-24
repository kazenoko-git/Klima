from src.imports import *
from src.fetcher import Fetcher

app = FastAPI()
fetcher = Fetcher()

@app.get("/")
def home():
    return "The Behatted Team Presents"

@app.get("/weather")
def get_weather():
    status, response = fetcher.get_default()
    if status == 200:
        print(response)
        return response

    return "No data recieved"

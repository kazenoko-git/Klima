from src.imports import *

class Fetcher:
    def __init__(self):
        self.KEY = "71b4bc4534a644ada68145847262307"
        self.BASE_URL = "http://api.weatherapi.com/v1"

        self.default_params = {
           "key" : self.KEY,
            "q" : "13.118022,77.641051",
            "aqi": "yes",
            "tides": "yes"
        }

    def get_default(self):
        response = requests.get(self.BASE_URL+"/current.json", params=self.default_params)
        return (response.status_code, response.json())


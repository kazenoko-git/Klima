# Klima: Climate Refuge Mapping

## 1. Problem Statement
The escalating climate crisis has made extreme weather events—such as unprecedented heatwaves, sudden flash floods, and severe air pollution—the new normal. Vulnerable populations, pedestrians, and commuters often find themselves caught in hazardous conditions without immediate knowledge of nearby safe havens. 
* **SDG 13 (Climate Action):** We urgently need adaptive tools to protect human life from acute climate impacts.
* **SDG 7 (Affordable and Clean Energy):** Highlighting public indoor spaces (like libraries or community centers) that utilize energy-efficient cooling ensures we maximize existing resources without further straining the grid.

## 2. The Solution: Klima
**Klima** is a responsive, real-time web application designed to act as an emergency environmental compass. It instantly maps out and ranks the top three safest nearby indoor sanctuaries based on real-time climate threats.

### User Experience Walkthrough
1. **The Trigger:** A user caught in extreme heat or sudden rain opens Klima on their mobile or desktop browser.
2. **The Input:** The app automatically detects their location (or they enter it manually via a sleek, dark-themed interface).
3. **The Engine:** Klima instantly evaluates the surrounding 2km radius, cross-referencing available public facilities against real-time weather, crowd levels, and topographical data.
4. **The Output:** The user is presented with a map highlighting the top 3 "Safe Zones" along with glass-morphic cards detailing each location's safety score, route information, and crowd meter. They can follow the suggested walking route to the safest destination.

## 3. Full-Stack Tech Architecture
Our architecture is built for speed, reliability, and modularity:

### Frontend
* **Framework:** React.js
* **Styling:** Tailwind CSS (strict grid/flexbox implementation for responsive stability)
* **Hosting:** Cloudflare Pages
* **Role:** Delivers a premium, dark-themed UI. Handles responsive layout scaling across Desktop, Tablet, and Mobile, and renders dynamic routing and location cards.

### Backend
* **Framework:** FastAPI (Python)
* **Hosting:** Cloudflare Workers (Edge deployment)
* **Role:** Acts as the orchestration layer. It exposes a primary endpoint that asynchronously fetches data from multiple external APIs, runs the AI scoring algorithm, and returns the optimized top 3 locations.

### External API Integrations
1. **WeatherAPI.com:** Current temperature, Heat Index, and AQI.
2. **TomTom Search API:** Locates nearby open facilities (e.g., libraries, transit stations) within a 2km radius.
3. **BestTime.app:** Live crowd levels and foot traffic data.
4. **OpenRouteService:** Walking distance, duration, and route polyline.
5. **Open-Elevation:** Elevation data derived from the route polyline to assess flood risks.

## 4. AI Scoring Logic (The Optimizer)
The core of Klima is our deterministic AI optimizer (or lightweight LLM evaluator), which ranks venues based on a composite safety score out of 100.

**Scoring Factors & Penalties:**
* **Heat & AQI Factor:** During high Heat Index or severe AQI, indoor cooling and air filtration are prioritized. (+ Points for verified indoor public facilities).
* **Crowd Penalty (BestTime):** Overcrowded areas are penalized to ensure the user can actually find space and rest. (- Points for high foot traffic).
* **Flood Risk Penalty (Open-Elevation):** During rain or storms, routes and destinations with low elevation are heavily penalized to avoid flash floods. (- Points for low elevation).
* **Accessibility:** Walking duration and distance are factored in. Closer locations receive higher baseline scores.

**Output:** The engine normalizes these weights and returns a sorted JSON array of the top 3 safest locations, complete with the final score (e.g., 92/100) and actionable routing data.

---

## 5. MVP Presentation Terms & Glossary
To ensure our pitch is impactful, we will use the following MVP terminology:
* **"Micro-Sanctuaries"**: The localized public spaces (libraries, stations) we route users to.
* **"Dynamic Threat Routing"**: Our algorithm's ability to adjust routes based on elevation and real-time weather.
* **"Edge-Orchestrated"**: Highlighting our backend running on Cloudflare Workers for ultra-low latency response.
* **"Climate-Responsive UI"**: A frontend that shifts context based on the environmental threat (e.g., amber warnings for heat).

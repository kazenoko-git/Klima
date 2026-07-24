import React, { useState, useEffect, useRef } from 'react';

const API_BASE_URL = "https://klima-backend.kazenoko-main.workers.dev";

export default function App() {
  const [userLocation, setUserLocation] = useState({ lat: 13.118022, lon: 77.641051 });
  const [pendingTarget, setPendingTarget] = useState(null); // Click-and-Confirm target
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [refugesData, setRefugesData] = useState(null);
  const [activeRefugeId, setActiveRefugeId] = useState(null);

  const mapRef = useRef(null);
  const leafletInstance = useRef(null);
  const markersGroup = useRef(null);
  const routePolylineGroup = useRef(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current || leafletInstance.current) return;
    if (typeof window.L === 'undefined') return;

    const L = window.L;
    const map = L.map(mapRef.current, {
      center: [userLocation.lat, userLocation.lon],
      zoom: 14,
      zoomControl: false
    });

    // CartoDB Voyager Tile Layer for clean modern map view
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    // Zoom Control on top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    markersGroup.current = L.layerGroup().addTo(map);
    routePolylineGroup.current = L.layerGroup().addTo(map);

    // Interactive Click-and-Confirm UX: Click on map drops target marker & confirmation popup
    map.on('click', (e) => {
      const clickLat = Number(e.latlng.lat.toFixed(6));
      const clickLon = Number(e.latlng.lng.toFixed(6));

      setPendingTarget({ lat: clickLat, lon: clickLon });
    });

    leafletInstance.current = map;

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, []);

  // Fetch safe zones from backend service
  const fetchRefuges = async (lat, lon) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/refuges?lat=${lat}&lon=${lon}&radius=2000`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.detail || `Server error (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setRefugesData(data);
      if (data.top_refuges && data.top_refuges.length > 0) {
        setActiveRefugeId(data.top_refuges[0].id);
      } else {
        setErrorMsg("No public refuges located within 2km of these coordinates.");
      }
    } catch (err) {
      console.error("Failed to fetch refuges:", err);
      setErrorMsg(err.message || "Failed to load refuges from server.");
      setRefugesData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchRefuges(userLocation.lat, userLocation.lon);
  }, []);

  // Update Leaflet Map Markers & Polyline whenever refugesData or activeRefugeId changes
  useEffect(() => {
    if (!leafletInstance.current || !window.L) return;
    const L = window.L;
    const map = leafletInstance.current;

    // Clear previous markers & polylines
    if (markersGroup.current) markersGroup.current.clearLayers();
    if (routePolylineGroup.current) routePolylineGroup.current.clearLayers();

    // Center map on user location
    map.panTo([userLocation.lat, userLocation.lon]);

    // 1. User Pulsing Location Marker
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div class="relative flex items-center justify-center size-12">
          <div class="absolute inset-0 bg-[#003ec7]/40 rounded-full animate-ping"></div>
          <div class="relative bg-[#003ec7] size-6 rounded-full border-2 border-white shadow-xl flex items-center justify-center">
            <div class="bg-white size-2 rounded-full"></div>
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
    L.marker([userLocation.lat, userLocation.lon], { icon: userIcon }).addTo(markersGroup.current);

    // 2. Pending Click Target Popup (Click & Confirm UX)
    if (pendingTarget) {
      const targetIcon = L.divIcon({
        className: 'pending-target-icon',
        html: `
          <div class="bg-[#131b2e] text-white p-3 rounded-2xl shadow-2xl border-2 border-[#003ec7] text-center w-52 -translate-x-1/2 -translate-y-full">
            <div class="text-[10px] font-bold text-amber-400 uppercase tracking-widest">SELECTED SEARCH CENTER</div>
            <div class="text-xs font-mono my-1">${pendingTarget.lat}, ${pendingTarget.lon}</div>
            <div class="text-[11px] text-gray-300 font-semibold mb-2">Click below to search 2km radius</div>
          </div>
        `,
        iconSize: [200, 100],
        iconAnchor: [100, 100]
      });
      
      L.marker([pendingTarget.lat, pendingTarget.lon], { icon: targetIcon }).addTo(markersGroup.current);
      
      // Radius circle
      L.circle([pendingTarget.lat, pendingTarget.lon], {
        color: '#003ec7',
        fillColor: '#003ec7',
        fillOpacity: 0.15,
        radius: 2000
      }).addTo(markersGroup.current);
    }

    // 3. Refuge Markers
    const refuges = refugesData?.top_refuges || [];
    refuges.forEach((refuge) => {
      const isActive = refuge.id === activeRefugeId;
      const markerHtml = `
        <div class="transform origin-bottom transition-transform ${isActive ? 'scale-125 z-30' : 'scale-100 opacity-90'}">
          <div class="${isActive ? 'bg-[#003ec7] text-white border-4 border-white' : 'bg-white text-[#131b2e] border-2 border-gray-300'} px-3 py-2 rounded-xl shadow-2xl flex flex-col items-center gap-0.5">
            <span class="font-black text-xs uppercase tracking-tight whitespace-nowrap">${refuge.name}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-blue-800 text-blue-100' : 'bg-gray-100 text-gray-700'} uppercase">${refuge.category}</span>
          </div>
        </div>
      `;

      const refugeIcon = L.divIcon({
        className: 'custom-refuge-marker',
        html: markerHtml,
        iconSize: [120, 60],
        iconAnchor: [60, 60]
      });

      const m = L.marker([refuge.lat, refuge.lon], { icon: refugeIcon }).addTo(markersGroup.current);
      m.on('click', () => setActiveRefugeId(refuge.id));

      // Draw Polyline for active refuge
      if (isActive && refuge.polyline) {
        L.polyline(refuge.polyline, {
          color: '#003ec7',
          weight: 5,
          opacity: 0.8,
          dashArray: '10, 10'
        }).addTo(routePolylineGroup.current);
      }
    });

  }, [refugesData, activeRefugeId, userLocation, pendingTarget]);

  // Confirm Search
  const handleConfirmSearch = () => {
    if (!pendingTarget) return;
    setUserLocation({ lat: pendingTarget.lat, lon: pendingTarget.lon });
    fetchRefuges(pendingTarget.lat, pendingTarget.lon);
    setPendingTarget(null);
  };

  // Search Bar Geocoding Submit using OpenStreetMap Nominatim API
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const results = await response.json();
      if (results && results.length > 0) {
        const foundLat = Number(parseFloat(results[0].lat).toFixed(6));
        const foundLon = Number(parseFloat(results[0].lon).toFixed(6));
        setUserLocation({ lat: foundLat, lon: foundLon });
        await fetchRefuges(foundLat, foundLon);
      } else {
        setErrorMsg(`Could not find coordinates for location "${searchQuery}".`);
        setIsLoading(false);
      }
    } catch (err) {
      setErrorMsg(`Geocoding failed: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Navigation Trigger
  const handleGoHere = (lat, lon) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`, '_blank');
  };

  const weather = refugesData?.current_weather;
  const refuges = refugesData?.top_refuges || [];

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] h-screen w-screen overflow-hidden relative flex flex-col font-sans">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[100] glass-panel flex flex-col items-center justify-center transition-opacity duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center border-4 border-[#003ec7]">
            <span className="material-symbols-outlined text-6xl text-[#003ec7] animate-spin mb-4">refresh</span>
            <h2 className="text-3xl font-black text-[#003ec7] tracking-tighter">SCANNED BY KLIMA AI...</h2>
            <p className="text-sm font-bold text-gray-500 mt-2">Evaluating Weather, AQI & Flood Risk...</p>
            <div className="w-64 h-3 bg-gray-200 rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-[#003ec7] w-2/3 animate-pulse rounded-full"></div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Navigation */}
      <header className="relative z-30 flex items-center justify-between px-6 py-3 glass-panel border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl text-[#003ec7]">shield_with_house</span>
            <span className="text-2xl font-black text-[#003ec7] tracking-tighter">KLIMA</span>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative hidden md:flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-gray-400">search</span>
            <input
              type="text"
              placeholder="Find a safe spot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003ec7] w-64 shadow-inner"
            />
          </form>
        </div>

        {/* Climate Alert HUD */}
        <div className="flex items-center gap-3">
          {weather ? (
            <div className="bg-[#ffb347]/20 border-2 border-[#ffb347] px-4 py-1.5 rounded-2xl flex items-center gap-3 text-[#131b2e]">
              <span className="material-symbols-outlined text-amber-600">warning</span>
              <div>
                <div className="font-black text-xs uppercase tracking-tight">HEAT & AQI TELEMETRY</div>
                <div className="text-xs font-bold text-gray-700">
                  Heat Index {weather.heat_index_c}°C • AQI {weather.aqi} ({weather.condition})
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500">error</span>
              <span>Weather Telemetry Unavailable</span>
            </div>
          )}
        </div>
      </header>

      {/* Error Alert Display Banner */}
      {errorMsg && (
        <div className="relative z-40 bg-red-600 text-white px-6 py-3 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white text-xl">warning</span>
            <span className="text-sm font-bold">{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-white hover:text-gray-200 text-xs font-bold uppercase tracking-wider underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Interactive Leaflet Map Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Leaflet Map Canvas */}
        <div ref={mapRef} className="w-full h-full z-0 cursor-crosshair"></div>

        {/* Click-and-Confirm Floating Bar */}
        {pendingTarget && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#131b2e] text-white px-6 py-3 rounded-full shadow-2xl border-2 border-[#003ec7] flex items-center gap-4 animate-bounce">
            <div className="text-xs font-bold">
              <span className="text-amber-400 uppercase">Selected Coordinates:</span> {pendingTarget.lat}, {pendingTarget.lon}
            </div>
            <button
              onClick={handleConfirmSearch}
              className="bg-[#003ec7] hover:bg-[#003ec7]/90 text-white text-xs font-black px-4 py-2 rounded-full uppercase tracking-wider transition-colors shadow-md"
            >
              Confirm & Scan Safe Zones
            </button>
            <button
              onClick={() => setPendingTarget(null)}
              className="text-gray-400 hover:text-white text-xs"
            >
              Cancel
            </button>
          </div>
        )}
      </main>

      {/* Bottom Cards - Top 3 Safe Zones */}
      <footer className="relative z-30 p-6 glass-panel border-t border-gray-200 shadow-2xl">
        {refuges.length > 0 ? (
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {refuges.map((refuge) => {
              const isActive = refuge.id === activeRefugeId;
              const scoreColor = refuge.score >= 80 ? 'bg-emerald-500 text-white' : refuge.score >= 60 ? 'bg-gray-400 text-white' : 'bg-red-500 text-white';
              const crowdColor = refuge.crowd_level === 'Low' ? 'text-emerald-600' : refuge.crowd_level === 'Moderate' ? 'text-amber-500' : 'text-red-500';

              return (
                <div
                  key={refuge.id}
                  onClick={() => setActiveRefugeId(refuge.id)}
                  className={`p-5 rounded-3xl cursor-pointer transition-all duration-300 flex flex-col justify-between border-2 ${isActive ? 'card-active' : 'bg-white/90 border-gray-200 hover:border-gray-300'}`}
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-black text-[#131b2e] tracking-tight uppercase">{refuge.name}</h3>
                        <p className="text-xs font-semibold text-gray-500 line-clamp-1">{refuge.address}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase shadow-sm ${scoreColor}`}>
                        🛡️ {Math.round(refuge.score)} SCORE
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between my-3">
                      <div>
                        <span className="text-3xl font-black text-[#003ec7] tracking-tight">{Math.round(refuge.duration_min)} MIN</span>
                        <span className="text-xs font-bold text-gray-400 uppercase block">WALK TIME</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black tracking-wider uppercase ${crowdColor}`}>{refuge.crowd_level.toUpperCase()}</span>
                        <span className="text-xs font-bold text-gray-400 uppercase block">CROWD STATUS</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-gray-600 pt-2 border-t border-gray-100">
                      <span>⛰️ {Math.round(refuge.elevation_m)}M ELEVATION</span>
                      <span>📍 {(refuge.distance_m / 1000).toFixed(1)} KM DISTANCE</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    {isActive ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGoHere(refuge.lat, refuge.lon);
                        }}
                        className="w-full bg-[#003ec7] hover:bg-[#003ec7]/90 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-wider transition-colors shadow-lg flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">near_me</span>
                        <span>GO HERE (GOOGLE MAPS)</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveRefugeId(refuge.id);
                        }}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-2xl text-xs uppercase tracking-wider transition-colors"
                      >
                        VIEW REFUGE
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto py-8 text-center bg-white/70 rounded-3xl border border-gray-200">
            <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">location_off</span>
            <p className="text-base font-bold text-gray-700">No Climate Refuges Available</p>
            <p className="text-xs text-gray-500 mt-1">Select another position on the map or search for a location to locate nearby refuges.</p>
          </div>
        )}
      </footer>
    </div>
  );
}

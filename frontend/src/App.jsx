import React, { useState, useEffect, useRef } from 'react';

const API_BASE_URL = "https://klima-backend.kazenoko-main.workers.dev";

export default function App() {
  const [userLocation, setUserLocation] = useState({ lat: 13.118022, lon: 77.641051 });
  const [pendingTarget, setPendingTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refugesData, setRefugesData] = useState(null);
  const [activeRefugeId, setActiveRefugeId] = useState(null);
  const [isGridView, setIsGridView] = useState(false);

  const mapRef = useRef(null);
  const leafletInstance = useRef(null);
  const markersGroup = useRef(null);
  const routePolylineGroup = useRef(null);
  const cardScrollContainerRef = useRef(null);

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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    markersGroup.current = L.layerGroup().addTo(map);
    routePolylineGroup.current = L.layerGroup().addTo(map);

    map.on('click', (e) => {
      const clickLat = Number(e.latlng.lat.toFixed(6));
      const clickLon = Number(e.latlng.lng.toFixed(6));
      setPendingTarget({ lat: clickLat, lon: clickLon });
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    leafletInstance.current = map;

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, []);

  // Fetch safe zones from Cloudflare Workers backend
  const fetchRefuges = async (lat, lon) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/refuges?lat=${lat}&lon=${lon}&radius=3000`);
      const data = await res.json();
      setRefugesData(data);
      if (data.top_refuges && data.top_refuges.length > 0) {
        setActiveRefugeId(data.top_refuges[0].id);
      } else {
        setActiveRefugeId(null);
      }
    } catch (err) {
      console.error("Failed to fetch refuges:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRefuges(userLocation.lat, userLocation.lon);
  }, []);

  // Update Leaflet Map Markers & Polyline
  useEffect(() => {
    if (!leafletInstance.current || !window.L) return;
    const L = window.L;
    const map = leafletInstance.current;

    if (markersGroup.current) markersGroup.current.clearLayers();
    if (routePolylineGroup.current) routePolylineGroup.current.clearLayers();

    // User Location Dot
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div class="relative flex items-center justify-center size-10">
          <div class="absolute inset-0 bg-[#003ec7]/40 rounded-full animate-ping"></div>
          <div class="relative bg-[#003ec7] size-5 rounded-full border-2 border-white shadow-xl flex items-center justify-center">
            <div class="bg-white size-1.5 rounded-full"></div>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    L.marker([userLocation.lat, userLocation.lon], { icon: userIcon }).addTo(markersGroup.current);

    // Pending Target Search Popup
    if (pendingTarget) {
      const targetIcon = L.divIcon({
        className: 'pending-target-icon',
        html: `
          <div class="bg-[#131b2e] text-white p-3 rounded-2xl shadow-2xl border-2 border-[#003ec7] text-center w-52">
            <div class="text-[10px] font-bold text-amber-400 uppercase tracking-widest">SELECTED SEARCH CENTER</div>
            <div class="text-xs font-mono my-1">${pendingTarget.lat}, ${pendingTarget.lon}</div>
            <div class="text-[11px] text-gray-300 font-semibold mb-2">Click confirm below to scan 3km</div>
          </div>
        `,
        iconSize: [208, 90],
        iconAnchor: [104, 90]
      });
      
      L.marker([pendingTarget.lat, pendingTarget.lon], { icon: targetIcon }).addTo(markersGroup.current);
      
      L.circle([pendingTarget.lat, pendingTarget.lon], {
        color: '#003ec7',
        fillColor: '#003ec7',
        fillOpacity: 0.15,
        radius: 3000
      }).addTo(markersGroup.current);
    }

    const refuges = refugesData?.top_refuges || [];

    refuges.forEach((refuge, idx) => {
      const isActive = refuge.id === activeRefugeId;

      const markerHtml = isActive ? `
        <div class="relative flex flex-col items-center z-50 transition-all duration-300 transform scale-110">
          <div class="bg-[#003ec7] text-white border-2 border-white px-3 py-2 rounded-xl shadow-2xl flex flex-col items-center gap-0.5 max-w-[220px]">
            <span class="font-black text-xs uppercase tracking-tight truncate">${refuge.name}</span>
            <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-blue-900 text-blue-100 uppercase">${refuge.category}</span>
          </div>
          <div class="w-3 h-3 bg-[#003ec7] rotate-45 -mt-1.5 shadow-md"></div>
        </div>
      ` : `
        <div class="relative flex flex-col items-center z-30 hover:scale-125 transition-transform duration-200 cursor-pointer">
          <div class="bg-white text-[#003ec7] border-2 border-[#003ec7] size-8 rounded-full shadow-lg flex items-center justify-center font-black text-sm">
            ${idx + 1}
          </div>
          <div class="w-2 h-2 bg-[#003ec7] rotate-45 -mt-1"></div>
        </div>
      `;

      const refugeIcon = L.divIcon({
        className: 'custom-refuge-marker',
        html: markerHtml,
        iconSize: isActive ? [220, 60] : [32, 40],
        iconAnchor: isActive ? [110, 60] : [16, 40]
      });

      const m = L.marker([refuge.lat, refuge.lon], { icon: refugeIcon }).addTo(markersGroup.current);
      m.on('click', () => handleSelectRefuge(refuge));

      if (isActive && refuge.polyline) {
        L.polyline(refuge.polyline, {
          color: '#003ec7',
          weight: 5,
          opacity: 0.85,
          dashArray: '8, 12'
        }).addTo(routePolylineGroup.current);
      }
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

  }, [refugesData, activeRefugeId, userLocation, pendingTarget]);

  // Select Refuge & Fly Map Camera directly to selected location
  const handleSelectRefuge = (refuge) => {
    setActiveRefugeId(refuge.id);
    if (leafletInstance.current && refuge.lat && refuge.lon) {
      leafletInstance.current.flyTo([refuge.lat, refuge.lon], 16, {
        animate: true,
        duration: 1.2
      });
    }
  };

  const handleConfirmSearch = () => {
    if (!pendingTarget) return;
    setUserLocation({ lat: pendingTarget.lat, lon: pendingTarget.lon });
    fetchRefuges(pendingTarget.lat, pendingTarget.lon);
    setPendingTarget(null);
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const foundLat = Number(data[0].lat);
        const foundLon = Number(data[0].lon);
        setUserLocation({ lat: foundLat, lon: foundLon });
        if (leafletInstance.current) {
          leafletInstance.current.flyTo([foundLat, foundLon], 14, { animate: true, duration: 1.5 });
        }
        await fetchRefuges(foundLat, foundLon);
      } else {
        alert(`Location "${searchQuery}" not found. Please try another place.`);
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoHere = (lat, lon) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`, '_blank');
  };

  const scrollCards = (direction) => {
    if (cardScrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      cardScrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const weather = refugesData?.current_weather || {
    temp_c: 25.0,
    feelslike_c: 26.0,
    heat_index_c: 27.0,
    aqi: 35,
    condition: 'Clear'
  };

  const refuges = refugesData?.top_refuges || [];

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] h-screen w-screen overflow-hidden relative flex flex-col font-sans">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[100] glass-panel flex flex-col items-center justify-center transition-opacity duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center border-4 border-[#003ec7]">
            <span className="material-symbols-outlined text-6xl text-[#003ec7] animate-spin mb-4">refresh</span>
            <h2 className="text-3xl font-black text-[#003ec7] tracking-tighter">SCANNED BY KLIMA AI...</h2>
            <p className="text-sm font-bold text-gray-500 mt-2">Evaluating Weather, AQI & Dynamic Public Safe Havens...</p>
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
              placeholder="Search city/place (e.g., Antarctica, London, Tokyo)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003ec7] w-80 shadow-inner"
            />
          </form>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#ffb347]/20 border-2 border-[#ffb347] px-4 py-1.5 rounded-2xl flex items-center gap-3 text-[#131b2e]">
            <span className="material-symbols-outlined text-amber-600">warning</span>
            <div>
              <div className="font-black text-xs uppercase tracking-tight">HEAT & AQI TELEMETRY</div>
              <div className="text-xs font-bold text-gray-700">
                Heat Index {weather.heat_index_c}°C • AQI {weather.aqi} ({weather.condition})
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Interactive Leaflet Map Area */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <div ref={mapRef} className="w-full h-full z-0 cursor-crosshair"></div>

        {pendingTarget && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#131b2e] text-white px-6 py-3 rounded-full shadow-2xl border-2 border-[#003ec7] flex items-center gap-4 animate-bounce">
            <div className="text-xs font-bold">
              <span className="text-amber-400 uppercase">Selected Target:</span> {pendingTarget.lat}, {pendingTarget.lon}
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

      {/* Bottom Accessible Location Cards Section */}
      <footer className="relative z-30 p-4 glass-panel border-t border-gray-200 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-gray-600">
            <span className="uppercase tracking-wider">Live Scanned Refuges ({refuges.length})</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsGridView(!isGridView)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">{isGridView ? 'view_carousel' : 'grid_view'}</span>
                <span>{isGridView ? 'Horizontal Scroll' : 'Grid View'}</span>
              </button>

              {!isGridView && (
                <div className="hidden md:flex items-center gap-1">
                  <button
                    onClick={() => scrollCards('left')}
                    className="size-7 bg-white hover:bg-gray-100 border border-gray-300 rounded-full flex items-center justify-center shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <button
                    onClick={() => scrollCards('right')}
                    className="size-7 bg-white hover:bg-gray-100 border border-gray-300 rounded-full flex items-center justify-center shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {refuges.length > 0 ? (
            <div
              ref={cardScrollContainerRef}
              onWheel={(e) => {
                if (!isGridView && cardScrollContainerRef.current) {
                  cardScrollContainerRef.current.scrollLeft += e.deltaY;
                }
              }}
              className={
                isGridView
                  ? "grid grid-cols-1 md:grid-cols-3 gap-4 max-h-60 overflow-y-auto p-1"
                  : "flex gap-5 overflow-x-auto pb-2 pt-1 px-1 snap-x scroll-smooth"
              }
            >
              {refuges.map((refuge, idx) => {
                const isActive = refuge.id === activeRefugeId;
                const scoreColor = refuge.score >= 80 ? 'bg-emerald-500 text-white' : refuge.score >= 60 ? 'bg-gray-400 text-white' : 'bg-red-500 text-white';
                const crowdColor = refuge.crowd_level === 'Low' ? 'text-emerald-600' : refuge.crowd_level === 'Moderate' ? 'text-amber-500' : 'text-red-500';

                return (
                  <div
                    key={refuge.id}
                    onClick={() => handleSelectRefuge(refuge)}
                    className={`
                      ${isGridView ? 'w-full' : 'min-w-[320px] max-w-[360px] flex-shrink-0 snap-center'}
                      p-4 rounded-3xl cursor-pointer transition-all duration-300 flex flex-col justify-between border-2
                      ${isActive ? 'card-active bg-white scale-[1.02] shadow-xl border-[#003ec7]' : 'bg-white/90 border-gray-200 hover:border-gray-300'}
                    `}
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#003ec7] text-white text-xs font-black px-2 py-0.5 rounded-full">{idx + 1}</span>
                          <div>
                            <h3 className="text-base font-black text-[#131b2e] tracking-tight uppercase line-clamp-1">{refuge.name}</h3>
                            <p className="text-xs font-semibold text-gray-500 line-clamp-1">{refuge.address}</p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black tracking-wider uppercase shadow-sm ${scoreColor}`}>
                          🛡️ {Math.round(refuge.score)}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between my-2">
                        <div>
                          <span className="text-2xl font-black text-[#003ec7] tracking-tight">{Math.round(refuge.duration_min)} MIN</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">WALK TIME</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-black tracking-wider uppercase ${crowdColor}`}>{refuge.crowd_level.toUpperCase()}</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase block">CROWD STATUS</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-600 pt-2 border-t border-gray-100">
                        <span>⛰️ {Math.round(refuge.elevation_m)}M ELEVATION</span>
                        <span>📍 {(refuge.distance_m / 1000).toFixed(1)} KM DISTANCE</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      {isActive ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGoHere(refuge.lat, refuge.lon);
                          }}
                          className="w-full bg-[#003ec7] hover:bg-[#003ec7]/90 text-white font-black py-2.5 rounded-2xl text-xs uppercase tracking-wider transition-colors shadow-lg flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">near_me</span>
                          <span>GO HERE (GOOGLE MAPS)</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRefuge(refuge);
                          }}
                          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 rounded-2xl text-xs uppercase tracking-wider transition-colors"
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
            <div className="text-center py-6 text-sm font-bold text-gray-500">
              Click anywhere on the map or search a city to scan live safe havens...
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

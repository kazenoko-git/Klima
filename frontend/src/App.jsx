import React, { useState, useEffect } from 'react';

const API_BASE_URL = "https://klima-backend.kazenoko-main.workers.dev";

export default function App() {
  // Default coordinates (Bengaluru / City Center)
  const [userLocation, setUserLocation] = useState({ lat: 13.118022, lon: 77.641051 });
  const [selectedTarget, setSelectedTarget] = useState(null); // Click-and-Confirm target
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refugesData, setRefugesData] = useState(null);
  const [activeRefugeId, setActiveRefugeId] = useState(null);

  // Fetch safe zones from Cloudflare Workers backend
  const fetchRefuges = async (lat, lon) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/refuges?lat=${lat}&lon=${lon}&radius=2000`);
      const data = await res.json();
      setRefugesData(data);
      if (data.top_refuges && data.top_refuges.length > 0) {
        setActiveRefugeId(data.top_refuges[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch refuges:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchRefuges(userLocation.lat, userLocation.lon);
  }, []);

  // Handle map click for Click-and-Confirm UX (prevents hover request spam)
  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Simulate lat/lon offset based on click position
    const latOffset = (y / rect.height - 0.5) * -0.02;
    const lonOffset = (x / rect.width - 0.5) * 0.02;
    
    const newTarget = {
      lat: Number((userLocation.lat + latOffset).toFixed(6)),
      lon: Number((userLocation.lon + lonOffset).toFixed(6)),
      xPct: (x / rect.width) * 100,
      yPct: (y / rect.height) * 100
    };
    
    setSelectedTarget(newTarget);
  };

  // Confirm Search at Selected Target
  const handleConfirmSearch = () => {
    if (!selectedTarget) return;
    setUserLocation({ lat: selectedTarget.lat, lon: selectedTarget.lon });
    fetchRefuges(selectedTarget.lat, selectedTarget.lon);
    setSelectedTarget(null);
  };

  // Geocode address search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    // Simulate address search shift
    const shiftedLocation = {
      lat: Number((userLocation.lat + 0.005).toFixed(6)),
      lon: Number((userLocation.lon + 0.005).toFixed(6))
    };
    setUserLocation(shiftedLocation);
    fetchRefuges(shiftedLocation.lat, shiftedLocation.lon);
  };

  // Trigger Google Maps Navigation
  const handleGoHere = (lat, lon) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`, '_blank');
  };

  const weather = refugesData?.current_weather || {
    temp_c: 38.5,
    feelslike_c: 42.0,
    heat_index_c: 43.2,
    aqi: 156,
    condition: 'Extreme Heat'
  };

  const refuges = refugesData?.top_refuges || [
    {
      id: "card-1",
      name: "Central Library",
      category: "Library",
      address: "124 Civic Center Plaza",
      lat: 13.121022,
      lon: 77.643051,
      score: 92.4,
      distance_m: 412,
      duration_min: 8,
      crowd_level: "Low",
      elevation_m: 931,
      indoor_cooling: true
    },
    {
      id: "card-2",
      name: "Northside CC",
      category: "Community Center",
      address: "88 Park Avenue",
      lat: 13.119022,
      lon: 77.635051,
      score: 78.1,
      distance_m: 670,
      duration_min: 12,
      crowd_level: "Moderate",
      elevation_m: 845,
      indoor_cooling: true
    },
    {
      id: "card-3",
      name: "YMCA West",
      category: "Sports Complex",
      address: "45 Main Street",
      lat: 13.114022,
      lon: 77.646051,
      score: 45.0,
      distance_m: 1200,
      duration_min: 18,
      crowd_level: "High",
      elevation_m: 720,
      indoor_cooling: true
    }
  ];

  const activeRefuge = refuges.find(r => r.id === activeRefugeId) || refuges[0];

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] h-screen w-screen overflow-hidden relative flex flex-col">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 glass-panel flex flex-col items-center justify-center transition-opacity duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center border-4 border-[#003ec7]">
            <span className="material-symbols-outlined text-6xl text-[#003ec7] animate-spin mb-4">refresh</span>
            <h2 className="text-3xl font-black text-[#003ec7] tracking-tighter">SCANNED BY KLIMA AI...</h2>
            <p className="text-sm font-bold text-gray-500 mt-2">Evaluating Weather, AQI & Crowd Risk...</p>
            <div className="w-64 h-3 bg-gray-200 rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-[#003ec7] w-2/3 animate-pulse rounded-full"></div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Navigation */}
      <header className="relative z-30 flex items-center justify-between px-6 py-4 glass-panel border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl text-[#003ec7] fill-icon">shield_with_house</span>
            <span className="text-2xl font-black text-[#003ec7] tracking-tighter">KLIMA</span>
          </div>

          {/* Search Input Bar */}
          <form onSubmit={handleSearchSubmit} className="relative hidden md:flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-gray-400">search</span>
            <input
              type="text"
              placeholder="Find a safe spot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white/80 border border-gray-300 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003ec7] w-64 shadow-inner"
            />
          </form>
        </div>

        {/* Dynamic Climate Threat Alert Banner */}
        <div className="flex items-center gap-3">
          <div className="bg-[#ffb347]/20 border-2 border-[#ffb347] px-4 py-2 rounded-2xl flex items-center gap-3 text-[#131b2e] shadow-md">
            <span className="material-symbols-outlined text-amber-600 animate-bounce">warning</span>
            <div>
              <div className="font-black text-sm tracking-tight uppercase">HEAT & AQI ALERT</div>
              <div className="text-xs font-semibold text-gray-700">
                Heat Index {weather.heat_index_c}°C • AQI {weather.aqi}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Map Interactive Container */}
      <main className="relative flex-1 w-full h-full overflow-hidden" id="map-container" onClick={handleMapClick}>
        {/* Map Base Image View */}
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9VgUmy1BU7zsD4Jl_7G29G5Dhbz6nrqayXgH4quWcnhBYTpNhH3DcjGuWaGPX_FFQqMw-paduXlQRjTh1XFsNcHLVGDvx0FKC9aBJN2CdT6k1BjhQMK8WylDgDXaKwlxAmH3BFaFjvmltflZ8dRkSxZIFn1-uo87ywt3gBZIJxqERUqQ22-jd0FsjbFixQAUslLR3M4lp07emvEgt7lUNL6pnsJIvT7DaLHhrnzGUK8jShgYQIkXxx6GQIS4xsfPHalKqxL0D8TE"
          alt="Klima City Map View"
          className="w-full h-full object-cover select-none"
        />

        {/* User GPS Dot */}
        <div className="absolute left-[50%] top-[70%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="relative flex items-center justify-center size-24">
            <div className="absolute inset-0 bg-[#003ec7]/60 rounded-full animate-ping"></div>
            <div className="relative bg-[#003ec7] size-10 rounded-full border-4 border-white shadow-2xl flex items-center justify-center">
              <div className="bg-white size-3 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Floating Map Pins for Top Refuges */}
        {refuges.map((refuge, idx) => {
          const positions = [
            { left: '65%', top: '40%' },
            { left: '35%', top: '30%' },
            { left: '75%', top: '65%' }
          ];
          const pos = positions[idx % 3];
          const isActive = refuge.id === activeRefugeId;

          return (
            <div
              key={refuge.id}
              style={{ left: pos.left, top: pos.top }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveRefugeId(refuge.id);
              }}
              className="absolute -translate-x-1/2 -translate-y-full z-20 cursor-pointer transition-transform hover:scale-110"
            >
              <div className={`px-4 py-2 rounded-xl shadow-2xl flex flex-col items-center gap-1 border-4 ${isActive ? 'bg-[#003ec7] text-white border-white scale-110' : 'bg-white text-[#131b2e] border-gray-300'}`}>
                <span className="font-black text-sm whitespace-nowrap uppercase">{refuge.name}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
                  {refuge.category}
                </span>
              </div>
            </div>
          );
        })}

        {/* Click-and-Confirm Search Area Selector Popup (Optimized UX to avoid hover spam) */}
        {selectedTarget && (
          <div
            style={{ left: `${selectedTarget.xPct}%`, top: `${selectedTarget.yPct}%` }}
            className="absolute z-40 -translate-x-1/2 -translate-y-full transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#131b2e] text-white p-4 rounded-2xl shadow-2xl border-2 border-[#003ec7] flex flex-col items-center gap-2 w-64">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
                <span className="material-symbols-outlined text-base">my_location</span>
                <span>SELECTED SEARCH TARGET</span>
              </div>
              <div className="text-xs text-gray-300 font-mono">
                {selectedTarget.lat}, {selectedTarget.lon}
              </div>
              <div className="flex gap-2 w-full mt-2">
                <button
                  onClick={handleConfirmSearch}
                  className="flex-1 bg-[#003ec7] hover:bg-[#003ec7]/90 text-white font-bold py-2 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-md"
                >
                  Confirm & Scan
                </button>
                <button
                  onClick={() => setSelectedTarget(null)}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Cards Row - Top 3 Safe Zones */}
      <footer className="relative z-30 p-6 glass-panel border-t border-gray-200 shadow-2xl">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {refuges.map((refuge) => {
            const isActive = refuge.id === activeRefugeId;
            const scoreColor = refuge.score >= 80 ? 'bg-emerald-500 text-white' : refuge.score >= 60 ? 'bg-gray-400 text-white' : 'bg-red-500 text-white';
            const crowdColor = refuge.crowd_level === 'Low' ? 'text-emerald-600' : refuge.crowd_level === 'Moderate' ? 'text-amber-500' : 'text-red-500';

            return (
              <div
                key={refuge.id}
                onClick={() => setActiveRefugeId(refuge.id)}
                className={`p-5 rounded-3xl cursor-pointer transition-all duration-300 flex flex-col justify-between border-2 ${isActive ? 'card-active' : 'bg-white/80 border-gray-200 hover:border-gray-300'}`}
              >
                <div>
                  {/* Card Header: Title & AI Score */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xl font-black text-[#131b2e] tracking-tight uppercase">{refuge.name}</h3>
                      <p className="text-xs font-semibold text-gray-500">{refuge.address}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase shadow-sm ${scoreColor}`}>
                      🛡️ {Math.round(refuge.score)} SCORE
                    </span>
                  </div>

                  {/* Walk Time & Crowd Level */}
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

                  {/* Elevation & Distance */}
                  <div className="flex items-center justify-between text-xs font-bold text-gray-600 pt-2 border-t border-gray-100">
                    <span>⛰️ {Math.round(refuge.elevation_m)}M ELEVATION</span>
                    <span>📍 {(refuge.distance_m / 1000).toFixed(1)} KM DISTANCE</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4">
                  {isActive ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGoHere(refuge.lat, refuge.lon);
                      }}
                      className="w-full bg-[#003ec7] hover:bg-[#003ec7]/90 text-white font-black py-3 rounded-2xl text-sm uppercase tracking-wider transition-colors shadow-lg flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">near_me</span>
                      <span>GO HERE (GOOGLE MAPS)</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRefugeId(refuge.id);
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-2xl text-sm uppercase tracking-wider transition-colors"
                    >
                      VIEW REFUGE
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </footer>
    </div>
  );
}

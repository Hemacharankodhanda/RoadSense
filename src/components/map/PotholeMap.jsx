import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.heat';
import { Layers, Flame, MapPin, Search, Crosshair, ZoomIn, ZoomOut, Compass, RefreshCw } from 'lucide-react';
import { forwardGeocode } from '../../lib/potholeService';

// Fix Leaflet default marker icons in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Color mapping for marker statuses
const STATUS_COLORS = {
  reported: '#ef4444',
  verified: '#f97316',
  in_progress: '#f59e0b',
  repaired: '#10b981',
  rejected: '#64748b'
};

// Creates a rich custom DOM marker
function createCustomPin(pothole, isSelected = false) {
  const status = pothole.status || 'reported';
  const color = STATUS_COLORS[status] || '#ef4444';
  const isHigh = pothole.severity === 'high';

  // Optional: make the marker radius slightly larger for deeper potholes
  const depthVal = typeof pothole.depth_cm === 'number' && !isNaN(pothole.depth_cm) ? Number(pothole.depth_cm) : null;
  const depthBoost = depthVal !== null ? (depthVal >= 7 ? 6 : (depthVal >= 3 ? 3 : 0)) : 0;
  const size = (isSelected ? 42 : (isHigh ? 36 : 30)) + depthBoost;
  const pulseClass = (isHigh && status !== 'repaired') ? 'pulse-high' : '';

  const html = `
    <div class="marker-pin ${pulseClass}" style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 3px solid #ffffff;
      ${isSelected ? 'outline: 4px solid #0284c7; outline-offset: 2px;' : ''}
    ">
      <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        ${status === 'repaired'
          ? '<polyline points="20 6 9 17 4 12"></polyline>'
          : status === 'in_progress'
          ? '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>'
          : '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
        }
      </svg>
    </div>
  `;

  return L.divIcon({
    className: 'custom-pothole-icon',
    html: html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

// Default center coordinates: VIT-AP University, Inavolu, Amaravati
export const VIT_AP_COORDINATES = [16.4947, 80.4992];
export const DEFAULT_MAP_ZOOM = 15;

export default function PotholeMap({
  potholes = [],
  selectedPothole = null,
  onSelectPothole = () => {},
  isReportMode = false,
  reportLocation = null,
  onReportLocationSelect = () => {},
  className = "w-full h-full"
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const clusterGroupRef = useRef(null);
  const individualMarkersRef = useRef(L.layerGroup());
  const heatLayerRef = useRef(null);
  const reportPinRef = useRef(null);

  // Layer toggle states
  const [showCluster, setShowCluster] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [roadFilter, setRoadFilter] = useState('all'); // 'all', 'high', 'active', 'repaired'

  // Nominatim Address Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center: VIT-AP University (or focused pothole if provided)
    const initialCenter = selectedPothole?.location
      ? [selectedPothole.location.lat, selectedPothole.location.lng]
      : VIT_AP_COORDINATES;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: DEFAULT_MAP_ZOOM,
      zoomControl: false,
      attributionControl: true
    });

    // Official OpenStreetMap tiles (100% free, no API key required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Initialize cluster layer
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true
    });
    clusterGroupRef.current = cluster;
    map.addLayer(cluster);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle map click for citizen report placement
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      if (isReportMode) {
        const { lat, lng } = e.latlng;
        onReportLocationSelect({ lat, lng });
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isReportMode, onReportLocationSelect]);

  // Update Report placement pin
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (reportLocation) {
      if (reportPinRef.current) {
        reportPinRef.current.setLatLng([reportLocation.lat, reportLocation.lng]);
      } else {
        const reportIcon = L.divIcon({
          className: 'custom-pothole-icon',
          html: `
            <div class="marker-pin pulse-high" style="width: 40px; height: 40px; background: #0284c7; border: 3px solid #ffffff;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5">
                <path d="M12 2v20M2 12h20"></path>
              </svg>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        reportPinRef.current = L.marker([reportLocation.lat, reportLocation.lng], {
          icon: reportIcon,
          draggable: true
        }).addTo(map);

        reportPinRef.current.on('dragend', (e) => {
          const newPos = e.target.getLatLng();
          onReportLocationSelect({ lat: newPos.lat, lng: newPos.lng });
        });
      }
    } else if (reportPinRef.current) {
      map.removeLayer(reportPinRef.current);
      reportPinRef.current = null;
    }
  }, [reportLocation]);

  // Render & update Pothole markers and Heatmap
  useEffect(() => {
    const map = mapInstanceRef.current;
    const cluster = clusterGroupRef.current;
    if (!map || !cluster) return;

    // Filter potholes based on roadFilter
    const filtered = potholes.filter(p => {
      if (!p.location || typeof p.location.lat !== 'number' || typeof p.location.lng !== 'number') return false;
      if (roadFilter === 'high') return p.severity === 'high';
      if (roadFilter === 'active') return p.status !== 'repaired' && p.status !== 'rejected';
      if (roadFilter === 'repaired') return p.status === 'repaired';
      return true;
    });

    // 1. Update Markers & Clusters
    cluster.clearLayers();
    individualMarkersRef.current.clearLayers();

    const markers = filtered.map(pothole => {
      const isSelected = selectedPothole?.id === pothole.id;
      const marker = L.marker([pothole.location.lat, pothole.location.lng], {
        icon: createCustomPin(pothole, isSelected)
      });

      marker.on('click', () => {
        onSelectPothole(pothole);
      });

      // Estimated depth calculation & label
      const hasDepth = typeof pothole.depth_cm === 'number' && !isNaN(pothole.depth_cm);
      const depthVal = hasDepth ? Number(pothole.depth_cm) : null;
      const depthLabel = depthVal !== null ? (depthVal >= 7 ? 'Deep' : depthVal >= 3 ? 'Moderate' : 'Shallow') : null;
      const depthText = hasDepth
        ? `Est. depth: ${depthVal.toFixed(1)} cm <span style="font-weight: 600; color: ${depthVal >= 7 ? '#e11d48' : depthVal >= 3 ? '#d97706' : '#059669'};">(${depthLabel})</span>`
        : 'Est. depth: n/a';

      // Quick hover tooltip
      marker.bindTooltip(`
        <div style="font-family: inherit; font-size: 12px; font-weight: 500;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">
            ${pothole.severity?.toUpperCase()} SEVERITY
          </div>
          <div style="color: #64748b; font-size: 11px;">
            ${pothole.address || 'Street defect'}
          </div>
          <div style="font-size: 11px; margin-top: 2px; color: #334155;">
            ${depthText}
          </div>
          <div style="font-size: 11px; margin-top: 2px; color: ${STATUS_COLORS[pothole.status] || '#ef4444'}; font-weight: 600;">
            Status: ${pothole.status?.replace('_', ' ').toUpperCase()}
          </div>
        </div>
      `, { offset: [0, -10], direction: 'top' });

      return marker;
    });

    if (showCluster) {
      if (map.hasLayer(individualMarkersRef.current)) {
        map.removeLayer(individualMarkersRef.current);
      }
      cluster.addLayers(markers);
      if (!map.hasLayer(cluster)) {
        map.addLayer(cluster);
      }
    } else {
      if (map.hasLayer(cluster)) {
        map.removeLayer(cluster);
      }
      markers.forEach(m => individualMarkersRef.current.addLayer(m));
      if (!map.hasLayer(individualMarkersRef.current)) {
        map.addLayer(individualMarkersRef.current);
      }
    }

    // 2. Update Heatmap Layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (showHeatmap && filtered.length > 0) {
      // Heatmap points: [lat, lng, intensity]
      const heatPoints = filtered.map(p => {
        // Magnitude or severity score normalized to 0.4 - 1.0 intensity
        const intensity = Math.min(1.0, Math.max(0.3, (p.severityScore || 2.0) / 5.0));
        return [p.location.lat, p.location.lng, intensity];
      });

      const heat = L.heatLayer(heatPoints, {
        radius: 28,
        blur: 20,
        maxZoom: 17,
        gradient: {
          0.2: '#3b82f6',
          0.4: '#10b981',
          0.6: '#f59e0b',
          0.8: '#ef4444',
          1.0: '#991b1b'
        }
      });
      heat.addTo(map);
      heatLayerRef.current = heat;
    }
  }, [potholes, selectedPothole, showCluster, showHeatmap, roadFilter]);

  // Center on selected pothole if changed
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPothole?.location) return;

    map.flyTo([selectedPothole.location.lat, selectedPothole.location.lng], 16, {
      duration: 1.2
    });
  }, [selectedPothole]);

  // Handle address search
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await forwardGeocode(searchQuery);
    setSearchResults(results);
    setShowSearchResults(true);
    setIsSearching(false);
  };

  const handleSelectSearchResult = (result) => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([result.lat, result.lng], 15, { duration: 1.5 });
    }
    setShowSearchResults(false);
  };

  // Locate citizen via GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const map = mapInstanceRef.current;
        if (map) {
          map.flyTo([latitude, longitude], 16, { duration: 1.5 });
        }
        if (isReportMode) {
          onReportLocationSelect({ lat: latitude, lng: longitude });
        }
      },
      (err) => {
        alert('Could not retrieve your location. Please check browser permissions.');
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className={`relative ${className} overflow-hidden`}>
      {/* Search and Geocoding Floating Box */}
      <div className="absolute top-4 left-4 z-[500] w-72 sm:w-80 max-w-[calc(100vw-2rem)]">
        <form onSubmit={handleSearch} className="relative shadow-lg rounded-xl bg-white/95 backdrop-blur-md border border-slate-200">
          <div className="flex items-center px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search street, area, city..."
              className="w-full bg-transparent px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            {isSearching && <RefreshCw className="w-3.5 h-3.5 text-civic-500 animate-spin shrink-0" />}
          </div>

          {/* Autocomplete Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="p-1.5 max-h-56 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-xs text-slate-700 flex items-start gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-civic-600 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{res.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Layer Controls & Map Tools Bar */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col gap-2 items-end">
        {/* Layer Switches */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg rounded-xl p-1.5 flex flex-col gap-1 text-xs">
          {/* Clustering Toggle */}
          <button
            type="button"
            onClick={() => setShowCluster(!showCluster)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              showCluster
                ? 'bg-civic-50 text-civic-700 border border-civic-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Group close markers into clusters"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clusters</span>
          </button>

          {/* Heatmap Toggle */}
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              showHeatmap
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Toggle telemetry heat density layer"
          >
            <Flame className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Heatmap</span>
          </button>
        </div>

        {/* Severity / Status Quick Filter Pills */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg rounded-xl p-1 flex gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setRoadFilter('all')}
            className={`px-2 py-1 rounded-lg font-medium transition-colors ${
              roadFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setRoadFilter('high')}
            className={`px-2 py-1 rounded-lg font-medium transition-colors ${
              roadFilter === 'high' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-rose-50'
            }`}
          >
            Critical
          </button>
          <button
            type="button"
            onClick={() => setRoadFilter('active')}
            className={`px-2 py-1 rounded-lg font-medium transition-colors ${
              roadFilter === 'active' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-amber-50'
            }`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setRoadFilter('repaired')}
            className={`px-2 py-1 rounded-lg font-medium transition-colors ${
              roadFilter === 'repaired' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-emerald-50'
            }`}
          >
            Fixed
          </button>
        </div>

        {/* Zoom & Locate Controls */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg rounded-xl overflow-hidden flex flex-col divide-y divide-slate-100">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="p-2 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="p-2 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleLocateMe}
            className="p-2 text-civic-600 hover:bg-civic-50 transition-colors"
            title="Locate my position via GPS"
          >
            <Crosshair className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.flyTo(VIT_AP_COORDINATES, DEFAULT_MAP_ZOOM, { duration: 1.2 })}
            className="p-2 text-slate-600 hover:text-civic-700 hover:bg-slate-100 transition-colors"
            title="Recenter to VIT-AP University Campus"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Report Mode Banner */}
      {isReportMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-civic-900/90 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full shadow-2xl border border-civic-700 flex items-center gap-2 pointer-events-none animate-bounce">
          <MapPin className="w-4 h-4 text-civic-300" />
          <span>Click anywhere on the road to drop report pin</span>
        </div>
      )}

      {/* Color Legend (Bottom Left) */}
      <div className="absolute bottom-6 left-4 z-[400] bg-white/95 backdrop-blur-md border border-slate-200 shadow-md rounded-xl p-2.5 text-[11px] text-slate-600 hidden sm:flex items-center gap-3">
        <span className="font-semibold text-slate-800">Status:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" /> Reported
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" /> Under Repair
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" /> Repaired
        </span>
      </div>

      {/* Actual Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />
    </div>
  );
}

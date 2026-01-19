import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import EmployeeLayout from '../../components/EmployeeLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Search, MapPin, Phone, User, Navigation, 
  FileText, Loader2, RefreshCw, Maximize2, X, ChevronDown
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// FAST Custom marker - Simple colored circle with number
const createFastMarker = (serialNo, status, isNearest = false) => {
  const colors = {
    'Pending': '#ef4444',    // RED
    'Completed': '#22c55e',  // GREEN
    'Approved': '#22c55e',   // GREEN
    'In Progress': '#eab308', // YELLOW
    'Rejected': '#f97316',   // ORANGE
    'default': '#ef4444'
  };
  const color = colors[status] || colors['default'];
  const size = isNearest ? 28 : 20;
  const fontSize = isNearest ? 11 : 9;
  
  return L.divIcon({
    className: 'fast-marker',
    html: `<div style="
      width:${size}px;
      height:${size}px;
      background:${color};
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 2px 4px rgba(0,0,0,0.3);
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:${fontSize}px;
      font-weight:700;
      color:white;
      ${isNearest ? 'animation:pulse 1s infinite;' : ''}
    ">${serialNo || '-'}</div>
    ${isNearest ? '<style>@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}</style>' : ''}`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  });
};

// Current location marker (blue dot)
const currentLocationIcon = L.divIcon({
  className: 'current-location-marker',
  html: `<div style="
    background:#3b82f6;
    width:14px;height:14px;
    border-radius:50%;
    border:3px solid white;
    box-shadow:0 0 10px rgba(59,130,246,0.5);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

// Calculate distance (Haversine)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const formatDistance = (meters) => meters < 1000 ? `${Math.round(meters)}m` : `${(meters/1000).toFixed(1)}km`;

// Simple Map Controller - Saves position to localStorage for stability
function MapController({ center, zoom, onPositionChange }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 17, { animate: false }); // No animation for stability
    }
  }, [center, zoom, map]);
  
  // Save map position when it changes
  useEffect(() => {
    const handleMoveEnd = () => {
      const newCenter = map.getCenter();
      const newZoom = map.getZoom();
      localStorage.setItem('surveyor_map_position', JSON.stringify({
        lat: newCenter.lat,
        lng: newCenter.lng,
        zoom: newZoom
      }));
      if (onPositionChange) {
        onPositionChange([newCenter.lat, newCenter.lng], newZoom);
      }
    };
    
    map.on('moveend', handleMoveEnd);
    return () => map.off('moveend', handleMoveEnd);
  }, [map, onPositionChange]);
  
  return null;
}

// Constants for lazy loading
const INITIAL_LOAD = 100;  // Load 100 properties first for better coverage
const LOAD_MORE = 50;      // Load 50 more on scroll

export default function Properties() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allProperties, setAllProperties] = useState([]); // All fetched properties
  const [displayCount, setDisplayCount] = useState(INITIAL_LOAD); // How many to show on map
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // GPS tracking
  const [userLocation, setUserLocation] = useState(null);
  const [gpsTracking, setGpsTracking] = useState(false);
  const watchIdRef = useRef(null);
  
  // UI state
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, rejected: 0 });
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(17);

  // Restore saved map position on mount
  useEffect(() => {
    const savedPosition = localStorage.getItem('surveyor_map_position');
    if (savedPosition) {
      try {
        const { lat, lng, zoom } = JSON.parse(savedPosition);
        setMapCenter([lat, lng]);
        setMapZoom(zoom || 17);
      } catch (e) {
        console.log('Could not restore map position');
      }
    }
  }, []);

  // Fetch properties on mount
  useEffect(() => {
    fetchProperties();
    startGPSTracking();
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const fetchProperties = async () => {
    try {
      // Use FAST map endpoint - returns only essential fields
      const response = await axios.get(`${API_URL}/map/employee-properties?limit=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const props = response.data.properties || [];
      setAllProperties(props);
      
      // Calculate stats
      const pending = props.filter(p => p.status === 'Pending').length;
      const completed = props.filter(p => ['Completed', 'Approved'].includes(p.status)).length;
      const rejected = props.filter(p => p.status === 'Rejected').length;
      setStats({ total: props.length, pending, completed, rejected });
      
      // Set initial map center
      const firstWithGPS = props.find(p => p.latitude && p.longitude);
      if (firstWithGPS) {
        setMapCenter([firstWithGPS.latitude, firstWithGPS.longitude]);
      }
    } catch (error) {
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const startGPSTracking = () => {
    if (!navigator.geolocation) return;
    setGpsTracking(true);
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000 }
    );
    
    // Watch with very low frequency for battery saving
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation(prev => {
          if (prev) {
            const dist = calculateDistance(prev.latitude, prev.longitude, pos.coords.latitude, pos.coords.longitude);
            if (dist < 200) return prev; // Only update if moved 200m+
          }
          return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        });
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 120000, timeout: 60000 } // Very relaxed for battery
    );
  };

  const refreshLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
        toast.success('Location updated!');
      },
      () => toast.error('Location failed')
    );
  };

  // Filter and sort properties - MEMOIZED for performance
  const filteredProperties = useMemo(() => {
    let filtered = [...allProperties];
    
    // Search filter
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(p => 
        p.property_id?.toLowerCase().includes(s) ||
        p.owner_name?.toLowerCase().includes(s) ||
        p.mobile?.includes(search)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }
    
    // Add distance and sort by distance if location available
    if (userLocation) {
      filtered = filtered.map(p => ({
        ...p,
        distance: (p.latitude && p.longitude) 
          ? calculateDistance(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude)
          : Infinity
      }));
      
      // Sort: Pending first, then by distance
      filtered.sort((a, b) => {
        const statusOrder = { 'Pending': 0, 'Rejected': 1, 'Completed': 2, 'Approved': 3 };
        const aOrder = statusOrder[a.status] ?? 2;
        const bOrder = statusOrder[b.status] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.distance || Infinity) - (b.distance || Infinity);
      });
    }
    
    return filtered;
  }, [allProperties, search, statusFilter, userLocation]);

  // Properties to show on map (limited for performance)
  const mapProperties = useMemo(() => {
    return filteredProperties
      .filter(p => p.latitude && p.longitude)
      .slice(0, displayCount);
  }, [filteredProperties, displayCount]);

  // Load more properties
  const loadMore = useCallback(() => {
    if (displayCount >= filteredProperties.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayCount(prev => Math.min(prev + LOAD_MORE, filteredProperties.length));
      setLoadingMore(false);
    }, 100);
  }, [displayCount, filteredProperties.length]);

  const getDefaultCenter = () => {
    if (mapCenter) return mapCenter;
    if (userLocation) return [userLocation.latitude, userLocation.longitude];
    return [29.9695, 76.8783]; // Default
  };

  if (loading) {
    return (
      <EmployeeLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Survey Properties</h1>
            <p className="text-xs text-slate-500">
              Showing {mapProperties.length} of {filteredProperties.length} on map
            </p>
          </div>
          <div className="flex items-center gap-2">
            {gpsTracking && (
              <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                GPS
              </div>
            )}
            <Button size="sm" variant="outline" onClick={refreshLocation}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-lg p-2 text-center border">
            <p className="text-lg font-bold text-slate-800">{stats.total}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className="bg-red-50 rounded-lg p-2 text-center border border-red-200">
            <p className="text-lg font-bold text-red-600">{stats.pending}</p>
            <p className="text-xs text-red-600">Pending</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center border border-green-200">
            <p className="text-lg font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-green-600">Done</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2 text-center border border-orange-200">
            <p className="text-lg font-bold text-orange-600">{stats.rejected}</p>
            <p className="text-xs text-orange-600">Rejected</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search ID, name, mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* MAP - Fast OpenStreetMap */}
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-500">
                <MapPin className="w-3 h-3 inline mr-1" />
                Map ({mapProperties.length} pins)
              </CardTitle>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setFullscreenMap(true)}
                className="h-7 text-xs"
              >
                <Maximize2 className="w-3 h-3 mr-1" />
                Full Map
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div style={{ height: '300px' }} className="rounded-b-lg overflow-hidden">
              <MapContainer
                center={getDefaultCenter()}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                {/* FAST OpenStreetMap tiles */}
                <TileLayer 
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                />
                <MapController 
                  center={mapCenter} 
                  zoom={mapZoom} 
                  onPositionChange={(center, zoom) => {
                    setMapCenter(center);
                    setMapZoom(zoom);
                  }}
                />
                
                {/* User location */}
                {userLocation && (
                  <Marker position={[userLocation.latitude, userLocation.longitude]} icon={currentLocationIcon}>
                    <Popup><b>📍 Your Location</b></Popup>
                  </Marker>
                )}
                
                {/* Property markers - LIMITED */}
                {mapProperties.map((property, index) => (
                  <Marker
                    key={property.id}
                    position={[property.latitude, property.longitude]}}
                    icon={createFastMarker(
                      property.bill_sr_no || property.serial_number || (index + 1),
                      property.status,
                      index === 0 && userLocation
                    )}
                  >
                    <Popup>
                      <div className="p-1 min-w-[150px]">
                        <div className="font-bold text-amber-600">Sr: {property.bill_sr_no || property.serial_number || '-'}</div>
                        <div className="text-xs text-blue-600 font-mono">{property.property_id}</div>
                        <div className="font-medium text-sm mt-1">{property.owner_name}</div>
                        <div className="text-xs text-slate-500">{property.colony || property.ward}</div>
                        {property.distance && property.distance !== Infinity && (
                          <div className="text-xs text-blue-600 mt-1">📍 {formatDistance(property.distance)}</div>
                        )}
                        <Button 
                          size="sm" 
                          className="w-full mt-2 h-7 text-xs bg-blue-600"
                          onClick={() => navigate(`/employee/survey/${property.id}`)}
                        >
                          Start Survey
                        </Button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        {/* Load More Button */}
        {displayCount < filteredProperties.filter(p => p.latitude && p.longitude).length && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ChevronDown className="w-4 h-4 mr-2" />
            )}
            Load More ({displayCount}/{filteredProperties.filter(p => p.latitude && p.longitude).length})
          </Button>
        )}

        {/* Property List - Top 10 nearest */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Nearest Properties</h2>
          {filteredProperties.slice(0, 10).map((property, index) => (
            <Card 
              key={property.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                index === 0 && userLocation ? 'border-2 border-green-500 bg-green-50' : ''
              }`}
              onClick={() => navigate(`/employee/survey/${property.id}`)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      property.status === 'Pending' ? 'bg-red-500' :
                      property.status === 'Completed' || property.status === 'Approved' ? 'bg-green-500' :
                      'bg-orange-500'
                    }`}>
                      {property.bill_sr_no || property.serial_number || index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{property.owner_name}</p>
                      <p className="text-xs text-slate-500">{property.colony || property.ward}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {property.distance && property.distance !== Infinity && (
                      <p className="text-xs text-blue-600 font-medium">{formatDistance(property.distance)}</p>
                    )}
                    <p className={`text-xs ${
                      property.status === 'Pending' ? 'text-red-600' : 'text-green-600'
                    }`}>{property.status}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* GPS Info */}
        {userLocation && (
          <p className="text-xs text-center text-slate-400 pb-4">
            📍 GPS Active • Tap property card to start survey
          </p>
        )}
      </div>

      {/* Fullscreen Map Modal */}
      {fullscreenMap && (
        <div className="fixed inset-0 z-[9999] bg-white">
          <div className="absolute top-0 left-0 right-0 z-[10000] bg-white/95 backdrop-blur-sm border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800">Full Map View</h2>
                <p className="text-xs text-slate-500">{mapProperties.length} properties</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setFullscreenMap(false)}>
                <X className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>
          </div>

          <div className="absolute inset-0 pt-16">
            <MapContainer
              center={getDefaultCenter()}
              zoom={17}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              {/* Satellite view for fullscreen */}
              <TileLayer 
                url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                maxZoom={21}
              />
              <MapController center={mapCenter} zoom={17} />
              
              {userLocation && (
                <Marker position={[userLocation.latitude, userLocation.longitude]} icon={currentLocationIcon}>
                  <Popup><b>📍 Your Location</b></Popup>
                </Marker>
              )}
              
              {mapProperties.map((property, index) => (
                <Marker
                  key={property.id}
                  position={[property.latitude, property.longitude]}
                  icon={createFastMarker(
                    property.bill_sr_no || property.serial_number || (index + 1),
                    property.status,
                    index === 0 && userLocation
                  )}
                >
                  <Popup>
                    <div className="p-2 min-w-[180px]">
                      <div className="text-lg font-bold text-amber-600">Sr: {property.bill_sr_no || property.serial_number || '-'}</div>
                      <div className="text-sm text-blue-600 font-mono">{property.property_id}</div>
                      <div className="font-semibold mt-1">{property.owner_name}</div>
                      <div className="text-sm text-slate-500">{property.colony}</div>
                      {property.mobile && <div className="text-sm">📱 {property.mobile}</div>}
                      {property.distance && property.distance !== Infinity && (
                        <div className="text-sm text-blue-600 mt-1">📍 {formatDistance(property.distance)}</div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Button 
                          size="sm" 
                          className="flex-1 h-8 bg-blue-600"
                          onClick={() => { setFullscreenMap(false); navigate(`/employee/survey/${property.id}`); }}
                        >
                          <FileText className="w-3 h-3 mr-1" /> Survey
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-8"
                          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`, '_blank')}
                        >
                          <Navigation className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Load more in fullscreen */}
          {displayCount < filteredProperties.filter(p => p.latitude && p.longitude).length && (
            <div className="absolute bottom-4 left-4 right-4 z-[10000]">
              <Button 
                className="w-full bg-blue-600"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                Load More Properties ({displayCount}/{filteredProperties.filter(p => p.latitude && p.longitude).length})
              </Button>
            </div>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}

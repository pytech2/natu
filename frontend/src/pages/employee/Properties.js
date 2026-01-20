import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import EmployeeLayout from '../../components/EmployeeLayout';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Search, MapPin, Navigation, FileText, Loader2, RefreshCw, 
  Compass, LocateFixed, ZoomIn, ZoomOut
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
    'Pending': '#ef4444',
    'Completed': '#22c55e',
    'Approved': '#22c55e',
    'In Progress': '#eab308',
    'Rejected': '#f97316',
    'default': '#ef4444'
  };
  const color = colors[status] || colors['default'];
  const size = isNearest ? 32 : 24;
  const fontSize = isNearest ? 12 : 10;
  
  return L.divIcon({
    className: 'fast-marker',
    html: `<div style="
      width:${size}px;
      height:${size}px;
      background:${color};
      border-radius:50%;
      border:3px solid white;
      box-shadow:0 3px 8px rgba(0,0,0,0.4);
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:${fontSize}px;
      font-weight:700;
      color:white;
      ${isNearest ? 'animation:pulse 1.5s infinite;' : ''}
    ">${serialNo || '-'}</div>
    ${isNearest ? '<style>@keyframes pulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(34,197,94,0.7)}50%{transform:scale(1.1);box-shadow:0 0 0 10px rgba(34,197,94,0)}}</style>' : ''}`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  });
};

// Current location marker (blue pulsing dot)
const currentLocationIcon = L.divIcon({
  className: 'current-location-marker',
  html: `<div style="
    position:relative;
    width:20px;height:20px;
  ">
    <div style="
      position:absolute;
      background:#3b82f6;
      width:16px;height:16px;
      border-radius:50%;
      border:3px solid white;
      box-shadow:0 0 10px rgba(59,130,246,0.8);
      top:2px;left:2px;
    "></div>
    <div style="
      position:absolute;
      background:rgba(59,130,246,0.3);
      width:40px;height:40px;
      border-radius:50%;
      top:-10px;left:-10px;
      animation:locationPulse 2s infinite;
    "></div>
  </div>
  <style>@keyframes locationPulse{0%,100%{transform:scale(1);opacity:0.5}50%{transform:scale(1.5);opacity:0}}</style>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
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

// Map Controller with rotation support
function MapController({ center, zoom, rotation, onPositionChange }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 18, { animate: false });
    }
  }, [center, zoom, map]);
  
  // Apply rotation to map container
  useEffect(() => {
    const container = map.getContainer();
    if (container) {
      container.style.transform = `rotate(${rotation || 0}deg)`;
      container.style.transformOrigin = 'center center';
    }
  }, [rotation, map]);
  
  // Save position on move
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

export default function Properties() {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [allProperties, setAllProperties] = useState([]);
  
  // GPS & Map state
  const [userLocation, setUserLocation] = useState(null);
  const [gpsTracking, setGpsTracking] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(18);
  const [mapRotation, setMapRotation] = useState(0);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  
  const watchIdRef = useRef(null);
  
  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });

  // Restore saved position
  useEffect(() => {
    const savedPosition = localStorage.getItem('surveyor_map_position');
    if (savedPosition) {
      try {
        const { lat, lng, zoom } = JSON.parse(savedPosition);
        setMapCenter([lat, lng]);
        setMapZoom(zoom || 18);
      } catch (e) {
        console.log('Could not restore map position');
      }
    }
  }, []);

  // Fetch properties
  useEffect(() => {
    fetchProperties();
    startGPSTracking();
    startCompass();
    
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await axios.get(`${API_URL}/map/employee-properties?limit=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const props = response.data.properties || [];
      setAllProperties(props);
      
      const pending = props.filter(p => p.status === 'Pending').length;
      const completed = props.filter(p => ['Completed', 'Approved', 'In Progress'].includes(p.status)).length;
      setStats({ total: props.length, pending, completed });
      
      // Set initial center if no saved position
      if (!mapCenter) {
        const firstWithGPS = props.find(p => p.latitude && p.longitude);
        if (firstWithGPS) {
          setMapCenter([firstWithGPS.latitude, firstWithGPS.longitude]);
        }
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
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(loc);
        if (!mapCenter) setMapCenter([loc.latitude, loc.longitude]);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000 }
    );
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation(prev => {
          if (prev) {
            const dist = calculateDistance(prev.latitude, prev.longitude, pos.coords.latitude, pos.coords.longitude);
            if (dist < 50) return prev;
          }
          return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 60000 }
    );
  };

  // Compass for device orientation
  const startCompass = () => {
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
  };

  const handleOrientation = (event) => {
    let heading = event.webkitCompassHeading || event.alpha;
    if (heading !== null && heading !== undefined) {
      // Normalize heading
      heading = (360 - heading) % 360;
      setDeviceHeading(Math.round(heading));
      if (autoRotate) {
        setMapRotation(-heading);
      }
    }
  };

  const refreshLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
        toast.success('Location updated!');
      },
      () => toast.error('Location failed'),
      { enableHighAccuracy: true }
    );
  };

  const toggleAutoRotate = () => {
    if (!autoRotate) {
      setAutoRotate(true);
      toast.success('Map rotation ON - follows compass');
    } else {
      setAutoRotate(false);
      setMapRotation(0);
      toast.info('Map rotation OFF');
    }
  };

  const resetRotation = () => {
    setMapRotation(0);
    setAutoRotate(false);
  };

  // Filter and sort by distance
  const sortedProperties = useMemo(() => {
    let props = [...allProperties].filter(p => p.latitude && p.longitude);
    
    if (userLocation) {
      props = props.map(p => ({
        ...p,
        distance: calculateDistance(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude)
      }));
      props.sort((a, b) => {
        const statusOrder = { 'Pending': 0, 'Rejected': 1, 'In Progress': 2, 'Completed': 3, 'Approved': 4 };
        if ((statusOrder[a.status] || 0) !== (statusOrder[b.status] || 0)) {
          return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        }
        return (a.distance || Infinity) - (b.distance || Infinity);
      });
    }
    
    return props;
  }, [allProperties, userLocation]);

  const getDefaultCenter = () => {
    if (mapCenter) return mapCenter;
    if (userLocation) return [userLocation.latitude, userLocation.longitude];
    return [29.9695, 76.8783];
  };

  if (loading) {
    return (
      <EmployeeLayout>
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
            <p className="text-white mt-4">Loading Map...</p>
          </div>
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout>
      {/* FULLSCREEN SATELLITE MAP */}
      <div className="fixed inset-0 z-0">
        <MapContainer
          center={getDefaultCenter()}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          zoomControl={false}
        >
          {/* Google Satellite Tiles */}
          <TileLayer 
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            maxZoom={21}
          />
          
          <MapController 
            center={mapCenter} 
            zoom={mapZoom}
            rotation={mapRotation}
            onPositionChange={(center, zoom) => {
              setMapCenter(center);
              setMapZoom(zoom);
            }}
          />
          
          {/* User location marker */}
          {userLocation && (
            <Marker position={[userLocation.latitude, userLocation.longitude]} icon={currentLocationIcon}>
              <Popup>
                <div className="text-center p-2">
                  <b className="text-blue-600">📍 Your Location</b>
                  <p className="text-xs text-slate-500 mt-1">
                    {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* Property markers */}
          {sortedProperties.map((property, index) => (
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
                <div className="p-2 min-w-[200px]">
                  <div className="text-xl font-bold text-amber-500">
                    #{property.bill_sr_no || property.serial_number || '-'}
                  </div>
                  <div className="text-sm text-blue-600 font-mono">{property.property_id}</div>
                  <div className="font-semibold text-base mt-2">{property.owner_name}</div>
                  <div className="text-sm text-slate-500">{property.colony}</div>
                  {property.mobile && (
                    <div className="text-sm mt-1">
                      <a href={`tel:${property.mobile}`} className="text-blue-600">📱 {property.mobile}</a>
                    </div>
                  )}
                  {property.distance && (
                    <div className="text-sm text-emerald-600 font-medium mt-1">
                      📍 {formatDistance(property.distance)} away
                    </div>
                  )}
                  <div className={`text-sm mt-1 font-medium ${
                    property.status === 'Pending' ? 'text-red-600' : 
                    property.status === 'In Progress' ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    Status: {property.status}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 h-10"
                      onClick={() => {
                        localStorage.setItem('surveyor_map_position', JSON.stringify({
                          lat: property.latitude,
                          lng: property.longitude,
                          zoom: mapZoom
                        }));
                        navigate(`/employee/survey/${property.id}`);
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Start Survey
                    </Button>
                    <Button 
                      variant="outline"
                      className="h-10 bg-white"
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`, '_blank')}
                    >
                      <Navigation className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* TOP STATUS BAR */}
      <div className="fixed top-0 left-0 right-0 z-[1000] bg-black/70 backdrop-blur-sm text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {gpsTracking && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-green-400">GPS</span>
                </div>
              )}
            </div>
            <div className="text-sm">
              <span className="text-red-400 font-bold">{stats.pending}</span>
              <span className="text-slate-400"> pending</span>
              <span className="mx-2 text-slate-600">|</span>
              <span className="text-green-400 font-bold">{stats.completed}</span>
              <span className="text-slate-400"> done</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Compass Heading Display */}
            <div 
              className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded-lg cursor-pointer"
              onClick={toggleAutoRotate}
            >
              <Compass 
                className={`w-5 h-5 ${autoRotate ? 'text-blue-400' : 'text-slate-400'}`}
                style={{ transform: `rotate(${deviceHeading}deg)` }}
              />
              <span className="text-xs font-mono">{deviceHeading}°</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAP CONTROLS - Right Side */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
        {/* Center on Location */}
        <Button
          size="sm"
          className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg"
          onClick={refreshLocation}
        >
          <LocateFixed className="w-6 h-6" />
        </Button>
        
        {/* Rotate Map */}
        <Button
          size="sm"
          className={`w-12 h-12 rounded-full shadow-lg ${autoRotate ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-700 hover:bg-slate-600'}`}
          onClick={toggleAutoRotate}
          title="Toggle auto-rotate"
        >
          <Compass className="w-6 h-6" />
        </Button>
        
        {/* Reset Rotation */}
        {mapRotation !== 0 && (
          <Button
            size="sm"
            className="w-12 h-12 rounded-full bg-orange-600 hover:bg-orange-700 shadow-lg"
            onClick={resetRotation}
            title="Reset north"
          >
            <span className="text-xs font-bold">N↑</span>
          </Button>
        )}
        
        {/* Refresh */}
        <Button
          size="sm"
          variant="outline"
          className="w-12 h-12 rounded-full bg-white shadow-lg"
          onClick={fetchProperties}
        >
          <RefreshCw className="w-5 h-5" />
        </Button>
      </div>

      {/* BOTTOM INFO BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-[1000] bg-black/80 backdrop-blur-sm text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-slate-400">Total: </span>
            <span className="font-bold">{sortedProperties.length}</span>
            <span className="text-slate-400"> properties</span>
          </div>
          
          {sortedProperties.length > 0 && sortedProperties[0].distance && (
            <div className="flex items-center gap-2 bg-green-600/30 px-3 py-1 rounded-full">
              <MapPin className="w-4 h-4 text-green-400" />
              <span className="text-sm">
                Nearest: <strong>{formatDistance(sortedProperties[0].distance)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </EmployeeLayout>
  );
}

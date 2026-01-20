import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import EmployeeLayout from '../../components/EmployeeLayout';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { 
  MapPin, Navigation, FileText, Loader2, RefreshCw, 
  Compass, LocateFixed, Layers
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

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

// Map container style - fullscreen
const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// Custom marker SVG creator
const createMarkerIcon = (serialNo, status, isNearest = false) => {
  const colors = {
    'Pending': '#ef4444',
    'Completed': '#22c55e',
    'Approved': '#22c55e',
    'In Progress': '#eab308',
    'Rejected': '#f97316',
    'default': '#ef4444'
  };
  const color = colors[status] || colors['default'];
  const size = isNearest ? 40 : 32;
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="white" stroke-width="3"/>
      <text x="${size/2}" y="${size/2 + 4}" text-anchor="middle" fill="white" font-size="${isNearest ? 14 : 11}" font-weight="bold" font-family="Arial">${serialNo || '-'}</text>
    </svg>
  `;
  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width: size, height: size },
    anchor: { x: size/2, y: size/2 },
  };
};

// User location marker (blue dot)
const userLocationIcon = {
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="rgba(59,130,246,0.3)"/>
      <circle cx="12" cy="12" r="6" fill="#3b82f6" stroke="white" stroke-width="2"/>
    </svg>
  `)}`,
  scaledSize: { width: 24, height: 24 },
  anchor: { x: 12, y: 12 },
};

// Calculate angle between two touch points
const getAngle = (touch1, touch2) => {
  const dx = touch2.clientX - touch1.clientX;
  const dy = touch2.clientY - touch1.clientY;
  return Math.atan2(dy, dx) * (180 / Math.PI);
};

export default function Properties() {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [allProperties, setAllProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  
  // GPS & Map state
  const [userLocation, setUserLocation] = useState(null);
  const [gpsTracking, setGpsTracking] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 29.9695, lng: 76.8783 });
  const [mapZoom, setMapZoom] = useState(18);
  const [mapRotation, setMapRotation] = useState(0);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [showHint, setShowHint] = useState(true);
  
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const watchIdRef = useRef(null);
  const touchStartAngleRef = useRef(0);
  const initialRotationRef = useRef(0);
  
  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });

  // Load Google Maps
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Hide hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Restore saved position
  useEffect(() => {
    const savedPosition = localStorage.getItem('surveyor_map_position');
    if (savedPosition) {
      try {
        const { lat, lng, zoom, rotation } = JSON.parse(savedPosition);
        setMapCenter({ lat, lng });
        setMapZoom(zoom || 18);
        setMapRotation(rotation || 0);
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

  // Two-finger rotation touch handlers
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let isMultiTouch = false;

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        isMultiTouch = true;
        setIsRotating(true);
        setShowHint(false);
        const angle = getAngle(e.touches[0], e.touches[1]);
        touchStartAngleRef.current = angle;
        initialRotationRef.current = mapRotation;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 2 && isMultiTouch) {
        const currentAngle = getAngle(e.touches[0], e.touches[1]);
        const angleDelta = currentAngle - touchStartAngleRef.current;
        
        // Smooth rotation calculation
        let newRotation = initialRotationRef.current + angleDelta;
        
        // Normalize to 0-360
        while (newRotation < 0) newRotation += 360;
        while (newRotation >= 360) newRotation -= 360;
        
        setMapRotation(newRotation);
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        isMultiTouch = false;
        setIsRotating(false);
        // Save position with rotation
        if (mapRef.current) {
          const center = mapRef.current.getCenter();
          localStorage.setItem('surveyor_map_position', JSON.stringify({
            lat: center.lat(),
            lng: center.lng(),
            zoom: mapRef.current.getZoom(),
            rotation: mapRotation
          }));
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [mapRotation]);

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
      
      const savedPosition = localStorage.getItem('surveyor_map_position');
      if (!savedPosition) {
        const firstWithGPS = props.find(p => p.latitude && p.longitude);
        if (firstWithGPS) {
          setMapCenter({ lat: firstWithGPS.latitude, lng: firstWithGPS.longitude });
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
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        const savedPosition = localStorage.getItem('surveyor_map_position');
        if (!savedPosition) setMapCenter(loc);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000 }
    );
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation(prev => {
          if (prev) {
            const dist = calculateDistance(prev.lat, prev.lng, pos.coords.latitude, pos.coords.longitude);
            if (dist < 30) return prev;
          }
          return { lat: pos.coords.latitude, lng: pos.coords.longitude };
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 }
    );
  };

  const startCompass = () => {
    if (window.DeviceOrientationEvent) {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(permission => {
            if (permission === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation, true);
            }
          })
          .catch(console.error);
      } else {
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    }
  };

  const handleOrientation = useCallback((event) => {
    let heading = event.webkitCompassHeading || (event.alpha !== null ? (360 - event.alpha) % 360 : null);
    if (heading !== null && heading !== undefined) {
      setDeviceHeading(Math.round(heading));
      if (autoRotate) {
        setMapRotation(heading);
      }
    }
  }, [autoRotate]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onMapIdle = useCallback(() => {
    if (mapRef.current && !isRotating) {
      const center = mapRef.current.getCenter();
      const zoom = mapRef.current.getZoom();
      
      localStorage.setItem('surveyor_map_position', JSON.stringify({
        lat: center.lat(),
        lng: center.lng(),
        zoom: zoom,
        rotation: mapRotation
      }));
    }
  }, [mapRotation, isRotating]);

  const refreshLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        if (mapRef.current) {
          mapRef.current.panTo(loc);
        }
        toast.success('Location updated!');
      },
      () => toast.error('Location failed'),
      { enableHighAccuracy: true }
    );
  };

  const toggleAutoRotate = () => {
    if (!autoRotate) {
      setAutoRotate(true);
      setMapRotation(deviceHeading);
      toast.success('Auto-rotate ON');
    } else {
      setAutoRotate(false);
      toast.info('Auto-rotate OFF');
    }
  };

  const resetNorth = () => {
    setMapRotation(0);
    setAutoRotate(false);
    toast.info('Reset to North');
  };

  const toggleMapType = () => {
    if (mapRef.current) {
      const currentType = mapRef.current.getMapTypeId();
      mapRef.current.setMapTypeId(currentType === 'satellite' ? 'hybrid' : 'satellite');
    }
  };

  // Filter and sort by distance
  const sortedProperties = useMemo(() => {
    let props = [...allProperties].filter(p => p.latitude && p.longitude);
    
    if (userLocation) {
      props = props.map(p => ({
        ...p,
        distance: calculateDistance(userLocation.lat, userLocation.lng, p.latitude, p.longitude)
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

  // Map options
  const mapOptions = useMemo(() => ({
    mapTypeId: 'satellite',
    gestureHandling: 'greedy',
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    scaleControl: false,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: false,
    minZoom: 10,
    maxZoom: 21,
    clickableIcons: false,
  }), []);

  // Loading states
  if (loadError) {
    return (
      <EmployeeLayout>
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
          <div className="text-center text-white">
            <p>Error loading maps</p>
            <p className="text-sm text-slate-400 mt-2">{loadError.message}</p>
          </div>
        </div>
      </EmployeeLayout>
    );
  }

  if (!isLoaded || loading) {
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
      {/* FULLSCREEN ROTATING MAP CONTAINER */}
      <div 
        ref={mapContainerRef}
        className="fixed inset-0 z-0 overflow-hidden"
        style={{
          transform: `rotate(${mapRotation}deg)`,
          transformOrigin: 'center center',
          transition: isRotating ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={mapZoom}
          options={mapOptions}
          onLoad={onMapLoad}
          onIdle={onMapIdle}
        >
          {/* User location marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={userLocationIcon}
              zIndex={1000}
            />
          )}
          
          {/* Property markers */}
          {sortedProperties.map((property, index) => (
            <Marker
              key={property.id}
              position={{ lat: property.latitude, lng: property.longitude }}
              icon={createMarkerIcon(
                property.bill_sr_no || property.serial_number || (index + 1),
                property.status,
                index === 0 && userLocation
              )}
              onClick={() => setSelectedProperty(property)}
              zIndex={index === 0 ? 999 : 100 - index}
            />
          ))}
          
          {/* Info Window for selected property */}
          {selectedProperty && (
            <InfoWindow
              position={{ lat: selectedProperty.latitude, lng: selectedProperty.longitude }}
              onCloseClick={() => setSelectedProperty(null)}
            >
              <div className="p-2 min-w-[220px] max-w-[280px]">
                <div className="text-xl font-bold text-amber-600">
                  #{selectedProperty.bill_sr_no || selectedProperty.serial_number || '-'}
                </div>
                <div className="text-xs text-blue-600 font-mono">{selectedProperty.property_id}</div>
                <div className="font-semibold text-base mt-2 text-gray-900">{selectedProperty.owner_name}</div>
                <div className="text-sm text-gray-600">{selectedProperty.colony}</div>
                {selectedProperty.mobile && (
                  <div className="text-sm mt-1">
                    <a href={`tel:${selectedProperty.mobile}`} className="text-blue-600 underline">
                      📱 {selectedProperty.mobile}
                    </a>
                  </div>
                )}
                {selectedProperty.distance && (
                  <div className="text-sm text-emerald-600 font-medium mt-1">
                    📍 {formatDistance(selectedProperty.distance)} away
                  </div>
                )}
                <div className={`text-sm mt-1 font-medium ${
                  selectedProperty.status === 'Pending' ? 'text-red-600' : 
                  selectedProperty.status === 'In Progress' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  Status: {selectedProperty.status}
                </div>
                <div className="flex gap-2 mt-3">
                  <button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                    onClick={() => {
                      localStorage.setItem('surveyor_map_position', JSON.stringify({
                        lat: selectedProperty.latitude,
                        lng: selectedProperty.longitude,
                        zoom: mapZoom,
                        rotation: mapRotation
                      }));
                      navigate(`/employee/survey/${selectedProperty.id}`);
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    Survey
                  </button>
                  <button 
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg"
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedProperty.latitude},${selectedProperty.longitude}`, '_blank')}
                  >
                    <Navigation className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* FIXED UI OVERLAY - Does NOT rotate */}
      <div className="fixed inset-0 z-[1000] pointer-events-none">
        {/* TOP STATUS BAR */}
        <div className="absolute top-0 left-0 right-0 bg-black/70 backdrop-blur-sm text-white px-4 py-3 pointer-events-auto">
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
              {/* Rotation indicator */}
              <div 
                className={`flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer ${isRotating ? 'bg-blue-600' : 'bg-slate-800'}`}
                onClick={toggleAutoRotate}
              >
                <Compass 
                  className={`w-5 h-5 ${autoRotate ? 'text-green-400' : 'text-slate-400'}`}
                  style={{ transform: `rotate(${mapRotation}deg)`, transition: 'transform 0.15s ease-out' }}
                />
                <span className="text-xs font-mono">{Math.round(mapRotation)}°</span>
              </div>
            </div>
          </div>
        </div>

        {/* MAP CONTROLS - Right Side */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto">
          {/* Map Type Toggle */}
          <Button
            size="sm"
            className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 shadow-lg"
            onClick={toggleMapType}
            title="Toggle map labels"
          >
            <Layers className="w-5 h-5" />
          </Button>

          {/* Center on Location */}
          <Button
            size="sm"
            className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg"
            onClick={refreshLocation}
            title="My location"
          >
            <LocateFixed className="w-6 h-6" />
          </Button>
          
          {/* Auto Rotate Toggle */}
          <Button
            size="sm"
            className={`w-12 h-12 rounded-full shadow-lg ${autoRotate ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-700 hover:bg-slate-600'}`}
            onClick={toggleAutoRotate}
            title="Auto-rotate with compass"
          >
            <Compass className="w-6 h-6" />
          </Button>
          
          {/* Reset North */}
          {Math.round(mapRotation) !== 0 && (
            <Button
              size="sm"
              className="w-12 h-12 rounded-full bg-orange-600 hover:bg-orange-700 shadow-lg"
              onClick={resetNorth}
              title="Reset to North"
            >
              <span className="text-xs font-bold">N↑</span>
            </Button>
          )}
          
          {/* Refresh Properties */}
          <Button
            size="sm"
            variant="outline"
            className="w-12 h-12 rounded-full bg-white shadow-lg"
            onClick={fetchProperties}
            title="Refresh properties"
          >
            <RefreshCw className="w-5 h-5 text-slate-700" />
          </Button>
        </div>

        {/* BOTTOM INFO BAR */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm text-white px-4 py-3 pointer-events-auto">
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

        {/* Rotation hint - fades out */}
        {showHint && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
            <div className="bg-black/70 text-white text-sm px-4 py-2 rounded-full animate-pulse">
              👆👆 Use two fingers to rotate 360°
            </div>
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}

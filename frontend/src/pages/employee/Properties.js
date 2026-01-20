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
  height: '100vh',
};

// Map options for smooth 360-degree rotation
const mapOptions = {
  mapTypeId: 'satellite',
  gestureHandling: 'greedy', // Enable all gestures including rotation
  disableDefaultUI: true, // Hide default UI for cleaner look
  zoomControl: false,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: true, // Enable rotation
  fullscreenControl: false,
  tilt: 0, // Start with no tilt
  heading: 0, // Start facing north
  minZoom: 10,
  maxZoom: 21,
  clickableIcons: false,
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
  
  // Create SVG data URL
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
  const [currentHeading, setCurrentHeading] = useState(0);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  
  const mapRef = useRef(null);
  const watchIdRef = useRef(null);
  
  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });

  // Load Google Maps
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Restore saved position
  useEffect(() => {
    const savedPosition = localStorage.getItem('surveyor_map_position');
    if (savedPosition) {
      try {
        const { lat, lng, zoom, heading } = JSON.parse(savedPosition);
        setMapCenter({ lat, lng });
        setMapZoom(zoom || 18);
        setCurrentHeading(heading || 0);
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
            if (dist < 30) return prev; // Only update if moved > 30m
          }
          return { lat: pos.coords.latitude, lng: pos.coords.longitude };
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 }
    );
  };

  // Compass for device orientation
  const startCompass = () => {
    if (window.DeviceOrientationEvent) {
      // Request permission on iOS
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
      if (autoRotate && mapRef.current) {
        mapRef.current.setHeading(heading);
      }
    }
  }, [autoRotate]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    if (currentHeading) {
      map.setHeading(currentHeading);
    }
  }, [currentHeading]);

  const onMapIdle = useCallback(() => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      const zoom = mapRef.current.getZoom();
      const heading = mapRef.current.getHeading() || 0;
      
      setCurrentHeading(heading);
      
      localStorage.setItem('surveyor_map_position', JSON.stringify({
        lat: center.lat(),
        lng: center.lng(),
        zoom: zoom,
        heading: heading
      }));
    }
  }, []);

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
      if (mapRef.current && deviceHeading) {
        mapRef.current.setHeading(deviceHeading);
      }
      toast.success('Auto-rotate ON - Map follows compass');
    } else {
      setAutoRotate(false);
      toast.info('Auto-rotate OFF');
    }
  };

  const resetNorth = () => {
    if (mapRef.current) {
      mapRef.current.setHeading(0);
      mapRef.current.setTilt(0);
    }
    setAutoRotate(false);
    setCurrentHeading(0);
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
      {/* FULLSCREEN GOOGLE MAP */}
      <div className="fixed inset-0 z-0">
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
                        heading: currentHeading
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
                className={`w-5 h-5 transition-transform ${autoRotate ? 'text-blue-400' : 'text-slate-400'}`}
                style={{ transform: `rotate(${deviceHeading}deg)` }}
              />
              <span className="text-xs font-mono">{Math.round(currentHeading)}°</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAP CONTROLS - Right Side */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
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
        {currentHeading !== 0 && (
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

{/* Clean map - no extra hints needed */}
    </EmployeeLayout>
  );
}

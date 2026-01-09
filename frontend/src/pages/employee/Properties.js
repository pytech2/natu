import { useState, useEffect, useRef } from 'react';
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
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'leaflet/dist/leaflet.css';
import { 
  Search, MapPin, Phone, User, ChevronRight, Navigation, 
  FileText, Download, Loader2, Locate, RefreshCw
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom numbered marker with animation for nearest
const createNumberedIcon = (number, status, isNearest = false) => {
  const colors = {
    'Pending': '#f97316',
    'Completed': '#22c55e',
    'Approved': '#22c55e',
    'In Progress': '#3b82f6',
    'Rejected': '#ef4444',
    'default': '#6b7280'
  };
  const color = colors[status] || colors['default'];
  const size = isNearest ? 32 : 22;
  const animation = isNearest ? 'animation: pulse-marker 1.5s ease-in-out infinite;' : '';
  const glow = isNearest ? 'box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.4), 0 0 15px rgba(251, 191, 36, 0.6);' : 'box-shadow: 0 2px 4px rgba(0,0,0,0.3);';
  
  return L.divIcon({
    className: 'custom-numbered-marker',
    html: `
      <style>
        @keyframes pulse-marker {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.4), 0 0 15px rgba(251, 191, 36, 0.6); }
          50% { transform: scale(1.15); box-shadow: 0 0 0 8px rgba(251, 191, 36, 0.2), 0 0 25px rgba(251, 191, 36, 0.8); }
        }
      </style>
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: ${isNearest ? '3px solid #fbbf24' : '2px solid white'};
        ${glow}
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isNearest ? '14px' : '10px'};
        font-weight: 700;
        color: white;
        ${animation}
      ">${number}</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  });
};

// Current location marker (blue dot)
const currentLocationIcon = L.divIcon({
  className: 'current-location-marker',
  html: `<div style="
    background-color: #3b82f6;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 10px rgba(59,130,246,0.5);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// Calculate distance between two points (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Format distance for display
const formatDistance = (meters) => {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

// Map Controller - Dynamic zoom based on distance from user to properties
function MapController({ properties, userLocation, fitKey }) {
  const map = useMap();
  
  useEffect(() => {
    const validProps = properties.filter(p => p.latitude && p.longitude);
    
    if (validProps.length === 0) return;
    
    // If no user location, just fit to all properties
    if (!userLocation || !userLocation.latitude) {
      const bounds = L.latLngBounds(validProps.map(p => [p.latitude, p.longitude]));
      map.flyToBounds(bounds, { padding: [50, 50], duration: 0.5 });
      return;
    }
    
    // Calculate distance to nearest property
    let nearestDistance = Infinity;
    let nearestProperty = null;
    
    validProps.forEach(p => {
      const dist = calculateDistance(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestProperty = p;
      }
    });
    
    // Dynamic zoom based on distance (in meters)
    // Far away = zoom out, Close = zoom in
    let zoomLevel;
    if (nearestDistance > 200000) {        // > 200 km
      zoomLevel = 6;
    } else if (nearestDistance > 100000) { // 100-200 km
      zoomLevel = 8;
    } else if (nearestDistance > 50000) {  // 50-100 km
      zoomLevel = 9;
    } else if (nearestDistance > 20000) {  // 20-50 km
      zoomLevel = 10;
    } else if (nearestDistance > 10000) {  // 10-20 km
      zoomLevel = 11;
    } else if (nearestDistance > 5000) {   // 5-10 km
      zoomLevel = 12;
    } else if (nearestDistance > 2000) {   // 2-5 km
      zoomLevel = 13;
    } else if (nearestDistance > 1000) {   // 1-2 km
      zoomLevel = 14;
    } else if (nearestDistance > 500) {    // 500m - 1km
      zoomLevel = 15;
    } else if (nearestDistance > 200) {    // 200-500m
      zoomLevel = 16;
    } else if (nearestDistance > 50) {     // 50-200m
      zoomLevel = 17;
    } else {                                // < 50m (very close)
      zoomLevel = 18;
    }
    
    // Create bounds including user and all properties
    const allPoints = [
      [userLocation.latitude, userLocation.longitude],
      ...validProps.map(p => [p.latitude, p.longitude])
    ];
    const bounds = L.latLngBounds(allPoints);
    
    // Calculate center between user and nearest property
    const centerLat = (userLocation.latitude + nearestProperty.latitude) / 2;
    const centerLng = (userLocation.longitude + nearestProperty.longitude) / 2;
    
    // Fly to calculated center with dynamic zoom
    map.flyTo([centerLat, centerLng], zoomLevel, { duration: 0.8 });
    
    console.log(`Distance to nearest: ${(nearestDistance/1000).toFixed(1)}km, Zoom: ${zoomLevel}`);
    
  }, [map, fitKey, userLocation]);
  
  return null;
}

export default function Properties() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const mapContainerRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // GPS tracking
  const [userLocation, setUserLocation] = useState(null);
  const [gpsTracking, setGpsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const watchIdRef = useRef(null);
  
  // UI state
  const [downloading, setDownloading] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });
  const [fitKey, setFitKey] = useState(0); // Key to trigger map fit

  useEffect(() => {
    fetchProperties();
    startGPSTracking();
    
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Filter and sort properties when filters or location changes
  useEffect(() => {
    let filtered = [...properties];
    
    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p => 
        p.property_id?.toLowerCase().includes(searchLower) ||
        p.owner_name?.toLowerCase().includes(searchLower) ||
        p.mobile?.includes(search)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }
    
    // Sort by distance if user location is available
    if (userLocation) {
      filtered = filtered.map(p => ({
        ...p,
        distance: p.latitude && p.longitude 
          ? calculateDistance(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude)
          : Infinity
      })).sort((a, b) => a.distance - b.distance);
    }
    
    setFilteredProperties(filtered);
  }, [properties, search, statusFilter, userLocation]);

  const fetchProperties = async () => {
    try {
      const response = await axios.get(`${API_URL}/employee/properties?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const props = response.data.properties || [];
      setProperties(props);
      
      const pending = props.filter(p => p.status === 'Pending').length;
      const completed = props.filter(p => ['Completed', 'Approved'].includes(p.status)).length;
      setStats({ total: props.length, pending, completed });
    } catch (error) {
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const startGPSTracking = () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported');
      return;
    }
    
    setGpsTracking(true);
    
    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLastUpdate(new Date());
      },
      (err) => console.error('GPS error:', err),
      { enableHighAccuracy: true }
    );
    
    // Watch position for continuous updates (every 25m movement or 5 seconds)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLastUpdate(new Date());
      },
      (err) => console.error('GPS watch error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000, distanceFilter: 25 }
    );
  };

  const refreshLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLastUpdate(new Date());
        toast.success('Location updated!');
      },
      () => toast.error('Failed to get location')
    );
  };

  const getDefaultCenter = () => {
    if (userLocation) return [userLocation.latitude, userLocation.longitude];
    const valid = filteredProperties.filter(p => p.latitude && p.longitude);
    if (valid.length > 0) return [valid[0].latitude, valid[0].longitude];
    return [29.9695, 76.8783];
  };

  // Download map as PDF
  const handlePrintMap = async () => {
    if (!mapContainerRef.current) return;
    setDownloading(true);
    toast.info('Generating PDF...');
    try {
      await new Promise(r => setTimeout(r, 1000));
      const canvas = await html2canvas(mapContainerRef.current, { useCORS: true, scale: 2, backgroundColor: '#fff' });
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('NSTU INDIA PRIVATE LIMITED', 105, 12, { align: 'center' });
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Surveyor: ${user?.name} | Date: ${new Date().toLocaleDateString('en-IN')}`, 105, 20, { align: 'center' });
      pdf.text(`Total: ${stats.total} | Pending: ${stats.pending} | Done: ${stats.completed}`, 105, 26, { align: 'center' });
      
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 32, imgWidth, Math.min(imgHeight, 240));
      pdf.save(`survey_map_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF downloaded!');
    } catch (e) {
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
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
        {/* Header with GPS status */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Assigned Properties</h1>
            <p className="text-xs text-slate-500">{filteredProperties.length} of {stats.total} properties</p>
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

        {/* Search & Filters */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search ID, owner name, mobile..."
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

        {/* MAP - Always Visible */}
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-500">
                <MapPin className="w-3 h-3 inline mr-1" />
                Map ({filteredProperties.length} pins)
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setFitKey(k => k + 1)}
                  className="h-7 text-xs text-blue-600 border-blue-300"
                >
                  <Locate className="w-3 h-3 mr-1" />
                  Fit All
                </Button>
                <Button size="sm" onClick={handlePrintMap} disabled={downloading} className="h-7 text-xs">
                  {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                  Print
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div ref={mapContainerRef} style={{ height: '280px' }} className="rounded-b-lg overflow-hidden">
              <MapContainer
                center={getDefaultCenter()}
                zoom={14}
                minZoom={10}
                maxZoom={18}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapController properties={filteredProperties} userLocation={userLocation} fitKey={fitKey} />
                
                {/* User location marker */}
                {userLocation && (
                  <Marker position={[userLocation.latitude, userLocation.longitude]} icon={currentLocationIcon}>
                    <Popup>
                      <div className="text-center">
                        <p className="font-bold text-blue-600">Your Location</p>
                      </div>
                    </Popup>
                  </Marker>
                )}
                
                {/* Property markers - nearest one highlighted */}
                {filteredProperties.filter(p => p.latitude && p.longitude).map((property, index) => (
                  <Marker
                    key={property.id}
                    position={[property.latitude, property.longitude]}
                    icon={createNumberedIcon(property.serial_number || index + 1, property.status, index === 0 && userLocation)}
                  >
                    <Popup maxWidth={220}>
                      <div className="p-1 min-w-[160px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-blue-600">#{property.serial_number || index + 1}</span>
                          {index === 0 && userLocation && <span className="text-xs bg-amber-500 text-white px-1 rounded">Nearest</span>}
                        </div>
                        <p className="font-semibold text-sm">{property.owner_name}</p>
                        <p className="text-xs text-slate-500">{property.colony}</p>
                        {property.distance !== Infinity && (
                          <p className="text-xs text-blue-600">📍 {formatDistance(property.distance)}</p>
                        )}
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" className="flex-1 h-6 text-xs bg-blue-600" onClick={() => navigate(`/employee/survey/${property.id}`)}>
                            Survey
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`, '_blank')}>
                            <Navigation className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-lg p-2 text-center border">
            <p className="text-lg font-bold text-slate-800">{stats.total}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2 text-center border border-orange-200">
            <p className="text-lg font-bold text-orange-600">{stats.pending}</p>
            <p className="text-xs text-orange-600">Pending</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-200">
            <p className="text-lg font-bold text-emerald-600">{stats.completed}</p>
            <p className="text-xs text-emerald-600">Done</p>
          </div>
        </div>

        {/* Property List */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Property List (Nearest First)</h2>
          {filteredProperties.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-slate-500">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No properties found</p>
              </CardContent>
            </Card>
          ) : (
            filteredProperties.map((property, index) => (
              <Card 
                key={property.id} 
                className={`cursor-pointer hover:shadow-md transition-shadow ${index === 0 && userLocation ? 'border-amber-400 border-2 bg-amber-50' : ''}`}
                onClick={() => navigate(`/employee/survey/${property.id}`)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                      index === 0 && userLocation ? 'bg-amber-500 ring-2 ring-amber-300 ring-offset-1' :
                      property.status === 'Pending' ? 'bg-orange-500' :
                      property.status === 'Completed' || property.status === 'Approved' ? 'bg-emerald-500' : 'bg-slate-500'
                    }`}>
                      {property.serial_number || index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-blue-600">{property.property_id}</span>
                        {index === 0 && userLocation && (
                          <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">Nearest</span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-800 truncate">{property.owner_name}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 truncate">{property.colony}</span>
                        {property.distance !== undefined && property.distance !== Infinity && (
                          <span className="text-xs font-medium text-blue-600 flex-shrink-0 ml-2">
                            📍 {formatDistance(property.distance)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* GPS Info */}
        {userLocation && lastUpdate && (
          <p className="text-xs text-center text-slate-400 pb-4">
            📍 GPS: {lastUpdate.toLocaleTimeString()} • Nearest property highlighted
          </p>
        )}
      </div>
    </EmployeeLayout>
  );
}

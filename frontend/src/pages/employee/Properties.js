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
  FileText, Download, Loader2, Locate, RefreshCw, List, Map as MapIcon
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

// Map Controller - handles zoom and bounds
function MapController({ properties, userLocation, fitKey }) {
  const map = useMap();
  
  useEffect(() => {
    const validProps = properties.filter(p => p.latitude && p.longitude);
    console.log('MapController: Valid properties:', validProps.length);
    
    if (validProps.length > 0) {
      const coords = validProps.map(p => [p.latitude, p.longitude]);
      console.log('MapController: First coord:', coords[0]);
      
      const bounds = L.latLngBounds(coords);
      
      if (userLocation && userLocation.latitude) {
        bounds.extend([userLocation.latitude, userLocation.longitude]);
      }
      
      // Fly to bounds with animation
      map.flyToBounds(bounds, { 
        padding: [50, 50],
        duration: 0.5,
        maxZoom: 16
      });
    }
  }, [map, fitKey]); // Only re-run when fitKey changes
  
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
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
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
      <div className="space-y-4">
        {/* Header with GPS status */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Assigned Properties</h1>
            <p className="text-sm text-slate-500">{filteredProperties.length} of {stats.total} properties</p>
          </div>
          <div className="flex items-center gap-2">
            {gpsTracking && (
              <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                GPS Active
              </div>
            )}
            <Button size="sm" variant="outline" onClick={refreshLocation}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search ID, owner name, mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1">
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
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
              <button
                onClick={() => { setViewMode('map'); setTimeout(() => setFitKey(k => k + 1), 100); }}
                className={`inline-flex items-center justify-center h-9 w-9 rounded-md border font-medium transition-all
                  ${viewMode === 'map' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30 animate-bounce'
                  }`}
                style={viewMode !== 'map' ? {
                  animation: 'pulse-glow 1.5s ease-in-out infinite'
                } : {}}
              >
                <MapIcon className="w-4 h-4" />
              </button>
              <style>{`
                @keyframes pulse-glow {
                  0%, 100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5), 0 4px 6px rgba(59, 130, 246, 0.3); transform: scale(1); }
                  50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 0 4px 15px rgba(59, 130, 246, 0.5); transform: scale(1.05); }
                }
              `}</style>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-lg p-3 text-center border">
            <p className="text-xl font-bold text-slate-800">{stats.total}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200">
            <p className="text-xl font-bold text-orange-600">{stats.pending}</p>
            <p className="text-xs text-orange-600">Pending</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
            <p className="text-xl font-bold text-emerald-600">{stats.completed}</p>
            <p className="text-xs text-emerald-600">Done</p>
          </div>
        </div>

        {viewMode === 'list' ? (
          /* Property List - Sorted by nearest */
          <div className="space-y-2">
            {filteredProperties.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-slate-500">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No properties found</p>
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
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        property.status === 'Pending' ? 'bg-orange-500' :
                        property.status === 'Completed' || property.status === 'Approved' ? 'bg-emerald-500' : 'bg-slate-500'
                      }`}>
                        {property.serial_number || index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-blue-600">{property.property_id}</span>
                          {index === 0 && userLocation && (
                            <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">Nearest</span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-800 truncate">{property.owner_name}</p>
                        <p className="text-xs text-slate-500 truncate">{property.address || property.colony}</p>
                        <div className="flex items-center justify-between mt-1">
                          {property.mobile && (
                            <span className="text-xs text-slate-600">📱 {property.mobile}</span>
                          )}
                          {property.distance !== undefined && property.distance !== Infinity && (
                            <span className="text-xs font-medium text-blue-600">
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
        ) : (
          /* Map View */
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Properties Map ({filteredProperties.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setTriggerFit(t => t + 1)}
                    className="text-blue-600 border-blue-300"
                  >
                    <Locate className="w-4 h-4 mr-1" />
                    Full View
                  </Button>
                  <Button size="sm" onClick={handlePrintMap} disabled={downloading}>
                    {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                    Print
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setViewMode('list')} className="text-slate-600">
                    ✕
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={mapContainerRef} style={{ height: '500px' }} className="rounded-b-lg overflow-hidden">
                <MapContainer
                  center={getDefaultCenter()}
                  zoom={14}
                  minZoom={10}
                  maxZoom={18}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FitBounds properties={filteredProperties} userLocation={userLocation} triggerFit={triggerFit} />
                  
                  {/* User location marker */}
                  {userLocation && (
                    <Marker position={[userLocation.latitude, userLocation.longitude]} icon={currentLocationIcon}>
                      <Popup>
                        <div className="text-center">
                          <p className="font-bold text-blue-600">Your Location</p>
                          <p className="text-xs">{userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  
                  {/* Property markers */}
                  {filteredProperties.filter(p => p.latitude && p.longitude).map((property, index) => (
                    <Marker
                      key={property.id}
                      position={[property.latitude, property.longitude]}
                      icon={createNumberedIcon(property.serial_number || index + 1, property.status, index === 0 && userLocation)}
                    >
                      <Popup maxWidth={250}>
                        <div className="p-1 min-w-[180px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-blue-600">#{property.serial_number || index + 1}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              property.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>{property.status}</span>
                          </div>
                          <p className="font-semibold text-sm">{property.owner_name}</p>
                          <p className="text-xs text-slate-500">{property.address || property.colony}</p>
                          {property.distance !== Infinity && (
                            <p className="text-xs text-blue-600 mt-1">📍 {formatDistance(property.distance)} away</p>
                          )}
                          <div className="flex gap-1 mt-2">
                            <Button size="sm" className="flex-1 h-7 text-xs bg-blue-600" onClick={() => navigate(`/employee/survey/${property.id}`)}>
                              <FileText className="w-3 h-3 mr-1" /> Survey
                            </Button>
                            <Button size="sm" variant="outline" className="h-7" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`, '_blank')}>
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
        )}

        {/* GPS Info */}
        {userLocation && lastUpdate && (
          <p className="text-xs text-center text-slate-400">
            📍 GPS updated: {lastUpdate.toLocaleTimeString()} • Nearest property shown first
          </p>
        )}
      </div>
    </EmployeeLayout>
  );
}

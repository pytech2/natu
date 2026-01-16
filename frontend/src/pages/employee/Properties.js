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
import 'leaflet-rotate';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'leaflet/dist/leaflet.css';
import { 
  Search, MapPin, Phone, User, ChevronRight, Navigation, 
  FileText, Download, Loader2, Locate, RefreshCw, Maximize2, X, Lock
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker showing SERIAL NUMBER prominently with Property ID below
const createPropertyIdIcon = (propertyId, status, isNearest = false, serialNo = null) => {
  const colors = {
    'Pending': '#ef4444',       // RED - pending (no survey)
    'Completed': '#eab308',     // YELLOW - survey completed
    'Approved': '#22c55e',      // GREEN - survey approved
    'In Progress': '#eab308',   // YELLOW
    'Rejected': '#ef4444',      // Red
    'default': '#22c55e'        // Green default
  };
  const color = colors[status] || colors['default'];
  const displaySerial = serialNo || '-';
  
  if (isNearest) {
    // Nearest property - larger with animation, shows SERIAL NUMBER prominently
    return L.divIcon({
      className: 'property-id-marker-nearest',
      html: `
        <div style="
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        ">
          <div style="
            background-color: ${color};
            padding: 2px 6px;
            border-radius: 4px;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            font-size: 14px;
            font-weight: 800;
            color: white;
            white-space: nowrap;
            line-height: 1.2;
            text-align: center;
            animation: pulse 1.5s ease-in-out infinite;
          ">
            <div style="font-size: 16px;">${displaySerial}</div>
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid ${color};
            margin-top: -1px;
          "></div>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
          }
        </style>`,
      iconSize: [50, 30],
      iconAnchor: [25, 30],
      popupAnchor: [0, -26]
    });
  }
  
  // Regular marker with Serial Number prominently displayed
  return L.divIcon({
    className: 'property-id-marker',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
      ">
        <div style="
          background-color: ${color};
          padding: 1px 4px;
          border-radius: 3px;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
          font-size: 11px;
          font-weight: 700;
          color: white;
          white-space: nowrap;
          line-height: 1.2;
          text-align: center;
        ">${displaySerial}</div>
        <div style="
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 4px solid ${color};
          margin-top: -1px;
        "></div>
      </div>`,
    iconSize: [40, 22],
    iconAnchor: [20, 22],
    popupAnchor: [0, -18]
  });
};

// Keep old function for backward compatibility but redirect to new one
const createNumberedIcon = (number, status, isNearest = false, propertyId = null) => {
  // If propertyId is provided, use the new Property ID marker
  if (propertyId) {
    return createPropertyIdIcon(propertyId, status, isNearest);
  }
  
  // Fallback to numbered marker
  const colors = {
    'Pending': '#ef4444',       // RED
    'Completed': '#eab308',     // YELLOW
    'Approved': '#22c55e',      // GREEN
    'In Progress': '#eab308',
    'Rejected': '#ef4444',
    'default': '#22c55e'
  };
  const color = colors[status] || colors['default'];
  const size = isNearest ? 40 : 22;
  
  if (isNearest) {
    return L.divIcon({
      className: 'nearest-marker-animated',
      html: `
        <style>
          @keyframes pulse-green {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.15); }
          }
        </style>
        <div style="
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: 4px solid white;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 900;
          color: white;
          animation: pulse-green 1.2s ease-in-out infinite;
        ">${number}</div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2]
    });
  }
  
  return L.divIcon({
    className: 'custom-numbered-marker',
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      color: white;
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

// Map Controller - Only auto-zoom on first load, then let user control
function MapController({ properties, userLocation, fitKey }) {
  const map = useMap();
  const hasInitialized = useRef(false);
  const lastFitKey = useRef(null);
  
  useEffect(() => {
    const validProps = properties.filter(p => p.latitude && p.longitude);
    
    if (validProps.length === 0) return;
    
    // Only auto-fit when fitKey changes (user clicks "Fit All") or on first load
    const shouldFit = !hasInitialized.current || (fitKey && fitKey !== lastFitKey.current);
    
    if (!shouldFit) return;
    
    hasInitialized.current = true;
    lastFitKey.current = fitKey;
    
    // If no user location, fit to first property at high zoom
    if (!userLocation || !userLocation.latitude) {
      const firstProp = validProps[0];
      map.setView([firstProp.latitude, firstProp.longitude], 18, { animate: true, duration: 0.5 });
      return;
    }
    
    // Calculate distance to nearest property
    let nearestDistance = Infinity;
    let nearestProperty = validProps[0];
    
    validProps.forEach(p => {
      const dist = calculateDistance(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestProperty = p;
      }
    });
    
    // Set zoom based on distance - start zoomed in, let user zoom out if needed
    let zoomLevel = 18; // Default high zoom
    
    if (nearestDistance > 100000) {      // > 100 km - very far
      zoomLevel = 12;
    } else if (nearestDistance > 50000) { // 50-100 km
      zoomLevel = 14;
    } else if (nearestDistance > 10000) { // 10-50 km
      zoomLevel = 15;
    } else if (nearestDistance > 5000) {  // 5-10 km
      zoomLevel = 16;
    } else if (nearestDistance > 1000) {  // 1-5 km
      zoomLevel = 17;
    } else {                               // < 1 km - close
      zoomLevel = 18;
    }
    
    // Center on nearest property (not user location)
    map.setView([nearestProperty.latitude, nearestProperty.longitude], zoomLevel, { 
      animate: true, 
      duration: 0.5 
    });
    
    console.log(`Initial zoom set: Distance ${(nearestDistance/1000).toFixed(1)}km, Zoom: ${zoomLevel}`);
    
  }, [map, fitKey]); // Only depend on fitKey, not userLocation or properties
  
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
  const [fullscreenMap, setFullscreenMap] = useState(false); // Fullscreen map mode

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
  // Use useRef to prevent unnecessary recalculations
  const lastLocationRef = useRef(null);
  
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
    
    // Status filter - show pending first by default, but allow filtering
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }
    
    // Sort by distance if user location is available
    // Only recalculate distances when location changes significantly (>50m)
    const shouldRecalculate = !lastLocationRef.current || !userLocation ||
      calculateDistance(
        lastLocationRef.current.latitude, lastLocationRef.current.longitude,
        userLocation?.latitude || 0, userLocation?.longitude || 0
      ) > 50;
    
    if (userLocation && shouldRecalculate) {
      lastLocationRef.current = { ...userLocation };
      filtered = filtered.map(p => ({
        ...p,
        distance: p.latitude && p.longitude 
          ? calculateDistance(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude)
          : Infinity
      }));
    } else if (userLocation) {
      // Use cached distances from previous calculation
      filtered = filtered.map(p => ({
        ...p,
        distance: p.distance !== undefined ? p.distance : (
          p.latitude && p.longitude 
            ? calculateDistance(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude)
            : Infinity
        )
      }));
    }
    
    // Sort: Pending properties first, then by distance
    filtered.sort((a, b) => {
      // Priority: Pending > Rejected > Completed/Approved
      const statusOrder = { 'Pending': 0, 'Rejected': 1, 'Completed': 2, 'Approved': 3 };
      const aOrder = statusOrder[a.status] ?? 2;
      const bOrder = statusOrder[b.status] ?? 2;
      
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      // Then by distance
      return (a.distance || Infinity) - (b.distance || Infinity);
    });
    
    setFilteredProperties(filtered);
  }, [properties, search, statusFilter, userLocation?.latitude, userLocation?.longitude]);

  const fetchProperties = async () => {
    try {
      const response = await axios.get(`${API_URL}/employee/properties?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const props = response.data.properties || [];
      setProperties(props);
      
      const pending = props.filter(p => p.status === 'Pending').length;
      const completed = props.filter(p => ['Completed', 'Approved'].includes(p.status)).length;
      const rejected = props.filter(p => p.status === 'Rejected').length;
      setStats({ total: props.length, pending, completed, rejected });
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
    
    // Watch position for continuous updates - REDUCED FREQUENCY to avoid performance issues
    // Only update every 50m movement or 30 seconds max
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation(prev => {
          // Only update if moved more than 50m to prevent constant re-renders
          if (prev) {
            const dist = calculateDistance(prev.latitude, prev.longitude, pos.coords.latitude, pos.coords.longitude);
            if (dist < 50) return prev; // Skip small movements
          }
          return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        });
        setLastUpdate(new Date());
      },
      (err) => console.error('GPS watch error:', err),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 }
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

  // Download map as PDF - Full zoom for field use
  const handlePrintMap = async () => {
    if (!mapContainerRef.current) return;
    setDownloading(true);
    toast.info('Generating full map PDF...');
    
    try {
      // Wait for map to fully render
      await new Promise(r => setTimeout(r, 1500));
      
      // Capture map at high quality
      const canvas = await html2canvas(mapContainerRef.current, { 
        useCORS: true, 
        scale: 3,  // High quality for print
        backgroundColor: '#fff',
        logging: false
      });
      
      // Create PDF in landscape for full map view
      const pdf = new jsPDF('l', 'mm', 'a4');  // Landscape A4: 297mm x 210mm
      
      // Header - Company Name
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('NSTU INDIA PRIVATE LIMITED', 148.5, 12, { align: 'center' });
      
      // Sub-header - Survey Map
      pdf.setFontSize(14);
      pdf.text('SURVEY MAP', 148.5, 20, { align: 'center' });
      
      // Info line
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Surveyor: ${user?.name || 'N/A'} | Date: ${new Date().toLocaleDateString('en-IN')} | ${stats.total} properties`, 148.5, 27, { align: 'center' });
      
      // Legend - horizontal, below info
      pdf.setFontSize(9);
      const legendY = 33;
      
      // Pending - Orange
      pdf.setFillColor(249, 115, 22);
      pdf.circle(100, legendY, 3, 'F');
      pdf.setTextColor(0, 0, 0);
      pdf.text('Pending', 105, legendY + 1);
      
      // Done - Pink
      pdf.setFillColor(236, 72, 153);
      pdf.circle(135, legendY, 3, 'F');
      pdf.text('Done', 140, legendY + 1);
      
      // Nearest - Green
      pdf.setFillColor(34, 197, 94);
      pdf.circle(165, legendY, 3, 'F');
      pdf.text('Nearest', 170, legendY + 1);
      
      // Stats
      pdf.setFontSize(8);
      pdf.text(`Pending: ${stats.pending} | Done: ${stats.completed}`, 210, legendY + 1);
      
      // Map image - FULL WIDTH, maximum height
      const mapStartY = 40;
      const imgWidth = 287;  // A4 landscape width minus small margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const maxMapHeight = 160;  // Maximum height for map
      
      pdf.addImage(
        canvas.toDataURL('image/png'), 
        'PNG', 
        5,  // Left margin
        mapStartY, 
        imgWidth, 
        Math.min(imgHeight, maxMapHeight)
      );
      
      // Footer
      pdf.setFontSize(7);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Generated: ${new Date().toLocaleString('en-IN')} | Print at 100% zoom for field use`, 148.5, 205, { align: 'center' });
      
      // Save
      pdf.save(`survey_map_${user?.name || 'surveyor'}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Map PDF downloaded! Print at 100% zoom.');
    } catch (e) {
      console.error('PDF generation error:', e);
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
                  onClick={() => { setFullscreenMap(true); setTimeout(() => setFitKey(k => k + 1), 100); }}
                  className="h-7 text-xs text-blue-600 border-blue-300 animate-pulse"
                >
                  <Maximize2 className="w-3 h-3 mr-1" />
                  Full Size Map
                </Button>
                <Button size="sm" onClick={handlePrintMap} disabled={downloading} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                  Download PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div ref={mapContainerRef} style={{ height: '280px' }} className="rounded-b-lg overflow-hidden">
              <MapContainer
                center={getDefaultCenter()}
                zoom={18}
                minZoom={10}
                maxZoom={21}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                {/* Google Satellite - High quality */}
                <TileLayer 
                  url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                  maxZoom={21}
                />
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
                
                {/* Property markers with SERIAL NUMBER labels */}
                {filteredProperties.filter(p => p.latitude && p.longitude).slice(0, 100).map((property, index) => (
                  <Marker
                    key={property.id}
                    position={[property.latitude, property.longitude]}
                    icon={createPropertyIdIcon(
                      property.property_id, 
                      property.status, 
                      index === 0 && userLocation,
                      property.serial_na ? 'N/A' : (property.bill_sr_no || property.serial_number || index + 1)
                    )}
                  >
                    <Popup maxWidth={220}>
                      <div className="p-1 min-w-[160px]">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-lg font-bold text-amber-600">Sr: {property.serial_na ? 'N/A' : (property.bill_sr_no || property.serial_number || '-')}</span>
                            <p className="text-xs text-blue-600 font-mono">{property.property_id}</p>
                          </div>
                          {index === 0 && userLocation && <span className="text-xs bg-green-500 text-white px-1 rounded animate-pulse">Nearest</span>}
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
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-lg p-2 text-center border">
            <p className="text-lg font-bold text-slate-800">{stats.total}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2 text-center border border-orange-200">
            <p className="text-lg font-bold text-orange-600">{stats.pending}</p>
            <p className="text-xs text-orange-600">Pending</p>
          </div>
          <div className="bg-pink-50 rounded-lg p-2 text-center border border-pink-200">
            <p className="text-lg font-bold text-pink-600">{stats.completed}</p>
            <p className="text-xs text-pink-600">Done</p>
          </div>
          <div className="bg-red-50 rounded-lg p-2 text-center border border-red-200">
            <p className="text-lg font-bold text-red-600">{stats.rejected || 0}</p>
            <p className="text-xs text-red-600">Rejected</p>
          </div>
        </div>

        {/* Property List */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Property List (Nearest First)</h2>
          
          {/* CSS for GREEN highlight on nearest property card - NO rotation */}
          <style>{`
            @keyframes pulse-card {
              0%, 100% { 
                box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6), 0 4px 15px rgba(34, 197, 94, 0.3);
              }
              50% { 
                box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2), 0 4px 20px rgba(34, 197, 94, 0.4);
              }
            }
            @keyframes blink-badge {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.05); opacity: 0.9; }
            }
            .nearest-card-green {
              position: relative;
              background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important;
              border: 3px solid #22c55e !important;
              animation: pulse-card 2s ease-in-out infinite;
            }
            .nearest-badge-green {
              animation: blink-badge 1.5s ease-in-out infinite;
              background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            }
          `}</style>
          
          {filteredProperties.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-slate-500">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No properties found</p>
              </CardContent>
            </Card>
          ) : (
            filteredProperties.map((property, index) => {
              const isCompleted = property.status === 'Completed' || property.status === 'Approved';
              const isRejected = property.status === 'Rejected';
              const isPending = property.status === 'Pending';
              const isNearestPending = index === 0 && userLocation && isPending;
              
              return (
                <Card 
                  key={property.id} 
                  className={`transition-shadow ${
                    isNearestPending ? 'nearest-card-green cursor-pointer hover:shadow-md' : 
                    isCompleted ? 'opacity-60 bg-slate-50' :
                    isRejected ? 'border-red-300 bg-red-50 cursor-pointer hover:shadow-md' :
                    'cursor-pointer hover:shadow-md'
                  }`}
                  onClick={() => {
                    if (isCompleted) {
                      toast.info('This survey is already completed');
                      return;
                    }
                    navigate(`/employee/survey/${property.id}`);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Serial Number Circle - shows BillSrNo from PDF or N/A */}
                      {property.serial_na ? (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-500 text-white font-bold text-xs flex-shrink-0">
                          N/A
                        </div>
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                          isNearestPending ? 'bg-green-500 ring-4 ring-green-300 ring-offset-2 animate-pulse' :
                          isRejected ? 'bg-red-500' :
                          isCompleted ? 'bg-pink-500' : 
                          isPending ? 'bg-orange-500' : 'bg-slate-500'
                        }`}>
                          {isCompleted ? '✓' : isRejected ? '!' : (property.serial_number || property.bill_sr_no || '-')}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Serial Number prominently */}
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-sm font-bold">
                            Sr: {property.serial_na ? 'N/A' : (property.bill_sr_no || property.serial_number || '-')}
                          </span>
                          <span className="font-mono text-xs text-blue-600">{property.property_id}</span>
                          {isNearestPending && (
                            <span className="nearest-badge-green text-xs text-white px-2 py-0.5 rounded-full font-bold shadow-lg">
                              ⭐ NEAREST
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-xs text-white bg-pink-500 px-2 py-0.5 rounded-full font-medium">
                              ✓ Done
                            </span>
                          )}
                          {isRejected && (
                            <span className="text-xs text-white bg-red-500 px-2 py-0.5 rounded-full font-medium">
                              ⚠ Rejected
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-800 truncate">{property.owner_name}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 truncate">{property.colony}</span>
                          {property.distance !== undefined && property.distance !== Infinity && (
                            <span className="text-xs font-medium text-green-600 flex-shrink-0 ml-2">
                              📍 {formatDistance(property.distance)}
                            </span>
                          )}
                        </div>
                        {/* Show rejection reason if rejected */}
                        {isRejected && property.reject_remarks && (
                          <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700">
                            <strong>Rejection Reason:</strong> {property.reject_remarks}
                          </div>
                        )}
                      </div>
                      {!isCompleted && <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                      {isCompleted && <Lock className="w-5 h-5 text-pink-400 flex-shrink-0" />}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* GPS Info */}
        {userLocation && lastUpdate && (
          <p className="text-xs text-center text-slate-400 pb-4">
            📍 GPS: {lastUpdate.toLocaleTimeString()} • Nearest property highlighted
          </p>
        )}
      </div>

      {/* Fullscreen Map Modal */}
      {fullscreenMap && (
        <div className="fixed inset-0 z-[9999] bg-white">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-[10000] bg-white/95 backdrop-blur-sm border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800">Survey Map - Full View</h2>
                <p className="text-xs text-slate-500">{filteredProperties.length} properties • Pink = Done • Orange = Pending</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handlePrintMap} disabled={downloading} className="h-8 bg-blue-600 hover:bg-blue-700 text-white">
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                  Download PDF (100% Zoom)
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setFullscreenMap(false)}
                  className="h-8"
                >
                  <X className="w-4 h-4 mr-1" />
                  Close
                </Button>
              </div>
            </div>
          </div>

          {/* Fullscreen Map with Google Satellite View - Max Quality */}
          <div className="absolute inset-0 pt-16">
            <MapContainer
              center={getDefaultCenter()}
              zoom={19}
              minZoom={5}
              maxZoom={21}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
              zoomControl={true}
            >
              {/* Google Satellite - High quality max zoom */}
              <TileLayer 
                url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                maxZoom={21}
              />
              <MapController properties={filteredProperties} userLocation={userLocation} fitKey={fitKey} />
              
              {/* User location */}
              {userLocation && (
                <Marker position={[userLocation.latitude, userLocation.longitude]} icon={currentLocationIcon}>
                  <Popup><p className="font-bold text-blue-600">📍 Your Location</p></Popup>
                </Marker>
              )}
              
              {/* Property markers with SERIAL NUMBER labels */}
              {filteredProperties.filter(p => p.latitude && p.longitude).slice(0, 200).map((property, index) => (
                <Marker
                  key={property.id}
                  position={[property.latitude, property.longitude]}
                  icon={createPropertyIdIcon(
                    property.property_id, 
                    property.status, 
                    index === 0 && userLocation,
                    property.serial_na ? 'N/A' : (property.bill_sr_no || property.serial_number || index + 1)
                  )}
                >
                  <Popup maxWidth={280}>
                    <div className="p-2 min-w-[200px]">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-xl font-bold text-amber-600">Sr: {property.serial_na ? 'N/A' : (property.bill_sr_no || property.serial_number || '-')}</span>
                          <p className="text-sm text-blue-600 font-mono">{property.property_id}</p>
                        </div>
                        {index === 0 && userLocation && (
                          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full animate-pulse">
                            ⭐ NEAREST
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-base">{property.owner_name}</p>
                      <p className="text-sm text-slate-500 mb-1">{property.colony}</p>
                      {property.mobile && <p className="text-sm text-slate-600">📱 {property.mobile}</p>}
                      {property.distance !== Infinity && (
                        <p className="text-sm font-medium text-blue-600 mt-1">📍 {formatDistance(property.distance)} away</p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          className="flex-1 h-9 bg-blue-600" 
                          onClick={() => { setFullscreenMap(false); navigate(`/employee/survey/${property.id}`); }}
                        >
                          <FileText className="w-4 h-4 mr-1" /> Start Survey
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-9 px-3"
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

          {/* Bottom Info Bar */}
          <div className="absolute bottom-0 left-0 right-0 z-[10000] bg-white/95 backdrop-blur-sm border-t px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-3 h-3 rounded bg-green-500"></span> Pending
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-3 h-3 rounded bg-pink-500"></span> Done
                </span>
                <span className="text-xs text-slate-500">| Satellite View</span>
              </div>
              {userLocation && (
                <span className="text-xs text-green-600 font-medium">📍 GPS Active</span>
              )}
            </div>
          </div>
        </div>
      )}
    </EmployeeLayout>
  );
}

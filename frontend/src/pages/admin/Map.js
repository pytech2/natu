import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Map as MapIcon, Search, Filter, Home, User, Phone, 
  MapPin, Layers, Navigation, Building, AreaChart,
  Download, Save, ArrowUpDown, Loader2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Function to spread overlapping markers in a spiral pattern
const spreadOverlappingMarkers = (properties) => {
  const coordMap = {};
  const spreadProperties = [];
  const OFFSET = 0.00015; // About 15 meters offset
  
  properties.forEach((prop) => {
    if (!prop.latitude || !prop.longitude) return;
    const key = `${prop.latitude},${prop.longitude}`;
    if (!coordMap[key]) {
      coordMap[key] = [];
    }
    coordMap[key].push(prop);
  });
  
  Object.values(coordMap).forEach((group) => {
    if (group.length === 1) {
      spreadProperties.push({ ...group[0], spreadLat: group[0].latitude, spreadLng: group[0].longitude });
    } else {
      group.forEach((prop, index) => {
        if (index === 0) {
          spreadProperties.push({ ...prop, spreadLat: prop.latitude, spreadLng: prop.longitude });
        } else {
          const angle = (index * 45) * (Math.PI / 180);
          const radius = OFFSET * Math.ceil(index / 8);
          const newLat = prop.latitude + radius * Math.cos(angle);
          const newLng = prop.longitude + radius * Math.sin(angle);
          spreadProperties.push({ ...prop, spreadLat: newLat, spreadLng: newLng });
        }
      });
    }
  });
  
  return spreadProperties;
};

// Custom small marker icons with serial number
const createNumberedIcon = (number, category) => {
  const colors = {
    'Residential': '#3b82f6',      // Blue
    'Commercial': '#f97316',       // Orange
    'Vacant Plot': '#22c55e',      // Green
    'Mix Use': '#a855f7',          // Purple
    'default': '#ef4444'           // Red
  };
  
  const color = colors[category] || colors['default'];
  
  // Small circular pin with number
  return L.divIcon({
    className: 'custom-numbered-marker',
    html: `<div style="
      background-color: ${color};
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 1.5px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 600;
      color: white;
      font-family: Arial, sans-serif;
      line-height: 1;
    ">${number}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9]
  });
};

// Component to fit bounds when properties change
function FitBounds({ properties }) {
  const map = useMap();
  
  useEffect(() => {
    if (properties.length > 0) {
      const validProps = properties.filter(p => p.latitude && p.longitude);
      if (validProps.length > 0) {
        const bounds = L.latLngBounds(
          validProps.map(p => [p.latitude, p.longitude])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [properties, map]);
  
  return null;
}

export default function PropertyMap() {
  const { token } = useAuth();
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [colonies, setColonies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [mapType, setMapType] = useState('satellite');
  
  // Filters
  const [filters, setFilters] = useState({
    colony: '',
    category: '',
    search: ''
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    withGPS: 0,
    residential: 0,
    commercial: 0,
    vacant: 0
  });

  // Arrange & Download state
  const [arranging, setArranging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfDialog, setPdfDialog] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({
    sn_position: 'top-right',
    sn_font_size: 48,
    sn_color: 'red'
  });

  // Default center (Kurukshetra, Haryana)
  const defaultCenter = [29.9506, 76.8378];

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [properties, filters]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/admin/properties?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let props = response.data.properties || [];
      
      // Sort by serial_number for consistent sequential numbering (1, 2, 3...)
      props.sort((a, b) => (a.serial_number || 0) - (b.serial_number || 0));
      
      setProperties(props);
      
      // Extract unique colonies and categories
      const uniqueColonies = [...new Set(props.map(p => p.colony).filter(Boolean))];
      const uniqueCategories = [...new Set(props.map(p => p.category).filter(Boolean))];
      setColonies(uniqueColonies.sort());
      setCategories(uniqueCategories.sort());
      
      // Calculate stats
      const withGPS = props.filter(p => p.latitude && p.longitude).length;
      const residential = props.filter(p => p.category === 'Residential').length;
      const commercial = props.filter(p => p.category === 'Commercial').length;
      const vacant = props.filter(p => p.category === 'Vacant Plot').length;
      
      setStats({
        total: props.length,
        withGPS,
        residential,
        commercial,
        vacant
      });
      
    } catch (error) {
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...properties];
    
    if (filters.colony) {
      filtered = filtered.filter(p => p.colony === filters.colony);
    }
    
    if (filters.category) {
      filtered = filtered.filter(p => p.category === filters.category);
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(p => 
        p.property_id?.toLowerCase().includes(searchLower) ||
        p.owner_name?.toLowerCase().includes(searchLower) ||
        p.address?.toLowerCase().includes(searchLower) ||
        p.mobile?.includes(filters.search)
      );
    }
    
    // Only show properties with valid GPS
    filtered = filtered.filter(p => p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0);
    
    // Maintain sort by serial_number
    filtered.sort((a, b) => (a.serial_number || 0) - (b.serial_number || 0));
    
    setFilteredProperties(filtered);
  };

  const clearFilters = () => {
    setFilters({ colony: '', category: '', search: '' });
  };

  // Arrange properties by GPS route
  const handleArrangeByRoute = async () => {
    setArranging(true);
    try {
      const params = new URLSearchParams();
      if (filters.colony) params.append('ward', filters.colony);
      
      const response = await axios.post(`${API_URL}/admin/properties/arrange-by-route?${params}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(response.data.message || 'Properties arranged by GPS route');
      fetchProperties(); // Reload to show new order
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to arrange properties');
    } finally {
      setArranging(false);
    }
  };

  // Save arranged data to properties
  const handleSaveArrangedData = async () => {
    setSaving(true);
    try {
      const params = new URLSearchParams();
      if (filters.colony) params.append('ward', filters.colony);
      
      const response = await axios.post(`${API_URL}/admin/properties/save-arranged?${params}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(response.data.message || 'Arranged data saved successfully');
      fetchProperties();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save arranged data');
    } finally {
      setSaving(false);
    }
  };

  // Download arranged PDF
  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (filters.colony) params.append('ward', filters.colony);
      params.append('sn_position', pdfOptions.sn_position);
      params.append('sn_font_size', pdfOptions.sn_font_size);
      params.append('sn_color', pdfOptions.sn_color);
      
      const response = await axios.post(`${API_URL}/admin/properties/download-pdf?${params}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('PDF generated successfully');
      setPdfDialog(false);
      
      // Download the file
      window.open(`${process.env.REACT_APP_BACKEND_URL}${response.data.download_url}`, '_blank');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  const getTileLayer = () => {
    if (mapType === 'satellite') {
      return (
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP'
          maxZoom={19}
        />
      );
    }
    return (
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
    );
  };

  return (
    <AdminLayout title="Property Map">
      <div data-testid="property-map-page" className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 opacity-80" />
                <span className="text-sm opacity-80">Total</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Navigation className="w-5 h-5 opacity-80" />
                <span className="text-sm opacity-80">With GPS</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.withGPS}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-400 to-blue-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5 opacity-80" />
                <span className="text-sm opacity-80">Residential</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.residential}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 opacity-80" />
                <span className="text-sm opacity-80">Commercial</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.commercial}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AreaChart className="w-5 h-5 opacity-80" />
                <span className="text-sm opacity-80">Vacant</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.vacant}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Colony/Area</Label>
                <Select 
                  value={filters.colony} 
                  onValueChange={(v) => setFilters({ ...filters, colony: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Colonies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">All Colonies</SelectItem>
                    {colonies.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Category</Label>
                <Select 
                  value={filters.category} 
                  onValueChange={(v) => setFilters({ ...filters, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">All Categories</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Property ID, Name, Mobile..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Map Type</Label>
                <Select value={mapType} onValueChange={setMapType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="satellite">Satellite</SelectItem>
                    <SelectItem value="street">Street Map</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button variant="outline" onClick={clearFilters}>
                <Filter className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            </div>
            
            <div className="mt-3 flex items-center justify-between text-sm">
              <p className="text-slate-500">
                Showing <span className="font-semibold text-slate-900">{filteredProperties.length}</span> properties on map
              </p>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div> Residential
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div> Commercial
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Vacant Plot
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div> Mix Use
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-3">
              <Button
                onClick={handleArrangeByRoute}
                disabled={arranging || filteredProperties.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {arranging ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                )}
                Arrange by GPS Route
              </Button>

              <Button
                onClick={handleSaveArrangedData}
                disabled={saving || filteredProperties.length === 0}
                variant="outline"
                className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Arranged Data
              </Button>

              <Button
                onClick={() => setPdfDialog(true)}
                disabled={filteredProperties.length === 0}
                variant="outline"
                className="border-purple-500 text-purple-600 hover:bg-purple-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Arranged PDF
              </Button>

              <div className="flex-1" />
              
              <span className="text-sm text-slate-500">
                {filteredProperties.length} properties with GPS
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-slate-900 text-white">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapIcon className="w-4 h-4" />
              Property Locations - Click on marker to view details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="h-[600px] flex items-center justify-center bg-slate-100">
                <div className="text-slate-500 animate-pulse">Loading map...</div>
              </div>
            ) : (
              <div style={{ height: '600px', width: '100%' }}>
                <MapContainer
                  center={defaultCenter}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  {getTileLayer()}
                  <FitBounds properties={filteredProperties} />
                  
                  {/* Spread overlapping markers so all serial numbers are visible */}
                  {spreadOverlappingMarkers(filteredProperties).map((property) => (
                    <Marker
                      key={property.id}
                      position={[property.spreadLat, property.spreadLng]}
                      icon={createNumberedIcon(property.serial_number || 0, property.category)}
                    >
                      <Popup maxWidth={350} className="property-popup">
                        <div className="p-2 min-w-[280px]">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-mono text-sm font-bold text-blue-600">
                              #{property.serial_number || 0} - {property.property_id}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              property.category === 'Residential' ? 'bg-blue-100 text-blue-700' :
                              property.category === 'Commercial' ? 'bg-amber-100 text-amber-700' :
                              property.category === 'Vacant Plot' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {property.category}
                            </span>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2">
                              <User className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-slate-500">Owner</p>
                                <p className="font-medium">{property.owner_name || 'N/A'}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2">
                              <Phone className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-slate-500">Mobile</p>
                                <p className="font-mono">{property.mobile || 'N/A'}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-2">
                              <Home className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-slate-500">Address</p>
                                <p className="text-slate-700">{property.address || 'N/A'}</p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                              <div>
                                <p className="text-xs text-slate-500">Area</p>
                                <p className="font-medium">{property.total_area || '-'} Sq.Yard</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Outstanding</p>
                                <p className="font-medium text-red-600">₹{property.amount || '0'}</p>
                              </div>
                            </div>
                            
                            <div className="pt-2 border-t">
                              <p className="text-xs text-slate-400 font-mono">
                                GPS: {property.latitude?.toFixed(6)}, {property.longitude?.toFixed(6)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Download PDF Dialog */}
        <Dialog open={pdfDialog} onOpenChange={setPdfDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Download Arranged PDF</DialogTitle>
              <DialogDescription>
                Generate a PDF with properties arranged by GPS route order
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">
                  <strong>{filteredProperties.length}</strong> properties will be included in the PDF
                  {filters.colony && ` (Colony: ${filters.colony})`}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Serial Number Position</Label>
                <Select
                  value={pdfOptions.sn_position}
                  onValueChange={(value) => setPdfOptions({ ...pdfOptions, sn_position: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Font Size: {pdfOptions.sn_font_size}px</Label>
                <input
                  type="range"
                  min="24"
                  max="72"
                  value={pdfOptions.sn_font_size}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, sn_font_size: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Serial Number Color</Label>
                <Select
                  value={pdfOptions.sn_color}
                  onValueChange={(value) => setPdfOptions({ ...pdfOptions, sn_color: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Red</SelectItem>
                    <SelectItem value="blue">Blue</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="orange">Orange</SelectItem>
                    <SelectItem value="black">Black</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPdfDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import EmployeeLayout from '../../components/EmployeeLayout';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
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
} from '../../components/ui/dialog';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, MapPin, Phone, User, ChevronRight, FileSpreadsheet, Eye, Navigation, Home, ExternalLink, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom small numbered marker for employee properties
const createNumberedIcon = (number, status) => {
  const colors = {
    'Pending': '#f97316',      // Orange
    'Completed': '#22c55e',    // Green
    'Approved': '#22c55e',     // Green
    'In Progress': '#3b82f6',  // Blue
    'Rejected': '#ef4444',     // Red
    'default': '#6b7280'       // Gray
  };
  
  const color = colors[status] || colors['default'];
  
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

// Custom red marker for detail view
const redIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    background-color: #ef4444;
    width: 24px;
    height: 28px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28]
});

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function EmployeeProperties() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Property detail dialog
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);

  useEffect(() => {
    fetchProperties();
  }, [search, statusFilter]);

  const fetchProperties = async (loadMore = false) => {
    if (!loadMore) {
      setLoading(true);
      setPage(1);
    }

    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', loadMore ? page + 1 : 1);
      params.append('limit', 20);

      const response = await axios.get(`${API_URL}/employee/properties?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (loadMore) {
        setProperties(prev => [...prev, ...response.data.properties]);
        setPage(prev => prev + 1);
      } else {
        setProperties(response.data.properties);
      }

      setHasMore(response.data.page < response.data.pages);
    } catch (error) {
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': 'bg-amber-100 text-amber-700',
      'Completed': 'bg-emerald-100 text-emerald-700',
      'Approved': 'bg-emerald-100 text-emerald-700',
      'In Progress': 'bg-blue-100 text-blue-700',
      'Rejected': 'bg-red-100 text-red-700',
      'Flagged': 'bg-red-100 text-red-700'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badges[status] || 'bg-slate-100 text-slate-700'}`}>{status || 'Pending'}</span>;
  };

  const openPropertyDetail = (e, prop) => {
    e.stopPropagation();
    setSelectedProperty(prop);
    setDetailDialog(true);
  };

  return (
    <EmployeeLayout title="My Properties">
      <div data-testid="employee-properties" className="space-y-4">
        {/* Search and Filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by ID, Owner, Mobile..."
              data-testid="property-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 bg-white"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="status-filter" className="h-12 bg-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=" ">All Properties</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Property Count */}
        <div className="text-sm text-slate-500">
          Showing {properties.length} assigned properties
        </div>

        {/* Property List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse-slow text-slate-500">Loading...</div>
          </div>
        ) : properties.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="font-heading font-semibold text-slate-900 mb-2">No properties found</h3>
              <p className="text-slate-500">No properties match your search criteria</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {properties.map((prop) => (
              <Card
                key={prop.id}
                className="bg-white border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <CardContent className="p-0">
                  {/* Property Header */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                        <span className="font-bold text-sm">{prop.serial_number || '-'}</span>
                      </div>
                      <div>
                        <p className="font-mono text-lg font-bold">{prop.property_id}</p>
                        <p className="text-xs text-slate-300">{prop.colony || prop.area || 'Akash Nagar'}</p>
                      </div>
                    </div>
                    {getStatusBadge(prop.status)}
                  </div>
                  
                  {/* Property Content */}
                  <div className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">Owner</p>
                          <p className="font-medium truncate">{prop.owner_name}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Phone className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Mobile</p>
                          <p className="font-mono">{prop.mobile || '-'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Home className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">Address</p>
                          <p className="text-sm truncate">{prop.address || prop.plot_address || '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* GPS Badge */}
                    {prop.latitude && prop.longitude && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full w-fit">
                        <Navigation className="w-3 h-3" />
                        <span className="font-mono">{prop.latitude?.toFixed(4)}, {prop.longitude?.toFixed(4)}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => openPropertyDetail(e, prop)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={() => navigate(`/employee/survey/${prop.id}`)}
                      >
                        {prop.status === 'Completed' || prop.status === 'Approved' ? 'View Survey' : 'Start Survey'}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {hasMore && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fetchProperties(true)}
                data-testid="load-more-btn"
              >
                Load More
              </Button>
            )}
          </div>
        )}

        {/* Property Detail Dialog with Map */}
        <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
          <DialogContent className="max-w-lg p-0 overflow-hidden">
            {selectedProperty && (
              <div className="flex flex-col">
                {/* Map Section */}
                {selectedProperty.latitude && selectedProperty.longitude ? (
                  <div className="h-[250px] relative">
                    <div className="absolute top-2 left-2 z-10 bg-slate-900/80 backdrop-blur text-white px-3 py-2 rounded-lg">
                      <p className="text-xs opacity-70">Location</p>
                      <p className="font-mono text-sm">{selectedProperty.latitude?.toFixed(6)}, {selectedProperty.longitude?.toFixed(6)}</p>
                    </div>
                    <button 
                      onClick={() => setDetailDialog(false)}
                      className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <MapContainer
                      center={[selectedProperty.latitude, selectedProperty.longitude]}
                      zoom={18}
                      style={{ height: '100%', width: '100%' }}
                      scrollWheelZoom={true}
                      zoomControl={false}
                    >
                      <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution='&copy; Esri'
                        maxZoom={19}
                      />
                      <Marker 
                        position={[selectedProperty.latitude, selectedProperty.longitude]}
                        icon={redIcon}
                      >
                        <Popup>
                          <div className="text-center">
                            <p className="font-bold">{selectedProperty.property_id}</p>
                          </div>
                        </Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                ) : (
                  <div className="h-[150px] bg-slate-100 flex items-center justify-center">
                    <div className="text-center text-slate-400">
                      <MapPin className="w-8 h-8 mx-auto opacity-30 mb-1" />
                      <p className="text-sm">No GPS data</p>
                    </div>
                  </div>
                )}

                {/* Property Details */}
                <div className="p-4 space-y-4">
                  {/* Property ID */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 rounded-xl">
                    <p className="text-xs opacity-70">Property ID</p>
                    <p className="font-mono text-xl font-bold">{selectedProperty.property_id}</p>
                  </div>

                  {/* Owner Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">Owner</p>
                      <p className="font-semibold truncate">{selectedProperty.owner_name || '-'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">Mobile</p>
                      <p className="font-mono">{selectedProperty.mobile || '-'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg col-span-2">
                      <p className="text-xs text-slate-500">Address</p>
                      <p className="text-sm">{selectedProperty.address || selectedProperty.plot_address || '-'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">Category</p>
                      <p className="font-medium">{selectedProperty.category || '-'}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500">Area</p>
                      <p className="font-medium">{selectedProperty.total_area || '-'} Sq.Yard</p>
                    </div>
                  </div>

                  {/* Outstanding Amount */}
                  <div className="bg-red-50 p-3 rounded-lg flex items-center justify-between">
                    <span className="text-red-600 text-sm">Outstanding Amount</span>
                    <span className="font-bold text-red-600 text-lg">₹{selectedProperty.amount || '0'}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {selectedProperty.latitude && selectedProperty.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${selectedProperty.latitude},${selectedProperty.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                      >
                        <Navigation className="w-4 h-4" />
                        Google Maps
                      </a>
                    )}
                    <Button
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        setDetailDialog(false);
                        navigate(`/employee/survey/${selectedProperty.id}`);
                      }}
                    >
                      {selectedProperty.status === 'Completed' || selectedProperty.status === 'Approved' ? 'View Survey' : 'Start Survey'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </EmployeeLayout>
  );
}

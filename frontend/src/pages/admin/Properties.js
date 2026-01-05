import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { Card, CardContent } from '../../components/ui/card';
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
import { Search, UserPlus, FileSpreadsheet, ChevronLeft, ChevronRight, MapPin, Eye, User, Phone, Home, Navigation, ExternalLink } from 'lucide-react';
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

// Custom red marker for highlighted property
const redIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    background-color: #ef4444;
    width: 32px;
    height: 32px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 4px solid white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Properties() {
  const { token } = useAuth();
  const [properties, setProperties] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [batches, setBatches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  
  // Filters
  const [filters, setFilters] = useState({
    batch_id: '',
    area: '',
    status: '',
    employee_id: '',
    search: ''
  });

  // Assignment dialog
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState([]);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [bulkAssignArea, setBulkAssignArea] = useState('');
  
  // Property detail dialog
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);

  const fetchInitialData = async () => {
    try {
      console.log('Fetching initial data...');
      const [empRes, batchRes, areaRes] = await Promise.all([
        axios.get(`${API_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/admin/batches`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/admin/areas`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      console.log('Users fetched:', empRes.data.length);
      const nonAdminUsers = empRes.data.filter(u => u.role !== 'ADMIN');
      console.log('Non-admin users:', nonAdminUsers.length);
      setEmployees(nonAdminUsers);
      setBatches(batchRes.data || []);
      setAreas(areaRes.data.areas || []);
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      toast.error('Failed to load employees');
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [token]);

  useEffect(() => {
    fetchProperties();
  }, [filters, pagination.page]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.batch_id) params.append('batch_id', filters.batch_id);
      if (filters.area) params.append('area', filters.area);
      if (filters.status) params.append('status', filters.status);
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      if (filters.search) params.append('search', filters.search);
      params.append('page', pagination.page);
      params.append('limit', 20);

      const response = await axios.get(`${API_URL}/admin/properties?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProperties(response.data.properties);
      setPagination(prev => ({
        ...prev,
        pages: response.data.pages,
        total: response.data.total
      }));
    } catch (error) {
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assignEmployeeId) {
      toast.error('Please select an employee');
      return;
    }

    try {
      await axios.post(`${API_URL}/admin/assign`, {
        property_ids: selectedProperties,
        employee_id: assignEmployeeId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Properties assigned successfully');
      setAssignDialog(false);
      setSelectedProperties([]);
      setAssignEmployeeId('');
      fetchProperties();
    } catch (error) {
      toast.error('Failed to assign properties');
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignArea || !assignEmployeeId) {
      toast.error('Please select area and employee');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/admin/assign-bulk`, {
        area: bulkAssignArea,
        employee_id: assignEmployeeId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
      setAssignDialog(false);
      setBulkAssignArea('');
      setAssignEmployeeId('');
      fetchProperties();
    } catch (error) {
      toast.error('Failed to assign properties');
    }
  };

  const toggleSelect = (id) => {
    setSelectedProperties(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProperties.length === properties.length) {
      setSelectedProperties([]);
    } else {
      setSelectedProperties(properties.map(p => p.id));
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': 'badge-pending',
      'Completed': 'badge-completed',
      'In Progress': 'badge-in-progress',
      'Flagged': 'badge-flagged'
    };
    return <span className={badges[status] || 'badge-pending'}>{status}</span>;
  };

  return (
    <AdminLayout title="Property Management">
      <div data-testid="admin-properties" className="space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by Property ID, Owner, Mobile..."
                    data-testid="property-search-input"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select
                value={filters.batch_id}
                onValueChange={(value) => setFilters({ ...filters, batch_id: value })}
              >
                <SelectTrigger className="w-[180px]" data-testid="batch-filter">
                  <SelectValue placeholder="All Batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">All Batches</SelectItem>
                  {batches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.area}
                onValueChange={(value) => setFilters({ ...filters, area: value })}
              >
                <SelectTrigger className="w-[150px]" data-testid="area-filter">
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">All Areas</SelectItem>
                  {areas.map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger className="w-[150px]" data-testid="status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Flagged">Flagged</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setFilters({ batch_id: '', area: '', status: '', employee_id: '', search: '' })}
              >
                Clear
              </Button>

              {selectedProperties.length > 0 && (
                <Button
                  data-testid="assign-selected-btn"
                  onClick={() => setAssignDialog(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign ({selectedProperties.length})
                </Button>
              )}

              <Button
                variant="outline"
                data-testid="bulk-assign-btn"
                onClick={() => {
                  setSelectedProperties([]);
                  setAssignDialog(true);
                }}
              >
                Bulk Assign by Area
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Properties Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse-slow text-slate-500">Loading...</div>
          </div>
        ) : properties.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="font-heading font-semibold text-slate-900 mb-2">No properties found</h3>
              <p className="text-slate-500">Upload a dataset to see properties here</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-lg border-0">
              <CardContent className="p-0 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={selectedProperties.length === properties.length && properties.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                      <th>Property ID</th>
                      <th>Owner</th>
                      <th>Mobile</th>
                      <th>Address</th>
                      <th>Area</th>
                      <th className="text-center">GPS</th>
                      <th>Assigned To</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map((prop) => (
                      <tr key={prop.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedProperties.includes(prop.id)}
                            onChange={() => toggleSelect(prop.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="font-mono text-sm font-medium text-blue-600">{prop.property_id}</td>
                        <td>{prop.owner_name}</td>
                        <td className="font-mono text-sm">{prop.mobile}</td>
                        <td className="max-w-[200px] truncate" title={prop.address || prop.plot_address}>
                          {prop.address || prop.plot_address || '-'}
                        </td>
                        <td>{prop.colony || prop.area || '-'}</td>
                        <td className="text-center">
                          {prop.latitude && prop.longitude ? (
                            <a 
                              href={`https://www.google.com/maps?q=${prop.latitude},${prop.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                              title={`${prop.latitude?.toFixed(6)}, ${prop.longitude?.toFixed(6)}`}
                            >
                              <MapPin className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td>{prop.assigned_employee_name || <span className="text-slate-400">Unassigned</span>}</td>
                        <td>{getStatusBadge(prop.status)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedProperty(prop);
                                setDetailDialog(true);
                              }}
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Showing {((pagination.page - 1) * 20) + 1} to {Math.min(pagination.page * 20, pagination.total)} of {pagination.total} properties
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-3 py-1 text-sm">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Assignment Dialog */}
        <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">
                {selectedProperties.length > 0 ? 'Assign Selected Properties' : 'Bulk Assign by Area'}
              </DialogTitle>
              <DialogDescription>
                {selectedProperties.length > 0 
                  ? `Assign ${selectedProperties.length} selected properties to an employee`
                  : 'Assign all unassigned properties in an area to an employee'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {selectedProperties.length === 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Area/Zone</label>
                  <Select value={bulkAssignArea} onValueChange={setBulkAssignArea}>
                    <SelectTrigger data-testid="bulk-area-select">
                      <SelectValue placeholder="Select area" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to Employee</label>
                <Select value={assignEmployeeId} onValueChange={setAssignEmployeeId}>
                  <SelectTrigger data-testid="assign-employee-select">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={selectedProperties.length > 0 ? handleAssign : handleBulkAssign}
                data-testid="confirm-assign-btn"
                className="bg-slate-900 hover:bg-slate-800"
              >
                Assign Properties
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Property Detail Dialog with Map */}
        <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                Property Details - {selectedProperty?.property_id}
              </DialogTitle>
            </DialogHeader>

            {selectedProperty && (
              <div className="space-y-6">
                {/* Property Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-slate-500 uppercase tracking-wider">Property ID</Label>
                      <p className="font-mono font-bold text-lg text-blue-600">{selectedProperty.property_id}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <User className="w-3 h-3" /> Owner Name
                      </Label>
                      <p className="font-medium">{selectedProperty.owner_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Mobile Number
                      </Label>
                      <p className="font-mono">{selectedProperty.mobile || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Home className="w-3 h-3" /> Address
                      </Label>
                      <p className="text-slate-700">{selectedProperty.address || selectedProperty.plot_address || '-'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-slate-500 uppercase tracking-wider">Colony/Area</Label>
                      <p className="font-medium">{selectedProperty.colony || selectedProperty.area || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 uppercase tracking-wider">Category</Label>
                      <p className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                        selectedProperty.category === 'Residential' ? 'bg-blue-100 text-blue-700' :
                        selectedProperty.category === 'Commercial' ? 'bg-amber-100 text-amber-700' :
                        selectedProperty.category === 'Vacant Plot' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {selectedProperty.category || '-'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 uppercase tracking-wider">Total Area</Label>
                      <p>{selectedProperty.total_area || '-'} Sq.Yard</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 uppercase tracking-wider">Outstanding Amount</Label>
                      <p className="font-mono font-bold text-red-600 text-lg">₹{selectedProperty.amount || '0'}</p>
                    </div>
                  </div>
                </div>

                {/* GPS Coordinates */}
                {selectedProperty.latitude && selectedProperty.longitude && (
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Navigation className="w-5 h-5 text-emerald-600" />
                        <div>
                          <p className="text-xs text-emerald-600 font-semibold">GPS COORDINATES</p>
                          <p className="font-mono text-emerald-800">
                            {selectedProperty.latitude?.toFixed(6)}, {selectedProperty.longitude?.toFixed(6)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${selectedProperty.latitude},${selectedProperty.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-emerald-600 hover:underline inline-flex items-center gap-1"
                      >
                        Open in Google Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Map */}
                {selectedProperty.latitude && selectedProperty.longitude && (
                  <div className="rounded-lg overflow-hidden border-2 border-slate-200">
                    <div className="bg-slate-900 text-white px-3 py-2 text-sm font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Property Location
                    </div>
                    <div style={{ height: '300px', width: '100%' }}>
                      <MapContainer
                        center={[selectedProperty.latitude, selectedProperty.longitude]}
                        zoom={18}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
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
                              <p className="font-bold text-blue-600">{selectedProperty.property_id}</p>
                              <p className="text-sm">{selectedProperty.owner_name}</p>
                            </div>
                          </Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">Assigned To</Label>
                    <p className="font-medium">{selectedProperty.assigned_employee_name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">Status</Label>
                    <p>{getStatusBadge(selectedProperty.status)}</p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

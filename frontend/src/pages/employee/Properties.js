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
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, MapPin, Phone, User, ChevronRight, FileSpreadsheet } from 'lucide-react';

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
      'Pending': 'badge-pending',
      'Completed': 'badge-completed',
      'In Progress': 'badge-in-progress',
      'Flagged': 'badge-flagged'
    };
    return <span className={badges[status] || 'badge-pending'}>{status}</span>;
  };

  return (
    <EmployeeLayout title="Properties">
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
              className="pl-10 h-12"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="status-filter" className="h-12">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=" ">All Properties</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Flagged">Flagged</SelectItem>
            </SelectContent>
          </Select>
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
                className="property-card"
                onClick={() => navigate(`/employee/survey/${prop.id}`)}
                data-testid={`property-card-${prop.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono text-sm font-medium text-slate-900">{prop.property_id}</p>
                      <p className="text-xs text-slate-500">{prop.colony_name || prop.area || 'No area'}</p>
                    </div>
                    {getStatusBadge(prop.status)}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-600">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{prop.owner_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-mono">{prop.mobile || 'No phone'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-sm truncate">{prop.plot_address || 'No address'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-400">Tap to {prop.status === 'Completed' ? 'view' : 'survey'}</span>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
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
      </div>
    </EmployeeLayout>
  );
}

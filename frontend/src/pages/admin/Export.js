import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Archive, Trash2, FolderOpen } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Export() {
  const { token } = useAuth();
  const [batches, setBatches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  const [filters, setFilters] = useState({
    batch_id: '',
    employee_id: '',
    status: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [batchRes, empRes] = await Promise.all([
        axios.get(`${API_URL}/admin/batches`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setBatches(batchRes.data);
      setEmployees(empRes.data.filter(u => u.role === 'EMPLOYEE'));
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.batch_id) params.append('batch_id', filters.batch_id);
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      if (filters.status) params.append('status', filters.status);

      const response = await axios.get(`${API_URL}/admin/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `property_survey_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Export downloaded successfully');
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleArchive = async (batchId) => {
    try {
      await axios.post(`${API_URL}/admin/batch/${batchId}/archive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Batch archived');
      fetchData();
    } catch (error) {
      toast.error('Failed to archive batch');
    }
  };

  const handleDelete = async (batchId) => {
    try {
      await axios.delete(`${API_URL}/admin/batch/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Batch deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete batch');
    }
  };

  return (
    <AdminLayout title="Export & Manage Data">
      <div data-testid="admin-export" className="space-y-6 max-w-4xl">
        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export to Excel
            </CardTitle>
            <CardDescription>
              Download property and survey data as an Excel file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Filter by Batch</label>
                <Select
                  value={filters.batch_id}
                  onValueChange={(value) => setFilters({ ...filters, batch_id: value })}
                >
                  <SelectTrigger data-testid="export-batch-filter">
                    <SelectValue placeholder="All Batches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">All Batches</SelectItem>
                    {batches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Filter by Employee</label>
                <Select
                  value={filters.employee_id}
                  onValueChange={(value) => setFilters({ ...filters, employee_id: value })}
                >
                  <SelectTrigger data-testid="export-employee-filter">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">All Employees</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Filter by Status</label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters({ ...filters, status: value })}
                >
                  <SelectTrigger data-testid="export-status-filter">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">All Status</SelectItem>
                    <SelectItem value="Pending">Pending Only</SelectItem>
                    <SelectItem value="Completed">Completed Only</SelectItem>
                    <SelectItem value="Flagged">Flagged Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={exporting}
              data-testid="export-btn"
              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {exporting ? 'Generating Export...' : 'Download Excel Export'}
            </Button>
          </CardContent>
        </Card>

        {/* Batch Management */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Dataset Batches
            </CardTitle>
            <CardDescription>
              Archive or delete completed batches
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-slate-500">Loading...</div>
            ) : batches.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                No batches found. Upload a dataset to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {batches.map(batch => (
                  <div key={batch.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-slate-900">{batch.name}</h4>
                      <p className="text-sm text-slate-500">
                        {batch.total_records} properties • Uploaded {new Date(batch.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        batch.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                        batch.status === 'ARCHIVED' ? 'bg-slate-100 text-slate-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {batch.status}
                      </span>
                      
                      {batch.status === 'ACTIVE' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleArchive(batch.id)}
                          data-testid={`archive-batch-${batch.id}`}
                        >
                          <Archive className="w-4 h-4 mr-1" />
                          Archive
                        </Button>
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            data-testid={`delete-batch-${batch.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the batch "{batch.name}" and all {batch.total_records} properties and their submissions. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(batch.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete Permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

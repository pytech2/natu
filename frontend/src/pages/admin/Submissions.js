import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { ClipboardCheck, MapPin, Camera, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Submissions() {
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [detailDialog, setDetailDialog] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [pagination.page]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page);
      params.append('limit', 20);

      const response = await axios.get(`${API_URL}/admin/submissions?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSubmissions(response.data.submissions);
      setPagination(prev => ({
        ...prev,
        pages: response.data.pages,
        total: response.data.total
      }));
    } catch (error) {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const viewDetail = (submission) => {
    setSelectedSubmission(submission);
    setDetailDialog(true);
  };

  return (
    <AdminLayout title="Survey Submissions">
      <div data-testid="admin-submissions" className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse-slow text-slate-500">Loading...</div>
          </div>
        ) : submissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="font-heading font-semibold text-slate-900 mb-2">No submissions yet</h3>
              <p className="text-slate-500">Survey submissions from field employees will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Property ID</th>
                      <th>Employee</th>
                      <th>Respondent</th>
                      <th>Phone</th>
                      <th>GPS</th>
                      <th>Photos</th>
                      <th>Submitted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id}>
                        <td className="font-mono text-sm font-medium">{sub.property_id}</td>
                        <td>{sub.employee_name}</td>
                        <td>{sub.respondent_name}</td>
                        <td className="font-mono text-sm">{sub.respondent_phone}</td>
                        <td>
                          <div className="flex items-center gap-1 text-emerald-600">
                            <MapPin className="w-4 h-4" />
                            <span className="text-xs font-mono">
                              {sub.latitude?.toFixed(4)}, {sub.longitude?.toFixed(4)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1 text-blue-600">
                            <Camera className="w-4 h-4" />
                            <span>{sub.photos?.length || 0}</span>
                          </div>
                        </td>
                        <td className="text-sm text-slate-500">
                          {new Date(sub.submitted_at).toLocaleString()}
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewDetail(sub)}
                            data-testid={`view-submission-${sub.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
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
                Showing {((pagination.page - 1) * 20) + 1} to {Math.min(pagination.page * 20, pagination.total)} of {pagination.total} submissions
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

        {/* Detail Dialog */}
        <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">
                Submission Details - {selectedSubmission?.property_id}
              </DialogTitle>
            </DialogHeader>

            {selectedSubmission && (
              <div className="space-y-6">
                {/* Survey Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Respondent Name</label>
                    <p className="font-medium">{selectedSubmission.respondent_name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Phone</label>
                    <p className="font-medium font-mono">{selectedSubmission.respondent_phone}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">House Number</label>
                    <p className="font-medium">{selectedSubmission.house_number || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Tax Number</label>
                    <p className="font-medium">{selectedSubmission.tax_number || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Employee</label>
                    <p className="font-medium">{selectedSubmission.employee_name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Submitted At</label>
                    <p className="font-medium text-sm">{new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* GPS */}
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium text-emerald-800">GPS Location</span>
                  </div>
                  <p className="font-mono text-emerald-700">
                    Lat: {selectedSubmission.latitude?.toFixed(6)}, Long: {selectedSubmission.longitude?.toFixed(6)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${selectedSubmission.latitude},${selectedSubmission.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:underline"
                  >
                    View on Google Maps →
                  </a>
                </div>

                {/* Remarks */}
                {selectedSubmission.remarks && (
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Remarks</label>
                    <p className="mt-1 p-3 bg-slate-50 rounded-lg">{selectedSubmission.remarks}</p>
                  </div>
                )}

                {/* Photos */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3 block">Photos (with GPS & Timestamp watermark)</label>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedSubmission.photos?.map((photo, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={`${process.env.REACT_APP_BACKEND_URL}${photo.file_url}`}
                          alt={photo.photo_type}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <span className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-semibold ${
                          photo.photo_type === 'HOUSE' ? 'bg-blue-100 text-blue-700' :
                          photo.photo_type === 'GATE' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {photo.photo_type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signature */}
                {selectedSubmission.signature_url && (
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3 block">Property Holder Signature</label>
                    <div className="border rounded-lg bg-white p-4">
                      <img
                        src={`${process.env.REACT_APP_BACKEND_URL}${selectedSubmission.signature_url}`}
                        alt="Signature"
                        className="w-full h-24 object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

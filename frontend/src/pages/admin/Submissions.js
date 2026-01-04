import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
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
import { ClipboardCheck, MapPin, Camera, ChevronLeft, ChevronRight, Eye, Check, X, Edit } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Submissions() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [detailDialog, setDetailDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editData, setEditData] = useState({});

  const employeeIdFilter = searchParams.get('employee_id') || '';

  useEffect(() => {
    fetchSubmissions();
  }, [pagination.page, statusFilter, employeeIdFilter]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page);
      params.append('limit', 20);
      if (statusFilter) params.append('status', statusFilter);
      if (employeeIdFilter) params.append('employee_id', employeeIdFilter);

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

  const handleApprove = async (submissionId) => {
    try {
      await axios.post(`${API_URL}/admin/submissions/approve`, {
        submission_id: submissionId,
        action: 'APPROVE'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Submission approved');
      fetchSubmissions();
      setDetailDialog(false);
    } catch (error) {
      toast.error('Failed to approve submission');
    }
  };

  const openRejectDialog = (submission) => {
    setSelectedSubmission(submission);
    setRejectRemarks('');
    setRejectDialog(true);
  };

  const handleReject = async () => {
    if (!rejectRemarks.trim()) {
      toast.error('Remarks are required for rejection');
      return;
    }

    try {
      await axios.post(`${API_URL}/admin/submissions/approve`, {
        submission_id: selectedSubmission.id,
        action: 'REJECT',
        remarks: rejectRemarks
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Submission rejected');
      fetchSubmissions();
      setRejectDialog(false);
      setDetailDialog(false);
    } catch (error) {
      toast.error('Failed to reject submission');
    }
  };

  const openEditDialog = (submission) => {
    setSelectedSubmission(submission);
    setEditData({
      new_owner_name: submission.new_owner_name || '',
      new_mobile: submission.new_mobile || '',
      receiver_name: submission.receiver_name || '',
      relation: submission.relation || '',
      old_property_id: submission.old_property_id || '',
      family_id: submission.family_id || '',
      aadhar_number: submission.aadhar_number || '',
      ward_number: submission.ward_number || '',
      remarks: submission.remarks || ''
    });
    setEditDialog(true);
  };

  const handleEdit = async () => {
    try {
      const formData = new FormData();
      Object.entries(editData).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      await axios.put(`${API_URL}/admin/submissions/${selectedSubmission.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Submission updated');
      fetchSubmissions();
      setEditDialog(false);
    } catch (error) {
      toast.error('Failed to update submission');
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'Pending': 'bg-amber-100 text-amber-700',
      'Approved': 'bg-emerald-100 text-emerald-700',
      'Rejected': 'bg-red-100 text-red-700'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[status] || 'bg-slate-100 text-slate-700'}`}>
        {status || 'Pending'}
      </span>
    );
  };

  return (
    <AdminLayout title="Survey Submissions">
      <div data-testid="admin-submissions" className="space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex gap-4 items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">All Status</SelectItem>
                  <SelectItem value="Pending">Pending Review</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              {employeeIdFilter && (
                <span className="text-sm text-slate-500">Filtered by employee</span>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse-slow text-slate-500">Loading...</div>
          </div>
        ) : submissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="font-heading font-semibold text-slate-900 mb-2">No submissions yet</h3>
              <p className="text-slate-500">Survey submissions from employees will appear here</p>
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
                      <th>New Owner</th>
                      <th>Receiver</th>
                      <th>GPS</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id}>
                        <td className="font-mono text-sm font-medium">{sub.property_id}</td>
                        <td>{sub.employee_name}</td>
                        <td>{sub.new_owner_name || '-'}</td>
                        <td>{sub.receiver_name || '-'}</td>
                        <td>
                          <div className="flex items-center gap-1 text-emerald-600">
                            <MapPin className="w-4 h-4" />
                            <span className="text-xs font-mono">
                              {sub.latitude?.toFixed(4)}, {sub.longitude?.toFixed(4)}
                            </span>
                          </div>
                        </td>
                        <td>{getStatusBadge(sub.status)}</td>
                        <td className="text-sm text-slate-500">
                          {new Date(sub.submitted_at).toLocaleString()}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewDetail(sub)}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(sub)}
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-blue-600" />
                            </Button>
                            {sub.status === 'Pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleApprove(sub.id)}
                                  title="Approve"
                                  className="text-emerald-600 hover:text-emerald-700"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openRejectDialog(sub)}
                                  title="Reject"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
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
              <DialogTitle className="font-heading flex items-center justify-between">
                <span>Submission Details - {selectedSubmission?.property_id}</span>
                {selectedSubmission && getStatusBadge(selectedSubmission.status)}
              </DialogTitle>
            </DialogHeader>

            {selectedSubmission && (
              <div className="space-y-6">
                {/* Survey Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">New Owner Name</label>
                    <p className="font-medium">{selectedSubmission.new_owner_name || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">New Mobile</label>
                    <p className="font-medium font-mono">{selectedSubmission.new_mobile || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Receiver Name</label>
                    <p className="font-medium">{selectedSubmission.receiver_name || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Relation</label>
                    <p className="font-medium">{selectedSubmission.relation || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Old Property ID</label>
                    <p className="font-medium">{selectedSubmission.old_property_id || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Family ID</label>
                    <p className="font-medium">{selectedSubmission.family_id || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Aadhar Number</label>
                    <p className="font-medium font-mono">{selectedSubmission.aadhar_number || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Ward Number</label>
                    <p className="font-medium">{selectedSubmission.ward_number || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-500">Submitted By</label>
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

                {/* Review Remarks */}
                {selectedSubmission.review_remarks && (
                  <div className="p-4 bg-red-50 rounded-lg">
                    <label className="text-xs font-mono uppercase tracking-wider text-red-600">Rejection Remarks</label>
                    <p className="mt-1 text-red-800">{selectedSubmission.review_remarks}</p>
                  </div>
                )}

                {/* Photos */}
                <div>
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3 block">Photos (with GPS & Timestamp)</label>
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

                {/* Action Buttons */}
                {selectedSubmission.status === 'Pending' && (
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      onClick={() => handleApprove(selectedSubmission.id)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => openRejectDialog(selectedSubmission)}
                      variant="destructive"
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600">Reject Submission</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-600">Please provide a reason for rejection (mandatory):</p>
              <Textarea
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="Enter rejection remarks..."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject}>
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Submission</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Owner Name</label>
                  <Input
                    value={editData.new_owner_name}
                    onChange={(e) => setEditData({ ...editData, new_owner_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Mobile</label>
                  <Input
                    value={editData.new_mobile}
                    onChange={(e) => setEditData({ ...editData, new_mobile: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Receiver Name</label>
                  <Input
                    value={editData.receiver_name}
                    onChange={(e) => setEditData({ ...editData, receiver_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Relation</label>
                  <Input
                    value={editData.relation}
                    onChange={(e) => setEditData({ ...editData, relation: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Old Property ID</label>
                  <Input
                    value={editData.old_property_id}
                    onChange={(e) => setEditData({ ...editData, old_property_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Family ID</label>
                  <Input
                    value={editData.family_id}
                    onChange={(e) => setEditData({ ...editData, family_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Aadhar Number</label>
                  <Input
                    value={editData.aadhar_number}
                    onChange={(e) => setEditData({ ...editData, aadhar_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ward Number</label>
                  <Input
                    value={editData.ward_number}
                    onChange={(e) => setEditData({ ...editData, ward_number: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Remarks</label>
                <Textarea
                  value={editData.remarks}
                  onChange={(e) => setEditData({ ...editData, remarks: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button onClick={handleEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

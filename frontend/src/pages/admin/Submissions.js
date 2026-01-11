import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
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
import { 
  ClipboardCheck, MapPin, Camera, ChevronLeft, ChevronRight, 
  Eye, Check, X, Edit, User, Phone, Home, Hash, CreditCard, 
  Building, Users, FileText, Pen, Image as ImageIcon, Save,
  ExternalLink, Trash2, Plus, AlertTriangle, Lock, UserX, CheckCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const RELATION_OPTIONS = [
  'Self', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother',
  'Brother', 'Sister', 'Tenant', 'Caretaker', 'Other'
];

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
  const [editPropertyData, setEditPropertyData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editPhotos, setEditPhotos] = useState([]);
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

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
    // Submission data
    setEditData({
      new_owner_name: submission.new_owner_name || '',
      new_mobile: submission.new_mobile || '',
      receiver_name: submission.receiver_name || '',
      relation: submission.relation || '',
      old_property_id: submission.old_property_id || '',
      family_id: submission.family_id || '',
      aadhar_number: submission.aadhar_number || '',
      ward_number: submission.ward_number || '',
      remarks: submission.remarks || '',
      latitude: submission.latitude || '',
      longitude: submission.longitude || ''
    });
    // Property data
    setEditPropertyData({
      property_id: submission.property_id || '',
      owner_name: submission.property_owner_name || '',
      mobile: submission.property_mobile || '',
      address: submission.property_address || '',
      amount: submission.property_amount || '',
      ward: submission.property_ward || ''
    });
    // Photos - filter duplicates
    const uniquePhotos = submission.photos?.filter((photo, index, self) => 
      index === self.findIndex(p => p.file_url === photo.file_url)
    ) || [];
    setEditPhotos(uniquePhotos);
    setEditDialog(true);
  };

  const handleEdit = async () => {
    setSavingEdit(true);
    try {
      // Update submission with new data and updated photos
      const updateData = {
        ...editData,
        photos: editPhotos
      };
      
      await axios.put(`${API_URL}/admin/submissions/${selectedSubmission.id}`, updateData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      toast.success('Survey submission updated successfully');
      fetchSubmissions();
      setEditDialog(false);
    } catch (error) {
      console.error('Edit error:', error);
      toast.error('Failed to save changes');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeletePhoto = (photoIndex) => {
    const newPhotos = editPhotos.filter((_, idx) => idx !== photoIndex);
    setEditPhotos(newPhotos);
    toast.success('Photo removed. Click Save to apply changes.');
  };

  const handleAddPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('submission_id', selectedSubmission.id);
      formData.append('photo_type', 'HOUSE');
      
      const response = await axios.post(`${API_URL}/admin/submissions/upload-photo`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Add new photo to list
      const newPhoto = {
        file_url: response.data.file_url,
        photo_type: 'HOUSE'
      };
      setEditPhotos([...editPhotos, newPhoto]);
      toast.success('Photo added successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
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
              <span className="text-sm text-slate-500 ml-auto">
                Total: {pagination.total} submissions
              </span>
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
            <Card className="shadow-lg border-0">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Property ID</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Employee</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">New Owner</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Receiver</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">GPS</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Submitted</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm font-medium text-blue-600">{sub.property_id}</td>
                        <td className="px-4 py-3 text-sm">{sub.employee_name}</td>
                        <td className="px-4 py-3 text-sm">{sub.new_owner_name || '-'}</td>
                        <td className="px-4 py-3 text-sm">{sub.receiver_name || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-emerald-600">
                            <MapPin className="w-3 h-3" />
                            <span className="text-xs font-mono">
                              {sub.latitude?.toFixed(4)}, {sub.longitude?.toFixed(4)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(sub.status)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(sub.submitted_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewDetail(sub)}
                              title="View Details"
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(sub)}
                              title="Edit"
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {(!sub.status || sub.status === 'Pending') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleApprove(sub.id)}
                                  title="Approve"
                                  className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openRejectDialog(sub)}
                                  title="Reject"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
                Showing {((pagination.page - 1) * 20) + 1} to {Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
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

        {/* Detail View Dialog */}
        <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                    className="text-sm text-emerald-600 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    View on Google Maps <ExternalLink className="w-3 h-3" />
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
                    {/* Filter out duplicate photos (same file_url) and show only unique photos */}
                    {selectedSubmission.photos?.filter((photo, index, self) => 
                      index === self.findIndex(p => p.file_url === photo.file_url)
                    ).map((photo, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={`${process.env.REACT_APP_BACKEND_URL}${photo.file_url}`}
                          alt={photo.photo_type}
                          className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90"
                          onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}${photo.file_url}`, '_blank')}
                        />
                        <span className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-semibold ${
                          photo.photo_type === 'HOUSE' ? 'bg-blue-100 text-blue-700' :
                          photo.photo_type === 'GATE' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {photo.photo_type === 'HOUSE' ? 'PROPERTY' : photo.photo_type}
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
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailDialog(false);
                      openEditDialog(selectedSubmission);
                    }}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Details
                  </Button>
                  {(!selectedSubmission.status || selectedSubmission.status === 'Pending') && (
                    <>
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
                    </>
                  )}
                </div>
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

        {/* Full Edit Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Edit className="w-5 h-5 text-blue-600" />
                  Edit Submission - {selectedSubmission?.property_id}
                </span>
                {selectedSubmission && getStatusBadge(selectedSubmission.status)}
              </DialogTitle>
            </DialogHeader>

            {selectedSubmission && (
              <div className="space-y-6">
                {/* Property Details Section - READ ONLY */}
                <Card className="border-slate-200 bg-slate-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2">
                        <Home className="w-4 h-4" />
                        PROPERTY DETAILS (Excel Data - Read Only)
                      </span>
                      <span className="text-xs font-normal bg-slate-200 text-slate-600 px-2 py-1 rounded">Cannot Edit</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-slate-500">Property ID</Label>
                        <p className="font-mono font-medium text-slate-800">{selectedSubmission.property_id || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Owner Name</Label>
                        <p className="font-medium text-slate-800">{selectedSubmission.property_owner_name || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Mobile</Label>
                        <p className="font-mono text-slate-800">{selectedSubmission.property_mobile || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-slate-500">Address</Label>
                        <p className="text-slate-800">{selectedSubmission.property_address || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Amount</Label>
                        <p className="font-mono font-semibold text-emerald-700">₹{selectedSubmission.property_amount || '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Survey Submission Details - EDITABLE */}
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between text-emerald-700">
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        SURVEY SUBMISSION DETAILS (Surveyor Data)
                      </span>
                      <span className="text-xs font-normal bg-emerald-200 text-emerald-700 px-2 py-1 rounded">Editable</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600 flex items-center gap-1">
                          <User className="w-3 h-3" /> New Owner Name
                        </Label>
                        <Input
                          value={editData.new_owner_name}
                          onChange={(e) => setEditData({ ...editData, new_owner_name: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> New Mobile Number
                        </Label>
                        <Input
                          value={editData.new_mobile}
                          onChange={(e) => setEditData({ ...editData, new_mobile: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Receiver Name
                        </Label>
                        <Input
                          value={editData.receiver_name}
                          onChange={(e) => setEditData({ ...editData, receiver_name: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600">Relation with Owner</Label>
                        <Select
                          value={editData.relation}
                          onValueChange={(value) => setEditData({ ...editData, relation: value })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select relation" />
                          </SelectTrigger>
                          <SelectContent>
                            {RELATION_OPTIONS.map((rel) => (
                              <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600 flex items-center gap-1">
                          <Hash className="w-3 h-3" /> Old Property ID
                        </Label>
                        <Input
                          value={editData.old_property_id}
                          onChange={(e) => setEditData({ ...editData, old_property_id: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Family ID
                        </Label>
                        <Input
                          value={editData.family_id}
                          onChange={(e) => setEditData({ ...editData, family_id: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600 flex items-center gap-1">
                          <CreditCard className="w-3 h-3" /> Aadhar Number
                        </Label>
                        <Input
                          value={editData.aadhar_number}
                          onChange={(e) => setEditData({ ...editData, aadhar_number: e.target.value })}
                          className="bg-white"
                          maxLength={12}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600 flex items-center gap-1">
                          <Building className="w-3 h-3" /> Ward Number
                        </Label>
                        <Input
                          value={editData.ward_number}
                          onChange={(e) => setEditData({ ...editData, ward_number: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                    </div>
                    
                    {/* GPS Coordinates */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Latitude
                        </Label>
                        <Input
                          value={editData.latitude}
                          onChange={(e) => setEditData({ ...editData, latitude: e.target.value })}
                          className="bg-white font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Longitude
                        </Label>
                        <Input
                          value={editData.longitude}
                          onChange={(e) => setEditData({ ...editData, longitude: e.target.value })}
                          className="bg-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">Remarks</Label>
                      <Textarea
                        value={editData.remarks}
                        onChange={(e) => setEditData({ ...editData, remarks: e.target.value })}
                        rows={2}
                        className="bg-white"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Photos Section - with Delete and Add */}
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between text-amber-700">
                      <span className="flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        PHOTOS (with GPS Watermark)
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="h-7 text-xs"
                      >
                        {uploadingPhoto ? (
                          <>Uploading...</>
                        ) : (
                          <>
                            <Plus className="w-3 h-3 mr-1" />
                            Add Photo
                          </>
                        )}
                      </Button>
                      <input
                        type="file"
                        ref={photoInputRef}
                        accept="image/*"
                        onChange={handleAddPhoto}
                        className="hidden"
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editPhotos?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {editPhotos.map((photo, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={`${process.env.REACT_APP_BACKEND_URL}${photo.file_url}`}
                              alt={photo.photo_type}
                              className="w-full h-40 object-cover rounded-lg border-2 border-white shadow cursor-pointer"
                              onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}${photo.file_url}`, '_blank')}
                            />
                            <span className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-semibold shadow ${
                              photo.photo_type === 'HOUSE' ? 'bg-blue-500 text-white' :
                              photo.photo_type === 'GATE' ? 'bg-amber-500 text-white' :
                              'bg-slate-500 text-white'
                            }`}>
                              {photo.photo_type}
                            </span>
                            {/* Delete Button */}
                            <Button
                              size="sm"
                              variant="destructive"
                              className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeletePhoto(idx)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="absolute bottom-2 right-2 h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}${photo.file_url}`, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" /> View Full
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p>No photos available</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => photoInputRef.current?.click()}
                          className="mt-2"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Photo
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Signature Section */}
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-purple-700">
                      <Pen className="w-4 h-4" />
                      PROPERTY HOLDER SIGNATURE
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedSubmission.signature_url ? (
                      <div className="bg-white border-2 border-dashed border-purple-200 rounded-lg p-4">
                        <img
                          src={`${process.env.REACT_APP_BACKEND_URL}${selectedSubmission.signature_url}`}
                          alt="Signature"
                          className="max-h-28 mx-auto object-contain"
                        />
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        <Pen className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p>No signature available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Submission Info */}
                <div className="flex items-center justify-between text-sm text-slate-500 pt-2 border-t">
                  <span>Submitted by: <strong>{selectedSubmission.employee_name}</strong></span>
                  <span>Date: <strong>{new Date(selectedSubmission.submitted_at).toLocaleString()}</strong></span>
                  <span>Status: {getStatusBadge(selectedSubmission.status)}</span>
                </div>
              </div>
            )}

            <DialogFooter className="mt-4 pt-4 border-t flex-wrap gap-2">
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEdit} disabled={savingEdit} className="bg-blue-600 hover:bg-blue-700">
                  {savingEdit ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
              {(!selectedSubmission?.status || selectedSubmission?.status === 'Pending') && (
                <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                  <Button
                    onClick={() => {
                      setEditDialog(false);
                      handleApprove(selectedSubmission.id);
                    }}
                    className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => {
                      setEditDialog(false);
                      openRejectDialog(selectedSubmission);
                    }}
                    variant="destructive"
                    className="flex-1 sm:flex-none"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

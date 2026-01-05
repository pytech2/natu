import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
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
import SignatureCanvas from 'react-signature-canvas';
import {
  ArrowLeft,
  MapPin,
  Camera,
  Navigation,
  CheckCircle,
  AlertTriangle,
  User,
  Phone,
  Home,
  FileText,
  Send,
  Flag,
  Loader2,
  Pen,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  Users,
  Hash,
  CreditCard,
  Building
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Function to add watermark to image with GPS, Date, Time
const addWatermarkToImage = (file, latitude, longitude) => {
  return new Promise((resolve, reject) => {
    // Create image from file
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0, img.width, img.height);
        
        // Watermark settings
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        
        // Format GPS coordinates
        const latStr = latitude ? latitude.toFixed(6) : 'N/A';
        const longStr = longitude ? longitude.toFixed(6) : 'N/A';
        
        const watermarkLines = [
          `Date: ${dateStr}`,
          `Time: ${timeStr}`,
          `Lat: ${latStr}`,
          `Long: ${longStr}`,
          `maps.google.com`
        ];
        
        // Calculate font size based on image dimensions (responsive)
        const minDimension = Math.min(img.width, img.height);
        const fontSize = Math.max(24, Math.floor(minDimension * 0.04));
        const padding = Math.floor(fontSize * 0.8);
        const lineHeight = Math.floor(fontSize * 1.5);
        
        // Set font for measuring text
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        
        // Calculate max text width
        let maxTextWidth = 0;
        watermarkLines.forEach(line => {
          const metrics = ctx.measureText(line);
          if (metrics.width > maxTextWidth) {
            maxTextWidth = metrics.width;
          }
        });
        
        // Background rectangle dimensions
        const boxWidth = maxTextWidth + padding * 2;
        const boxHeight = lineHeight * watermarkLines.length + padding * 2;
        
        // Position at bottom-left with margin
        const boxX = padding;
        const boxY = img.height - boxHeight - padding;
        
        // Draw semi-transparent black background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        
        // Draw yellow border
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 4;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        
        // Draw text
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.textBaseline = 'top';
        
        watermarkLines.forEach((line, index) => {
          // Highlight GPS coordinates in yellow
          if (line.startsWith('Lat:') || line.startsWith('Long:')) {
            ctx.fillStyle = '#FFD700';
          } else if (line.includes('google')) {
            ctx.fillStyle = '#00FF00';
          } else {
            ctx.fillStyle = '#FFFFFF';
          }
          ctx.fillText(line, boxX + padding, boxY + padding + (index * lineHeight));
        });
        
        // Add location pin icon at top-right
        const iconSize = Math.floor(fontSize * 3);
        const iconX = img.width - iconSize - padding;
        const iconY = padding;
        
        // Draw red circle background
        ctx.beginPath();
        ctx.arc(iconX + iconSize/2, iconY + iconSize/2, iconSize/2, 0, Math.PI * 2);
        ctx.fillStyle = '#DC2626';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw GPS text in circle
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${iconSize * 0.35}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GPS', iconX + iconSize/2, iconY + iconSize/2);
        
        // Reset text align
        ctx.textAlign = 'left';
        
        // Convert canvas to blob with high quality
        canvas.toBlob((blob) => {
          if (blob) {
            const watermarkedFile = new File(
              [blob], 
              'photo_' + Date.now() + '.jpg', 
              { type: 'image/jpeg' }
            );
            resolve(watermarkedFile);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/jpeg', 0.95);
        
      } catch (error) {
        console.error('Canvas error:', error);
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    
    // Create object URL from file and load image
    img.src = URL.createObjectURL(file);
  });
};

// Relation options - Updated as per requirements
const RELATION_OPTIONS = [
  'Self',
  'Family Member',
  'Tenant',
  'Neighbour',
  'Other'
];

// Calculate distance between two GPS coordinates in meters (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default function Survey() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [property, setProperty] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(null); // 'house' or 'gate'

  // GPS State
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [location, setLocation] = useState({ latitude: null, longitude: null });

  // Form State - NEW FIELDS as per user requirements
  const [formData, setFormData] = useState({
    new_owner_name: '',
    new_mobile: '',
    receiver_name: '',
    relation: '',
    family_id: '',
    aadhar_number: '',
    ward_number: '',
    remarks: '',
    self_satisfied: '' // New field: 'yes' or 'no'
  });
  
  // 50m radius check state
  const [withinRange, setWithinRange] = useState(null); // null = checking, true = in range, false = out of range
  const [distanceFromProperty, setDistanceFromProperty] = useState(null);

  // Photo State
  const [housePhoto, setHousePhoto] = useState(null);
  const [gatePhoto, setGatePhoto] = useState(null);
  const [housePhotoPreview, setHousePhotoPreview] = useState(null);
  const [gatePhotoPreview, setGatePhotoPreview] = useState(null);

  // Signature State
  const signatureRef = useRef(null);
  const [signatureData, setSignatureData] = useState(null);

  // File input refs - separate for camera and gallery
  const houseCameraRef = useRef(null);
  const houseGalleryRef = useRef(null);
  const gateCameraRef = useRef(null);
  const gateGalleryRef = useRef(null);

  useEffect(() => {
    fetchProperty();
    getLocation();
  }, [propertyId]);

  // Check distance when location and property are both available
  useEffect(() => {
    if (location.latitude && location.longitude && property?.latitude && property?.longitude) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        property.latitude,
        property.longitude
      );
      setDistanceFromProperty(Math.round(distance));
      setWithinRange(distance <= 50); // 50 meters radius
    }
  }, [location, property]);

  const fetchProperty = async () => {
    try {
      const response = await axios.get(`${API_URL}/employee/property/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProperty(response.data.property);
      setSubmission(response.data.submission);

      // Pre-fill form with existing data if available (for re-submission after rejection)
      if (response.data.submission) {
        const sub = response.data.submission;
        setFormData({
          new_owner_name: sub.new_owner_name || response.data.property.owner_name || '',
          new_mobile: sub.new_mobile || response.data.property.mobile || '',
          receiver_name: sub.receiver_name || '',
          relation: sub.relation || '',
          family_id: sub.family_id || '',
          aadhar_number: sub.aadhar_number || '',
          ward_number: sub.ward_number || '', // Now editable, blank
          remarks: sub.remarks || '',
          self_satisfied: sub.self_satisfied || ''
        });
      } else {
        // Pre-fill with property data for new submissions
        setFormData(prev => ({
          ...prev,
          new_owner_name: response.data.property.owner_name || '',
          new_mobile: response.data.property.mobile || '',
          ward_number: '' // Blank and editable
        }));
      }
    } catch (error) {
      toast.error('Failed to load property');
      navigate('/employee/properties');
    } finally {
      setLoading(false);
    }
  };

  const getLocation = () => {
    setGpsStatus('loading');
    if (!navigator.geolocation) {
      setGpsStatus('error');
      toast.error('GPS not supported on this device');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGpsStatus('success');
        toast.success('GPS location captured!');
      },
      (error) => {
        setGpsStatus('error');
        toast.error('Failed to get GPS. Please enable location services.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const processAndSetPhoto = async (file, type) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Check if GPS is captured
    if (!location.latitude || !location.longitude) {
      toast.error('Please capture GPS location first!');
      return;
    }

    setProcessingPhoto(type);

    try {
      // Add watermark to photo
      const watermarkedFile = await addWatermarkToImage(
        file, 
        location.latitude, 
        location.longitude
      );
      
      // Create preview URL from watermarked file
      const previewUrl = URL.createObjectURL(watermarkedFile);
      
      if (type === 'house') {
        setHousePhoto(watermarkedFile);
        setHousePhotoPreview(previewUrl);
      } else {
        setGatePhoto(watermarkedFile);
        setGatePhotoPreview(previewUrl);
      }
      
      toast.success('Photo captured with GPS & timestamp watermark!');
      
    } catch (error) {
      console.error('Photo processing error:', error);
      toast.error('Failed to process photo. Please try again.');
    } finally {
      setProcessingPhoto(null);
    }
  };

  const handlePhotoChange = (e, type) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndSetPhoto(file, type);
    }
    // Reset input value so same file can be selected again
    e.target.value = '';
  };

  const openCamera = (type) => {
    if (!location.latitude) {
      toast.error('Please capture GPS location first!');
      return;
    }
    if (type === 'house') {
      houseCameraRef.current?.click();
    } else {
      gateCameraRef.current?.click();
    }
  };

  const openGallery = (type) => {
    if (!location.latitude) {
      toast.error('Please capture GPS location first!');
      return;
    }
    if (type === 'house') {
      houseGalleryRef.current?.click();
    } else {
      gateGalleryRef.current?.click();
    }
  };

  const clearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setSignatureData(null);
    }
  };

  const saveSignature = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      const dataUrl = signatureRef.current.toDataURL('image/png');
      setSignatureData(dataUrl);
      toast.success('Signature captured');
    } else {
      toast.error('Please provide a signature');
    }
  };

  const dataURLtoBlob = (dataURL) => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.receiver_name || !formData.relation) {
      toast.error('Please fill in receiver name and relation');
      return;
    }

    if (!formData.self_satisfied) {
      toast.error('Please select Self Satisfied option');
      return;
    }

    if (!location.latitude || !location.longitude) {
      toast.error('GPS location is required');
      return;
    }

    if (!housePhoto || !gatePhoto) {
      toast.error('Both house photo and gate photo are required');
      return;
    }

    if (!signatureData) {
      toast.error('Property holder signature is required');
      return;
    }

    setSubmitting(true);

    try {
      const formDataObj = new FormData();
      // Survey fields - using property data for locked fields
      formDataObj.append('new_owner_name', property?.owner_name || '');
      formDataObj.append('new_mobile', property?.mobile || '');
      formDataObj.append('receiver_name', formData.receiver_name);
      formDataObj.append('relation', formData.relation);
      formDataObj.append('old_property_id', ''); // Removed field
      formDataObj.append('family_id', formData.family_id || '');
      formDataObj.append('aadhar_number', formData.aadhar_number || '');
      formDataObj.append('ward_number', formData.ward_number || '');
      formDataObj.append('remarks', formData.remarks || '');
      formDataObj.append('self_satisfied', formData.self_satisfied || '');
      formDataObj.append('latitude', location.latitude);
      formDataObj.append('longitude', location.longitude);
      formDataObj.append('house_photo', housePhoto);
      formDataObj.append('gate_photo', gatePhoto);
      
      const signatureBlob = dataURLtoBlob(signatureData);
      const signatureFile = new File([signatureBlob], 'signature.png', { type: 'image/png' });
      formDataObj.append('signature', signatureFile);
      
      formDataObj.append('authorization', `Bearer ${token}`);

      await axios.post(`${API_URL}/employee/submit/${propertyId}`, formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Survey submitted successfully!');
      navigate('/employee/properties');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit survey');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFlag = async () => {
    const remarks = prompt('Please enter reason for flagging:');
    if (!remarks) return;

    try {
      const formDataObj = new FormData();
      formDataObj.append('remarks', remarks);
      formDataObj.append('authorization', `Bearer ${token}`);

      await axios.post(`${API_URL}/employee/flag/${propertyId}`, formDataObj, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Property flagged');
      navigate('/employee/properties');
    } catch (error) {
      toast.error('Failed to flag property');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isCompleted = property?.status === 'Completed';

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="flex items-center px-4 h-14">
          <button
            onClick={() => navigate('/employee/properties')}
            className="mr-3 text-slate-500"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-heading font-semibold text-slate-900">
              {isCompleted ? 'View Survey' : 'Survey Form'}
            </h1>
            <p className="text-xs text-slate-500">{property?.property_id}</p>
          </div>
          {!isCompleted && (
            <button onClick={handleFlag} className="text-red-500 p-2" data-testid="flag-btn">
              <Flag className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <main className="p-4 space-y-4" data-testid="survey-form">
        {/* Property Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Property ID</span>
              <span className="font-mono font-medium">{property?.property_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Owner</span>
              <span className="font-medium">{property?.owner_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mobile</span>
              <span className="font-mono">{property?.mobile || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Address</span>
              <span className="text-right max-w-[60%]">{property?.address || '-'}</span>
            </div>
            {property?.amount && (
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-mono text-emerald-700 font-semibold">₹{property?.amount}</span>
              </div>
            )}
            {property?.ward && (
              <div className="flex justify-between">
                <span className="text-slate-500">Ward</span>
                <span>{property?.ward}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GPS Status */}
        <Card className={`${
          gpsStatus === 'success' ? 'border-emerald-300 bg-emerald-50' :
          gpsStatus === 'error' ? 'border-red-300 bg-red-50' :
          'border-amber-300 bg-amber-50'
        }`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {gpsStatus === 'loading' ? (
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                ) : gpsStatus === 'success' ? (
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                )}
                <div>
                  <p className="font-semibold text-slate-900">
                    {gpsStatus === 'success' ? '✓ GPS Captured' : 'Step 1: Capture GPS'}
                  </p>
                  {location.latitude ? (
                    <p className="text-xs font-mono text-slate-600">
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">Required before taking photos</p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={getLocation}
                className={gpsStatus === 'success' ? 'bg-emerald-600' : 'bg-amber-600 hover:bg-amber-700'}
                data-testid="capture-gps-btn"
              >
                <MapPin className="w-4 h-4 mr-1" />
                {gpsStatus === 'success' ? 'Recapture' : 'Capture'}
              </Button>
            </div>
            {location.latitude && (
              <a
                href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-700 hover:underline mt-2 inline-block"
              >
                📍 View on Google Maps
              </a>
            )}
          </CardContent>
        </Card>

        {!isCompleted && (
          <>
            {/* Survey Form Fields - NEW FIELDS */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                  Survey Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* New Owner Details */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    New Owner&apos;s Name *
                  </Label>
                  <Input
                    data-testid="new-owner-name-input"
                    value={formData.new_owner_name}
                    onChange={(e) => setFormData({ ...formData, new_owner_name: e.target.value })}
                    className="h-12 text-base"
                    placeholder="Enter new owner's name"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    New Mobile Number *
                  </Label>
                  <Input
                    data-testid="new-mobile-input"
                    type="tel"
                    value={formData.new_mobile}
                    onChange={(e) => setFormData({ ...formData, new_mobile: e.target.value })}
                    className="h-12 text-base"
                    placeholder="Enter new mobile number"
                  />
                </div>

                {/* Receiver Details */}
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs font-semibold text-blue-700 mb-3">NOTICE RECEIVER DETAILS</p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-slate-400" />
                        Receiver Name *
                      </Label>
                      <Input
                        data-testid="receiver-name-input"
                        value={formData.receiver_name}
                        onChange={(e) => setFormData({ ...formData, receiver_name: e.target.value })}
                        className="h-12"
                        placeholder="Name of person receiving notice"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Relation with Owner *</Label>
                      <Select
                        value={formData.relation}
                        onValueChange={(value) => setFormData({ ...formData, relation: value })}
                      >
                        <SelectTrigger className="h-12" data-testid="relation-select">
                          <SelectValue placeholder="Select relation" />
                        </SelectTrigger>
                        <SelectContent>
                          {RELATION_OPTIONS.map((rel) => (
                            <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Property IDs */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <Hash className="w-4 h-4 text-slate-400" />
                      Old Property ID
                    </Label>
                    <Input
                      data-testid="old-property-id-input"
                      value={formData.old_property_id}
                      onChange={(e) => setFormData({ ...formData, old_property_id: e.target.value })}
                      className="h-12"
                      placeholder="Old Prop ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-slate-400" />
                      Family ID
                    </Label>
                    <Input
                      data-testid="family-id-input"
                      value={formData.family_id}
                      onChange={(e) => setFormData({ ...formData, family_id: e.target.value })}
                      className="h-12"
                      placeholder="Family ID"
                    />
                  </div>
                </div>

                {/* Aadhar and Ward */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      Aadhar Number
                    </Label>
                    <Input
                      data-testid="aadhar-number-input"
                      value={formData.aadhar_number}
                      onChange={(e) => setFormData({ ...formData, aadhar_number: e.target.value })}
                      className="h-12"
                      placeholder="12-digit Aadhar"
                      maxLength={12}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <Building className="w-4 h-4 text-slate-400" />
                      Ward Number
                    </Label>
                    <Input
                      data-testid="ward-number-input"
                      value={formData.ward_number}
                      onChange={(e) => setFormData({ ...formData, ward_number: e.target.value })}
                      className="h-12"
                      placeholder="Ward #"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Remarks (Optional)</Label>
                  <Textarea
                    data-testid="remarks-input"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Any additional notes..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Photo Upload - HOUSE */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                  Step 2: House/Property Photo *
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Hidden file inputs */}
                <input
                  ref={houseCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handlePhotoChange(e, 'house')}
                  className="hidden"
                />
                <input
                  ref={houseGalleryRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoChange(e, 'house')}
                  className="hidden"
                />

                {processingPhoto === 'house' ? (
                  <div className="h-48 flex flex-col items-center justify-center bg-blue-50 rounded-lg border-2 border-blue-200">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                    <p className="text-blue-700 font-medium">Adding GPS & timestamp...</p>
                  </div>
                ) : housePhotoPreview ? (
                  <div className="relative">
                    <img src={housePhotoPreview} alt="House" className="w-full h-48 object-cover rounded-lg" />
                    <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => openCamera('house')}>
                        <Camera className="w-4 h-4 mr-1" /> Retake
                      </Button>
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => openGallery('house')}>
                        <ImageIcon className="w-4 h-4 mr-1" /> Gallery
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <p className="text-sm text-blue-800">📸 GPS, Date & Time will be printed on photo</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => openCamera('house')}
                        className="h-20 flex-col gap-2 bg-blue-600 hover:bg-blue-700"
                        disabled={!location.latitude}
                      >
                        <Camera className="w-8 h-8" />
                        <span>Take Photo</span>
                      </Button>
                      <Button
                        onClick={() => openGallery('house')}
                        variant="outline"
                        className="h-20 flex-col gap-2"
                        disabled={!location.latitude}
                      >
                        <Upload className="w-8 h-8" />
                        <span>Upload</span>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Photo Upload - GATE */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                  Step 3: Gate/Entrance Photo *
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Hidden file inputs */}
                <input
                  ref={gateCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handlePhotoChange(e, 'gate')}
                  className="hidden"
                />
                <input
                  ref={gateGalleryRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoChange(e, 'gate')}
                  className="hidden"
                />

                {processingPhoto === 'gate' ? (
                  <div className="h-48 flex flex-col items-center justify-center bg-blue-50 rounded-lg border-2 border-blue-200">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                    <p className="text-blue-700 font-medium">Adding GPS & timestamp...</p>
                  </div>
                ) : gatePhotoPreview ? (
                  <div className="relative">
                    <img src={gatePhotoPreview} alt="Gate" className="w-full h-48 object-cover rounded-lg" />
                    <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => openCamera('gate')}>
                        <Camera className="w-4 h-4 mr-1" /> Retake
                      </Button>
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => openGallery('gate')}>
                        <ImageIcon className="w-4 h-4 mr-1" /> Gallery
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <p className="text-sm text-blue-800">📸 GPS, Date & Time will be printed on photo</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => openCamera('gate')}
                        className="h-20 flex-col gap-2 bg-blue-600 hover:bg-blue-700"
                        disabled={!location.latitude}
                      >
                        <Camera className="w-8 h-8" />
                        <span>Take Photo</span>
                      </Button>
                      <Button
                        onClick={() => openGallery('gate')}
                        variant="outline"
                        className="h-20 flex-col gap-2"
                        disabled={!location.latitude}
                      >
                        <Upload className="w-8 h-8" />
                        <span>Upload</span>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Digital Signature - FULL WIDTH */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Pen className="w-4 h-4" />
                  Step 4: Property Holder Signature *
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!signatureData ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600 text-center">
                      Ask property holder to sign in the box below
                    </p>
                    <div className="border-2 border-slate-300 rounded-lg bg-white touch-none" style={{ height: '200px' }}>
                      <SignatureCanvas
                        ref={signatureRef}
                        canvasProps={{
                          style: { 
                            width: '100%', 
                            height: '200px',
                            touchAction: 'none'
                          }
                        }}
                        backgroundColor="white"
                        penColor="black"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={clearSignature}
                        className="h-12"
                        data-testid="clear-signature-btn"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Clear
                      </Button>
                      <Button
                        onClick={saveSignature}
                        className="h-12 bg-emerald-600 hover:bg-emerald-700"
                        data-testid="save-signature-btn"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirm
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="border-2 border-emerald-300 rounded-lg bg-emerald-50 p-2">
                      <img src={signatureData} alt="Signature" className="w-full h-32 object-contain" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Signature captured
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setSignatureData(null)}>
                        Re-sign
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Existing Submission View */}
        {isCompleted && submission && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                  Submitted Survey
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">New Owner Name</span>
                  <span className="font-medium">{submission.new_owner_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">New Mobile</span>
                  <span className="font-mono">{submission.new_mobile}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Receiver Name</span>
                  <span className="font-medium">{submission.receiver_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Relation</span>
                  <span>{submission.relation}</span>
                </div>
                {submission.old_property_id && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Old Property ID</span>
                    <span className="font-mono">{submission.old_property_id}</span>
                  </div>
                )}
                {submission.family_id && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Family ID</span>
                    <span className="font-mono">{submission.family_id}</span>
                  </div>
                )}
                {submission.aadhar_number && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Aadhar Number</span>
                    <span className="font-mono">{submission.aadhar_number}</span>
                  </div>
                )}
                {submission.ward_number && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ward Number</span>
                    <span>{submission.ward_number}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">GPS</span>
                  <span className="font-mono text-xs">{submission.latitude?.toFixed(6)}, {submission.longitude?.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Submitted</span>
                  <span>{new Date(submission.submitted_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    submission.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                    submission.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {submission.status || 'Pending'}
                  </span>
                </div>
                {submission.remarks && (
                  <div>
                    <span className="text-slate-500 block mb-1">Remarks</span>
                    <p className="bg-slate-50 p-2 rounded">{submission.remarks}</p>
                  </div>
                )}
                {submission.review_remarks && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <span className="text-red-600 text-xs font-semibold block mb-1">REJECTION REASON</span>
                    <p className="text-red-800">{submission.review_remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                  Photos (with GPS & Timestamp)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {submission.photos?.map((photo, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={`${process.env.REACT_APP_BACKEND_URL}${photo.file_url}`}
                      alt={photo.photo_type}
                      className="w-full h-auto rounded-lg"
                    />
                    <span className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-white text-xs font-bold rounded">
                      {photo.photo_type}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {submission.signature_url && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                    Property Holder Signature
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg bg-white p-2">
                    <img
                      src={`${process.env.REACT_APP_BACKEND_URL}${submission.signature_url}`}
                      alt="Signature"
                      className="w-full h-auto object-contain"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Submit Button */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-lg">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700"
            data-testid="submit-survey-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Submit Survey
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

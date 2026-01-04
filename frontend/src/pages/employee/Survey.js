import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
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
  RotateCcw
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Function to add watermark to image
const addWatermarkToImage = (file, latitude, longitude) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
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
        
        const watermarkLines = [
          `Date: ${dateStr}`,
          `Time: ${timeStr}`,
          `Lat: ${latitude?.toFixed(6) || 'N/A'}`,
          `Long: ${longitude?.toFixed(6) || 'N/A'}`
        ];
        
        // Calculate font size based on image dimensions
        const fontSize = Math.max(16, Math.min(img.width, img.height) * 0.025);
        const padding = fontSize * 0.8;
        const lineHeight = fontSize * 1.4;
        
        // Background rectangle dimensions
        const textWidth = fontSize * 14;
        const textHeight = lineHeight * watermarkLines.length + padding * 2;
        
        // Position at bottom-left with margin
        const boxX = padding;
        const boxY = img.height - textHeight - padding;
        
        // Draw semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(boxX, boxY, textWidth, textHeight);
        
        // Draw border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, textWidth, textHeight);
        
        // Draw text
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.textBaseline = 'top';
        
        watermarkLines.forEach((line, index) => {
          ctx.fillText(line, boxX + padding, boxY + padding + (index * lineHeight));
        });
        
        // Also add Google Maps icon hint at top-right
        const mapIconSize = fontSize * 2;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(img.width - padding - mapIconSize/2, padding + mapIconSize/2, mapIconSize/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${mapIconSize * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📍', img.width - padding - mapIconSize/2, padding + mapIconSize/2);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          const watermarkedFile = new File([blob], file.name, { type: 'image/jpeg' });
          resolve(watermarkedFile);
        }, 'image/jpeg', 0.9);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export default function Survey() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [property, setProperty] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // GPS State
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle, loading, success, error
  const [location, setLocation] = useState({ latitude: null, longitude: null });

  // Form State
  const [formData, setFormData] = useState({
    respondent_name: '',
    respondent_phone: '',
    house_number: '',
    tax_number: '',
    remarks: ''
  });

  // Photo State
  const [housePhoto, setHousePhoto] = useState(null);
  const [gatePhoto, setGatePhoto] = useState(null);
  const [housePhotoPreview, setHousePhotoPreview] = useState(null);
  const [gatePhotoPreview, setGatePhotoPreview] = useState(null);

  // Signature State
  const signatureRef = useRef(null);
  const [signatureData, setSignatureData] = useState(null);

  const housePhotoRef = useRef(null);
  const gatePhotoRef = useRef(null);

  useEffect(() => {
    fetchProperty();
    getLocation();
  }, [propertyId]);

  const fetchProperty = async () => {
    try {
      const response = await axios.get(`${API_URL}/employee/property/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProperty(response.data.property);
      setSubmission(response.data.submission);

      // Pre-fill form with property data
      setFormData(prev => ({
        ...prev,
        respondent_name: response.data.property.owner_name || '',
        respondent_phone: response.data.property.mobile || '',
        tax_number: response.data.property.property_id || ''
      }));
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
        toast.success('GPS location captured');
      },
      (error) => {
        setGpsStatus('error');
        toast.error('Failed to get location. Please enable GPS.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoChange = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Show loading toast
    const loadingToast = toast.loading('Processing photo with watermark...');

    try {
      // Add watermark to photo
      const watermarkedFile = await addWatermarkToImage(file, location.latitude, location.longitude);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'house') {
          setHousePhoto(watermarkedFile);
          setHousePhotoPreview(reader.result);
        } else {
          setGatePhoto(watermarkedFile);
          setGatePhotoPreview(reader.result);
        }
        toast.dismiss(loadingToast);
        toast.success('Photo captured with GPS watermark');
      };
      reader.readAsDataURL(watermarkedFile);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to process photo');
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

  // Convert data URL to Blob
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
    // Validation
    if (!formData.respondent_name || !formData.respondent_phone) {
      toast.error('Please fill in respondent name and phone');
      return;
    }

    if (!location.latitude || !location.longitude) {
      toast.error('GPS location is required. Please capture your location.');
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
      formDataObj.append('respondent_name', formData.respondent_name);
      formDataObj.append('respondent_phone', formData.respondent_phone);
      formDataObj.append('house_number', formData.house_number);
      formDataObj.append('tax_number', formData.tax_number);
      formDataObj.append('remarks', formData.remarks);
      formDataObj.append('latitude', location.latitude);
      formDataObj.append('longitude', location.longitude);
      formDataObj.append('house_photo', housePhoto);
      formDataObj.append('gate_photo', gatePhoto);
      
      // Add signature as a file
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
        <div className="animate-pulse-slow text-slate-500">Loading...</div>
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
            <button
              onClick={handleFlag}
              className="text-red-500 p-2"
              data-testid="flag-btn"
            >
              <Flag className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4" data-testid="survey-form">
        {/* Property Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
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
              <span className="text-right max-w-[60%]">{property?.plot_address || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Area</span>
              <span>{property?.total_area || '-'}</span>
            </div>
          </CardContent>
        </Card>

        {/* GPS Status */}
        <Card className={`${
          gpsStatus === 'success' ? 'border-emerald-200 bg-emerald-50' :
          gpsStatus === 'error' ? 'border-red-200 bg-red-50' :
          'border-slate-200'
        }`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {gpsStatus === 'loading' ? (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                ) : gpsStatus === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : gpsStatus === 'error' ? (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                ) : (
                  <Navigation className="w-5 h-5 text-slate-400" />
                )}
                <div>
                  <p className="font-medium text-slate-900">GPS Location</p>
                  {location.latitude && (
                    <p className="text-xs font-mono text-slate-500">
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
              {gpsStatus !== 'success' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={getLocation}
                  data-testid="capture-gps-btn"
                >
                  <MapPin className="w-4 h-4 mr-1" />
                  Capture
                </Button>
              )}
            </div>
            {location.latitude && (
              <a
                href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-600 hover:underline mt-2 block"
              >
                📍 View on Google Maps
              </a>
            )}
          </CardContent>
        </Card>

        {/* Survey Form */}
        {!isCompleted && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                  Survey Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    Respondent Name *
                  </Label>
                  <Input
                    data-testid="respondent-name-input"
                    value={formData.respondent_name}
                    onChange={(e) => setFormData({ ...formData, respondent_name: e.target.value })}
                    className="h-12"
                    placeholder="Enter name"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    Phone Number *
                  </Label>
                  <Input
                    data-testid="respondent-phone-input"
                    type="tel"
                    value={formData.respondent_phone}
                    onChange={(e) => setFormData({ ...formData, respondent_phone: e.target.value })}
                    className="h-12"
                    placeholder="Enter phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-slate-400" />
                    House/Plot Number
                  </Label>
                  <Input
                    data-testid="house-number-input"
                    value={formData.house_number}
                    onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                    className="h-12"
                    placeholder="Enter house number"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Tax/Property Number
                  </Label>
                  <Input
                    data-testid="tax-number-input"
                    value={formData.tax_number}
                    onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                    className="h-12"
                    placeholder="Enter tax number"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea
                    data-testid="remarks-input"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Any additional notes..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Photo Upload */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                  Photo Evidence (with GPS & Timestamp)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-slate-500 bg-blue-50 p-2 rounded-lg">
                  📸 Photos will be automatically watermarked with date, time, and GPS coordinates
                </p>
                
                {/* House Photo */}
                <div>
                  <Label className="mb-2 block">House/Property Photo *</Label>
                  <input
                    ref={housePhotoRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoChange(e, 'house')}
                    className="hidden"
                    data-testid="house-photo-input"
                  />
                  <div
                    className={`photo-upload-area ${housePhotoPreview ? 'has-image p-0 overflow-hidden' : ''}`}
                    onClick={() => housePhotoRef.current?.click()}
                  >
                    {housePhotoPreview ? (
                      <img src={housePhotoPreview} alt="House" className="w-full h-40 object-cover" />
                    ) : (
                      <div className="py-6">
                        <Camera className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-slate-600">Tap to capture house photo</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Gate Photo */}
                <div>
                  <Label className="mb-2 block">Gate/Entrance Photo *</Label>
                  <input
                    ref={gatePhotoRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoChange(e, 'gate')}
                    className="hidden"
                    data-testid="gate-photo-input"
                  />
                  <div
                    className={`photo-upload-area ${gatePhotoPreview ? 'has-image p-0 overflow-hidden' : ''}`}
                    onClick={() => gatePhotoRef.current?.click()}
                  >
                    {gatePhotoPreview ? (
                      <img src={gatePhotoPreview} alt="Gate" className="w-full h-40 object-cover" />
                    ) : (
                      <div className="py-6">
                        <Camera className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-slate-600">Tap to capture gate photo</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Digital Signature */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Pen className="w-4 h-4" />
                  Property Holder Signature *
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-500">
                  Please ask the property holder to sign below
                </p>
                
                {!signatureData ? (
                  <>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg bg-white">
                      <SignatureCanvas
                        ref={signatureRef}
                        canvasProps={{
                          className: 'w-full h-40 rounded-lg',
                          style: { width: '100%', height: '160px' }
                        }}
                        backgroundColor="white"
                        penColor="black"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearSignature}
                        className="flex-1"
                        data-testid="clear-signature-btn"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveSignature}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        data-testid="save-signature-btn"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Confirm Signature
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="border-2 border-emerald-300 rounded-lg bg-emerald-50 p-2">
                      <img src={signatureData} alt="Signature" className="w-full h-32 object-contain" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Signature captured
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSignatureData(null)}
                      >
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
                  <span className="text-slate-500">Respondent</span>
                  <span className="font-medium">{submission.respondent_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone</span>
                  <span className="font-mono">{submission.respondent_phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">House No</span>
                  <span>{submission.house_number || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Submitted</span>
                  <span>{new Date(submission.submitted_at).toLocaleString()}</span>
                </div>
                {submission.remarks && (
                  <div className="pt-2 border-t">
                    <p className="text-slate-500 mb-1">Remarks</p>
                    <p>{submission.remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Photos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                  Photos
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {submission.photos?.map((photo, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={`${process.env.REACT_APP_BACKEND_URL}${photo.file_url}`}
                      alt={photo.photo_type}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded">
                      {photo.photo_type}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Signature */}
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
                      className="w-full h-24 object-contain"
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
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200">
          <div className="max-w-md mx-auto">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="mobile-action-btn"
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
        </div>
      )}
    </div>
  );
}

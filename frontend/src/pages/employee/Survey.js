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

// Function to add watermark to image with GPS, Date, Time
const addWatermarkToImage = (file, latitude, longitude) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onerror = () => reject(new Error('Failed to load image'));
      
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
            `Maps: maps.google.com`
          ];
          
          // Calculate font size based on image dimensions (responsive)
          const minDimension = Math.min(img.width, img.height);
          const fontSize = Math.max(20, Math.floor(minDimension * 0.035));
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
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
          
          // Draw yellow border
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 3;
          ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
          
          // Draw text
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          ctx.textBaseline = 'top';
          
          watermarkLines.forEach((line, index) => {
            // Highlight GPS coordinates in yellow
            if (line.startsWith('Lat:') || line.startsWith('Long:')) {
              ctx.fillStyle = '#FFD700';
            } else {
              ctx.fillStyle = '#FFFFFF';
            }
            ctx.fillText(line, boxX + padding, boxY + padding + (index * lineHeight));
          });
          
          // Add location pin icon at top-right
          const iconSize = Math.floor(fontSize * 2.5);
          const iconX = img.width - iconSize - padding;
          const iconY = padding;
          
          // Draw red circle background
          ctx.beginPath();
          ctx.arc(iconX + iconSize/2, iconY + iconSize/2, iconSize/2, 0, Math.PI * 2);
          ctx.fillStyle = '#DC2626';
          ctx.fill();
          
          // Draw white location pin
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `${iconSize * 0.6}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('📍', iconX + iconSize/2, iconY + iconSize/2);
          
          // Reset text align
          ctx.textAlign = 'left';
          
          // Convert canvas to blob
          canvas.toBlob((blob) => {
            if (blob) {
              const watermarkedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '_watermarked.jpg', { 
                type: 'image/jpeg' 
              });
              resolve(watermarkedFile);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          }, 'image/jpeg', 0.92);
          
        } catch (error) {
          console.error('Canvas error:', error);
          reject(error);
        }
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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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

    // Check if GPS is captured
    if (!location.latitude || !location.longitude) {
      toast.error('Please capture GPS location first before taking photos');
      return;
    }

    // Show loading toast
    const loadingToast = toast.loading('Adding GPS & timestamp watermark to photo...');

    try {
      // Add watermark to photo with GPS coordinates
      const watermarkedFile = await addWatermarkToImage(
        file, 
        location.latitude, 
        location.longitude
      );
      
      // Create preview from watermarked file
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
        toast.success('Photo captured with GPS, Date & Time watermark!');
      };
      reader.readAsDataURL(watermarkedFile);
      
    } catch (error) {
      console.error('Watermark error:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to process photo. Please try again.');
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

        {/* GPS Status - MUST CAPTURE FIRST */}
        <Card className={`${
          gpsStatus === 'success' ? 'border-emerald-200 bg-emerald-50' :
          gpsStatus === 'error' ? 'border-red-200 bg-red-50' :
          'border-amber-200 bg-amber-50'
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
                  <Navigation className="w-5 h-5 text-amber-600" />
                )}
                <div>
                  <p className="font-medium text-slate-900">
                    {gpsStatus === 'success' ? 'GPS Captured ✓' : 'Step 1: Capture GPS First'}
                  </p>
                  {location.latitude ? (
                    <p className="text-xs font-mono text-slate-500">
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">Required before taking photos</p>
                  )}
                </div>
              </div>
              <Button
                variant={gpsStatus === 'success' ? 'outline' : 'default'}
                size="sm"
                onClick={getLocation}
                data-testid="capture-gps-btn"
                className={gpsStatus !== 'success' ? 'bg-amber-600 hover:bg-amber-700' : ''}
              >
                <MapPin className="w-4 h-4 mr-1" />
                {gpsStatus === 'success' ? 'Recapture' : 'Capture GPS'}
              </Button>
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
                  Step 2: Photo Evidence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Photos will show GPS, Date & Time watermark
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Make sure GPS is captured before taking photos
                  </p>
                </div>
                
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
                    onClick={() => {
                      if (!location.latitude) {
                        toast.error('Please capture GPS location first!');
                        return;
                      }
                      housePhotoRef.current?.click();
                    }}
                  >
                    {housePhotoPreview ? (
                      <img src={housePhotoPreview} alt="House" className="w-full h-48 object-cover" />
                    ) : (
                      <div className="py-6">
                        <Camera className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-slate-600">Tap to capture house photo</p>
                        <p className="text-xs text-slate-400 mt-1">GPS watermark will be added</p>
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
                    onClick={() => {
                      if (!location.latitude) {
                        toast.error('Please capture GPS location first!');
                        return;
                      }
                      gatePhotoRef.current?.click();
                    }}
                  >
                    {gatePhotoPreview ? (
                      <img src={gatePhotoPreview} alt="Gate" className="w-full h-48 object-cover" />
                    ) : (
                      <div className="py-6">
                        <Camera className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-slate-600">Tap to capture gate photo</p>
                        <p className="text-xs text-slate-400 mt-1">GPS watermark will be added</p>
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
                  Step 3: Property Holder Signature *
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
                  <span className="text-slate-500">GPS</span>
                  <span className="font-mono text-xs">{submission.latitude?.toFixed(6)}, {submission.longitude?.toFixed(6)}</span>
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
                  Photos (with GPS & Timestamp)
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

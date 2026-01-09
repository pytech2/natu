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
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'leaflet/dist/leaflet.css';
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
  Building,
  Download,
  Map
} from 'lucide-react';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Function to add watermark to image with GPS, Date, Time
const addWatermarkToImage = (file, latitude, longitude) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          canvas.width = img.width;
          canvas.height = img.height;
          
          ctx.drawImage(img, 0, 0, img.width, img.height);
          
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
          
          const watermarkText = `GPS: ${latitude?.toFixed(6)}, ${longitude?.toFixed(6)} | ${dateStr} ${timeStr}`;
          
          const fontSize = Math.max(20, Math.min(img.width, img.height) * 0.025);
          ctx.font = `bold ${fontSize}px Arial`;
          
          const textWidth = ctx.measureText(watermarkText).width;
          const padding = 15;
          const x = img.width - textWidth - padding;
          const y = img.height - padding;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(x - 10, y - fontSize - 5, textWidth + 20, fontSize + 15);
          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(watermarkText, x, y);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const watermarkedFile = new File([blob], file.name, { type: 'image/jpeg' });
              resolve(watermarkedFile);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.9);
        } catch (err) {
          resolve(file);
        }
      };
      
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

// Convert dataURL to Blob
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

const RELATION_OPTIONS = [
  'Self',
  'Family Member',
  'Tenant',
  'Neighbour',
  'Other'
];

// Calculate distance between two GPS coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
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
  const [processingPhoto, setProcessingPhoto] = useState(null);

  // GPS State
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [location, setLocation] = useState({ latitude: null, longitude: null });

  // Form State - Simplified as per requirements
  const [formData, setFormData] = useState({
    receiver_name: '',
    receiver_mobile: '',  // NEW: Receiver mobile with 10-digit validation
    relation: '',
    correct_colony_name: '', // NEW: Correct colony name field
    remarks: '',
    self_satisfied: ''
  });
  
  // 50m radius check
  const [withinRange, setWithinRange] = useState(null);
  const [distanceFromProperty, setDistanceFromProperty] = useState(null);

  // Photo State - Only house photo now
  const [housePhoto, setHousePhoto] = useState(null);
  const [housePhotoPreview, setHousePhotoPreview] = useState(null);

  // Signature State
  const signatureRef = useRef(null);
  const [signatureData, setSignatureData] = useState(null);

  // File input refs
  const houseCameraRef = useRef(null);
  const houseGalleryRef = useRef(null);
  const mapContainerRef = useRef(null);

  // PDF download state
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchProperty();
    getLocation();
  }, [propertyId]);

  useEffect(() => {
    if (location.latitude && location.longitude && property?.latitude && property?.longitude) {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        property.latitude,
        property.longitude
      );
      setDistanceFromProperty(Math.round(distance));
      setWithinRange(distance <= 50);
    }
  }, [location, property]);

  const fetchProperty = async () => {
    try {
      const response = await axios.get(`${API_URL}/employee/property/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProperty(response.data.property);
      setSubmission(response.data.submission);

      if (response.data.submission) {
        const sub = response.data.submission;
        setFormData({
          receiver_name: sub.receiver_name || '',
          receiver_mobile: sub.receiver_mobile || '',
          relation: sub.relation || '',
          correct_colony_name: sub.correct_colony_name || '',
          remarks: sub.remarks || '',
          self_satisfied: sub.self_satisfied || ''
        });
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

  const handlePhotoCapture = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingPhoto(type);

    try {
      if (location.latitude && location.longitude) {
        const watermarkedFile = await addWatermarkToImage(file, location.latitude, location.longitude);
        if (type === 'house') {
          setHousePhoto(watermarkedFile);
          const previewUrl = URL.createObjectURL(watermarkedFile);
          setHousePhotoPreview(previewUrl);
        }
        toast.success('Photo captured with GPS & timestamp watermark!');
      } else {
        if (type === 'house') {
          setHousePhoto(file);
          setHousePhotoPreview(URL.createObjectURL(file));
        }
        toast.warning('Photo captured (no GPS watermark - location not available)');
      }
    } catch (error) {
      toast.error('Error processing photo');
    } finally {
      setProcessingPhoto(null);
    }
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
    setSignatureData(null);
  };

  const saveSignature = () => {
    if (signatureRef.current?.isEmpty()) {
      toast.error('Please provide a signature');
      return;
    }
    const data = signatureRef.current.toDataURL('image/png');
    setSignatureData(data);
    toast.success('Signature saved!');
  };

  const validateMobile = (mobile) => {
    return /^\d{10}$/.test(mobile);
  };

  const handleSubmit = async () => {
    // Validations
    if (withinRange === false) {
      toast.error('You must be within 50 meters of the property to submit');
      return;
    }

    if (!formData.receiver_name || !formData.relation) {
      toast.error('Receiver name and relation are required');
      return;
    }

    if (!formData.receiver_mobile || !validateMobile(formData.receiver_mobile)) {
      toast.error('Please enter a valid 10-digit receiver mobile number');
      return;
    }

    if (!formData.self_satisfied) {
      toast.error('Please select if notice receiver is satisfied');
      return;
    }

    if (!housePhoto) {
      toast.error('Property photo is required');
      return;
    }

    if (!signatureData) {
      toast.error('Property holder signature is required');
      return;
    }

    setSubmitting(true);

    try {
      const formDataObj = new FormData();
      formDataObj.append('receiver_name', formData.receiver_name);
      formDataObj.append('receiver_mobile', formData.receiver_mobile);
      formDataObj.append('relation', formData.relation);
      formDataObj.append('correct_colony_name', formData.correct_colony_name || '');
      formDataObj.append('remarks', formData.remarks || '');
      formDataObj.append('self_satisfied', formData.self_satisfied);
      formDataObj.append('latitude', location.latitude);
      formDataObj.append('longitude', location.longitude);
      formDataObj.append('house_photo', housePhoto);
      
      // Create a dummy gate photo from house photo (backend still expects it)
      formDataObj.append('gate_photo', housePhoto);
      
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

  // Download property map as PDF
  const handleDownloadMapPdf = async () => {
    if (!mapContainerRef.current) {
      toast.error('Map not ready');
      return;
    }

    setDownloadingPdf(true);
    try {
      // Wait a moment for map to fully render
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Add title
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Property Location Map', 105, 15, { align: 'center' });
      
      // Add property details
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      let yPos = 25;
      
      pdf.text(`Property ID: ${property?.property_id || '-'}`, 15, yPos);
      yPos += 6;
      pdf.text(`Owner: ${property?.owner_name || '-'}`, 15, yPos);
      yPos += 6;
      pdf.text(`Mobile: ${property?.mobile || '-'}`, 15, yPos);
      yPos += 6;
      pdf.text(`Colony: ${property?.colony || property?.ward || '-'}`, 15, yPos);
      yPos += 6;
      pdf.text(`Address: ${property?.address || '-'}`, 15, yPos);
      yPos += 6;
      pdf.text(`GPS: ${property?.latitude?.toFixed(6)}, ${property?.longitude?.toFixed(6)}`, 15, yPos);
      yPos += 6;
      pdf.text(`Amount: ₹${property?.amount || '0'}`, 15, yPos);
      yPos += 10;

      // Add map image
      const imgWidth = 180;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 15, yPos, imgWidth, imgHeight);

      // Add footer with date
      const now = new Date();
      pdf.setFontSize(8);
      pdf.text(`Generated on: ${now.toLocaleString('en-IN')}`, 15, 285);
      pdf.text('NSTU INDIA PRIVATE LIMITED', 195, 285, { align: 'right' });

      // Save PDF
      pdf.save(`property_map_${property?.property_id || 'unknown'}.pdf`);
      toast.success('Map PDF downloaded!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloadingPdf(false);
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
        {/* Property Info Card - Shows all required fields */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
              Property Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 text-xs">Property ID</span>
                <p className="font-mono font-medium">{property?.property_id}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Owner</span>
                <p className="font-medium">{property?.owner_name || '-'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Mobile</span>
                <p className="font-mono">{property?.mobile || '-'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Colony</span>
                <p className="font-medium">{property?.colony || property?.ward || '-'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Category</span>
                <p className="font-medium">{property?.category || '-'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Total Area</span>
                <p className="font-medium">{property?.total_area || '-'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Total Amount</span>
                <p className="font-medium text-red-600">₹{property?.amount || '0'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">Address</span>
                <p className="font-medium text-xs">{property?.address || '-'}</p>
              </div>
            </div>
            {property?.latitude && property?.longitude && (
              <div className="pt-2 border-t">
                <span className="text-slate-500 text-xs">GPS Coordinates</span>
                <p className="font-mono text-xs">{property?.latitude?.toFixed(6)}, {property?.longitude?.toFixed(6)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Property Location Map */}
        {property?.latitude && property?.longitude && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Map className="w-4 h-4" />
                  Property Location Map
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadMapPdf}
                  disabled={downloadingPdf}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  {downloadingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1" />
                      Download PDF
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div ref={mapContainerRef} className="rounded-lg overflow-hidden border border-slate-200">
                <MapContainer
                  center={[property.latitude, property.longitude]}
                  zoom={17}
                  minZoom={5}
                  maxZoom={19}
                  maxBounds={[[-85, -180], [85, 180]]}
                  maxBoundsViscosity={1.0}
                  style={{ height: '250px', width: '100%' }}
                  scrollWheelZoom={false}
                  dragging={true}
                  touchZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[property.latitude, property.longitude]}>
                    <Popup>
                      <div className="text-xs">
                        <p className="font-bold">{property.property_id}</p>
                        <p>{property.owner_name}</p>
                        <p className="text-slate-500">{property.colony || property.ward}</p>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                Tap the marker for property details • Pinch to zoom
              </p>
            </CardContent>
          </Card>
        )}

        {/* GPS Status */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  gpsStatus === 'success' ? 'bg-emerald-100' :
                  gpsStatus === 'error' ? 'bg-red-100' : 'bg-slate-100'
                }`}>
                  <MapPin className={`w-5 h-5 ${
                    gpsStatus === 'success' ? 'text-emerald-600' :
                    gpsStatus === 'error' ? 'text-red-600' : 'text-slate-500'
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {gpsStatus === 'loading' ? 'Getting location...' :
                     gpsStatus === 'success' ? 'Location captured' :
                     gpsStatus === 'error' ? 'Location failed' : 'GPS Status'}
                  </p>
                  {gpsStatus === 'success' && (
                    <p className="text-xs text-slate-500 font-mono">
                      {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={getLocation} disabled={gpsStatus === 'loading'}>
                <Navigation className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>

            {/* Distance Check */}
            {property?.latitude && property?.longitude && distanceFromProperty !== null && (
              <div className={`mt-3 p-3 rounded-lg ${withinRange ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <div className="flex items-center gap-2">
                  {withinRange ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${withinRange ? 'text-emerald-700' : 'text-red-700'}`}>
                      {withinRange ? 'Within range' : 'Out of range'} - {distanceFromProperty}m from property
                    </p>
                    <p className="text-xs text-slate-600">
                      {withinRange ? 'You can submit the survey' : 'Move closer to the property (within 50m)'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!isCompleted && (
          <>
            {/* Notice Receiver Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Notice Receiver Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Receiver Name *</Label>
                  <Input
                    value={formData.receiver_name}
                    onChange={(e) => setFormData({ ...formData, receiver_name: e.target.value })}
                    placeholder="Name of person receiving notice"
                    data-testid="receiver-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Receiver Mobile Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={formData.receiver_mobile}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData({ ...formData, receiver_mobile: value });
                      }}
                      placeholder="10-digit mobile number"
                      className="pl-10"
                      maxLength={10}
                      data-testid="receiver-mobile-input"
                    />
                  </div>
                  {formData.receiver_mobile && !validateMobile(formData.receiver_mobile) && (
                    <p className="text-xs text-red-500">Please enter a valid 10-digit mobile number</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Relation with Owner *</Label>
                  <Select
                    value={formData.relation}
                    onValueChange={(value) => setFormData({ ...formData, relation: value })}
                  >
                    <SelectTrigger data-testid="relation-select">
                      <SelectValue placeholder="Select relation" />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Correct Colony Name (if different)</Label>
                  <Input
                    value={formData.correct_colony_name}
                    onChange={(e) => setFormData({ ...formData, correct_colony_name: e.target.value })}
                    placeholder="Enter correct colony name if different from records"
                    data-testid="correct-colony-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Self Satisfied? *</Label>
                  <Select
                    value={formData.self_satisfied}
                    onValueChange={(value) => setFormData({ ...formData, self_satisfied: value })}
                  >
                    <SelectTrigger data-testid="self-satisfied-select">
                      <SelectValue placeholder="Is the notice receiver satisfied?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes - Satisfied</SelectItem>
                      <SelectItem value="no">No - Not Satisfied</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Any additional comments..."
                    rows={2}
                    data-testid="remarks-input"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Property Photo */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Property Photo *
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  ref={houseCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handlePhotoCapture(e, 'house')}
                />
                <input
                  ref={houseGalleryRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhotoCapture(e, 'house')}
                />

                {housePhotoPreview ? (
                  <div className="relative">
                    <img
                      src={housePhotoPreview}
                      alt="Property"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setHousePhoto(null);
                        setHousePhotoPreview(null);
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Retake
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 h-24"
                      onClick={() => houseCameraRef.current?.click()}
                      disabled={processingPhoto === 'house'}
                    >
                      {processingPhoto === 'house' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-5 h-5 mr-2" />
                          Take Photo
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-24"
                      onClick={() => houseGalleryRef.current?.click()}
                      disabled={processingPhoto === 'house'}
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Gallery
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Signature */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Pen className="w-4 h-4" />
                  Signature of Notice Receiver *
                </CardTitle>
              </CardHeader>
              <CardContent>
                {signatureData ? (
                  <div className="relative">
                    <img src={signatureData} alt="Signature" className="w-full h-32 border rounded-lg bg-white" />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={clearSignature}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white">
                      <SignatureCanvas
                        ref={signatureRef}
                        canvasProps={{
                          className: 'w-full h-32',
                          style: { width: '100%', height: '128px' }
                        }}
                        backgroundColor="white"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" onClick={clearSignature}>
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Clear
                      </Button>
                      <Button size="sm" onClick={saveSignature} className="bg-slate-900">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Save Signature
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Completed Submission View */}
        {isCompleted && submission && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-emerald-600">
                <CheckCircle className="w-4 h-4" />
                Survey Completed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-500 text-xs">Receiver</p>
                  <p className="font-medium">{submission.receiver_name}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Receiver Mobile</p>
                  <p className="font-mono">{submission.receiver_mobile || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Relation</p>
                  <p className="font-medium">{submission.relation}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Satisfied</p>
                  <p className="font-medium">{submission.self_satisfied === 'yes' ? 'Yes' : 'No'}</p>
                </div>
              </div>
              {submission.correct_colony_name && (
                <div>
                  <p className="text-slate-500 text-xs">Corrected Colony</p>
                  <p className="font-medium">{submission.correct_colony_name}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500 text-xs">Submitted At</p>
                <p className="font-medium">{new Date(submission.submitted_at).toLocaleString('en-IN')}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Submit Button */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12"
            onClick={handleSubmit}
            disabled={submitting || withinRange === false}
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

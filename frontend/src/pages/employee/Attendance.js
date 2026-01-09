import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Camera,
  CheckCircle,
  MapPin,
  Loader2,
  ArrowLeft,
  Clock,
  CalendarCheck,
  User,
  AlertTriangle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function Attendance() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasAttendance, setHasAttendance] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  
  // GPS State
  const [gpsStatus, setGpsStatus] = useState('idle');
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  
  // Selfie State
  const [selfie, setSelfie] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [capturing, setCapturing] = useState(false);
  
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    checkTodayAttendance();
  }, []);

  const checkTodayAttendance = async () => {
    try {
      const response = await axios.get(`${API_URL}/employee/attendance/today`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHasAttendance(response.data.has_attendance);
      setAttendanceData(response.data.attendance);
    } catch (error) {
      console.error('Failed to check attendance:', error);
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

  const startCamera = async () => {
    try {
      setCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast.error('Failed to access camera. Please grant camera permissions.');
      setCapturing(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      setSelfie(file);
      setSelfiePreview(URL.createObjectURL(blob));
      stopCamera();
      toast.success('Selfie captured!');
    }, 'image/jpeg', 0.9);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCapturing(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelfie(file);
      setSelfiePreview(URL.createObjectURL(file));
      toast.success('Selfie uploaded!');
    }
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!location.latitude || !location.longitude) {
      toast.error('Please capture GPS location first');
      return;
    }
    if (!selfie) {
      toast.error('Please take a selfie');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('selfie', selfie);
      formData.append('latitude', location.latitude);
      formData.append('longitude', location.longitude);
      formData.append('authorization', `Bearer ${token}`);

      await axios.post(`${API_URL}/employee/attendance`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Attendance marked successfully!');
      // Redirect to property map after attendance
      navigate('/employee/property-map');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const retakeSelfie = () => {
    setSelfie(null);
    setSelfiePreview(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="flex items-center px-4 h-14">
          <button
            onClick={() => navigate('/employee')}
            className="mr-3 text-slate-500"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-heading font-semibold text-slate-900">Daily Attendance</h1>
            <p className="text-xs text-slate-500">{today}</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4" data-testid="attendance-page">
        {hasAttendance ? (
          // Already marked attendance
          <div className="space-y-4">
            <Card className="border-emerald-300 bg-emerald-50">
              <CardContent className="py-8 text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-emerald-800 mb-2">Attendance Marked!</h2>
                <p className="text-emerald-600">You have already marked your attendance for today.</p>
              </CardContent>
            </Card>

            {attendanceData && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                    Today&apos;s Attendance Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    {attendanceData.selfie_url && (
                      <img
                        src={`${process.env.REACT_APP_BACKEND_URL}${attendanceData.selfie_url}`}
                        alt="Attendance Selfie"
                        className="w-24 h-24 rounded-lg object-cover border-2 border-emerald-200"
                      />
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600">Marked at:</span>
                        <span className="font-medium">
                          {new Date(attendanceData.marked_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="font-mono text-xs text-slate-600">
                          {attendanceData.latitude?.toFixed(6)}, {attendanceData.longitude?.toFixed(6)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate('/employee/property-map')}
            >
              View Properties Map
            </Button>
          </div>
        ) : (
          // Mark attendance
          <div className="space-y-4">
            {/* User Info */}
            <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-blue-100 text-sm">Good Morning,</p>
                    <p className="text-xl font-bold">{user?.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-800">Mark Your Attendance</p>
                    <p className="text-sm text-amber-700">
                      Take a selfie to mark your morning attendance. This is required once per day before starting surveys.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* GPS Capture */}
            <Card className={`${
              gpsStatus === 'success' ? 'border-emerald-300 bg-emerald-50' :
              gpsStatus === 'error' ? 'border-red-300 bg-red-50' :
              'border-slate-200'
            }`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {gpsStatus === 'loading' ? (
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    ) : gpsStatus === 'success' ? (
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <MapPin className="w-6 h-6 text-slate-400" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-900">
                        {gpsStatus === 'success' ? '✓ Location Captured' : 'Step 1: Capture Location'}
                      </p>
                      {location.latitude ? (
                        <p className="text-xs font-mono text-slate-600">
                          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">Required for attendance</p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={getLocation}
                    className={gpsStatus === 'success' ? 'bg-emerald-600' : 'bg-blue-600'}
                    data-testid="capture-gps-btn"
                  >
                    <MapPin className="w-4 h-4 mr-1" />
                    {gpsStatus === 'success' ? 'Recapture' : 'Capture'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Selfie Capture */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono uppercase tracking-wider text-slate-500">
                  Step 2: Take a Selfie
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Hidden file input */}
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {capturing ? (
                  <div className="space-y-3">
                    <div className="relative rounded-lg overflow-hidden bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-64 object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700"
                        onClick={capturePhoto}
                      >
                        <Camera className="w-5 h-5 mr-2" />
                        Capture
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-12"
                        onClick={stopCamera}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : selfiePreview ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <img
                        src={selfiePreview}
                        alt="Selfie"
                        className="w-full h-64 object-cover rounded-lg border-2 border-emerald-200"
                      />
                      <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500 text-white text-xs font-bold rounded">
                        ✓ Selfie Ready
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full h-12"
                      onClick={retakeSelfie}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Retake Selfie
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="h-48 flex flex-col items-center justify-center bg-slate-100 rounded-lg border-2 border-dashed border-slate-300">
                      <Camera className="w-12 h-12 text-slate-300 mb-2" />
                      <p className="text-slate-500 text-sm">Take a selfie for attendance</p>
                    </div>
                    <Button
                      className="w-full h-14 bg-blue-600 hover:bg-blue-700"
                      onClick={startCamera}
                      disabled={!location.latitude}
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Take Selfie
                    </Button>
                    {!location.latitude && (
                      <p className="text-center text-amber-600 text-sm">
                        Please capture GPS location first
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Submit Button */}
      {!hasAttendance && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-lg">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !location.latitude || !selfie}
            className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400"
            data-testid="submit-attendance-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CalendarCheck className="w-5 h-5 mr-2" />
                Mark Attendance
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

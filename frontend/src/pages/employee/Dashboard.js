import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import EmployeeLayout from '../../components/EmployeeLayout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckCircle, Clock, AlertTriangle, ArrowRight, FileSpreadsheet } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export default function EmployeeDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const response = await axios.get(`${API_URL}/employee/progress`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProgress(response.data);
    } catch (error) {
      toast.error('Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  const percentage = progress?.total_assigned > 0
    ? Math.round((progress.completed / progress.total_assigned) * 100)
    : 0;

  if (loading) {
    return (
      <EmployeeLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse-slow text-slate-500">Loading...</div>
        </div>
      </EmployeeLayout>
    );
  }

  return (
    <EmployeeLayout title="Dashboard">
      <div data-testid="employee-dashboard" className="space-y-6">
        {/* Welcome */}
        <div className="text-center py-4">
          <h2 className="text-xl font-heading font-bold text-slate-900">
            Welcome, {user?.name}!
          </h2>
          <p className="text-slate-500 mt-1">Ready for today's surveys?</p>
        </div>

        {/* Progress Card */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-300">Today's Progress</p>
                <p className="text-3xl font-heading font-bold mt-1">
                  {progress?.completed || 0} / {progress?.total_assigned || 0}
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-heading font-bold text-blue-400">{percentage}%</p>
                <p className="text-sm text-slate-300">Complete</p>
              </div>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center py-4">
            <CardContent className="p-0">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-2xl font-heading font-bold text-slate-900">{progress?.pending || 0}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Pending</p>
            </CardContent>
          </Card>

          <Card className="text-center py-4">
            <CardContent className="p-0">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-2xl font-heading font-bold text-slate-900">{progress?.completed || 0}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Done</p>
            </CardContent>
          </Card>

          <Card className="text-center py-4">
            <CardContent className="p-0">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-2xl font-heading font-bold text-slate-900">{progress?.flagged || 0}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Flagged</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => navigate('/employee/properties')}
            className="mobile-action-btn"
            data-testid="view-properties-btn"
          >
            <FileSpreadsheet className="w-5 h-5 mr-2" />
            View Assigned Properties
            <ArrowRight className="w-5 h-5 ml-auto" />
          </Button>

          {progress?.pending > 0 && (
            <p className="text-center text-sm text-slate-500">
              You have {progress.pending} properties pending survey
            </p>
          )}
        </div>

        {/* Tips */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <h4 className="font-semibold text-blue-900 mb-2">Survey Tips</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Enable GPS on your device before starting</li>
              <li>• Take clear photos of gate and property</li>
              <li>• Verify owner details before submitting</li>
              <li>• Flag properties if owner is unavailable</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </EmployeeLayout>
  );
}

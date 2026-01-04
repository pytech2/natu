import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  FileSpreadsheet,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  FolderOpen
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const COLORS = ['#059669', '#f59e0b', '#3b82f6', '#ef4444'];

export default function Dashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [employeeProgress, setEmployeeProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, progressRes] = await Promise.all([
        axios.get(`${API_URL}/admin/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/admin/employee-progress`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setStats(statsRes.data);
      setEmployeeProgress(progressRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const pieData = stats ? [
    { name: 'Completed', value: stats.completed },
    { name: 'Pending', value: stats.pending },
    { name: 'In Progress', value: stats.in_progress },
    { name: 'Flagged', value: stats.flagged }
  ].filter(d => d.value > 0) : [];

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse-slow text-slate-500">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      <div data-testid="admin-dashboard" className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Total Properties</p>
                <p className="text-2xl font-bold font-heading text-slate-900">{stats?.total_properties || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Completed</p>
                <p className="text-2xl font-bold font-heading text-emerald-600">{stats?.completed || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Pending</p>
                <p className="text-2xl font-bold font-heading text-amber-600">{stats?.pending || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Flagged</p>
                <p className="text-2xl font-bold font-heading text-red-600">{stats?.flagged || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Employees</p>
                <p className="text-2xl font-bold font-heading text-blue-600">{stats?.employees || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FolderOpen className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Batches</p>
                <p className="text-2xl font-bold font-heading text-purple-600">{stats?.batches || 0}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Employee Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Employee Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {employeeProgress.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={employeeProgress} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" />
                    <YAxis 
                      type="category" 
                      dataKey="employee_name" 
                      stroke="#64748b"
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="completed" fill="#059669" name="Completed" />
                    <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  No employee data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity / Progress Overview */}
        {employeeProgress.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Employee Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {employeeProgress.map((emp) => {
                  const percentage = emp.total_assigned > 0 
                    ? Math.round((emp.completed / emp.total_assigned) * 100) 
                    : 0;
                  return (
                    <div key={emp.employee_id} className="flex items-center gap-4">
                      <div className="w-32 truncate">
                        <p className="font-medium text-slate-900">{emp.employee_name}</p>
                        <p className="text-xs text-slate-500">{emp.completed}/{emp.total_assigned} completed</p>
                      </div>
                      <div className="flex-1">
                        <div className="progress-bar">
                          <div 
                            className="progress-bar-fill" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-12 text-right">
                        <span className="font-mono font-medium text-slate-700">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

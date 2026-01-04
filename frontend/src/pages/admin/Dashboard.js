import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
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
  FolderOpen,
  CalendarCheck,
  MapPin,
  TrendingUp,
  XCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const COLORS = ['#059669', '#f59e0b', '#3b82f6', '#ef4444'];

const ROLE_LABELS = {
  'SURVEYOR': 'Surveyor',
  'SUPERVISOR': 'Supervisor',
  'MC_OFFICER': 'MC Officer',
  'EMPLOYEE': 'Surveyor'  // Backward compatibility - old employees show as Surveyor
};

export default function Dashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
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
    { name: 'Rejected', value: stats.rejected }
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
        {/* Today's Stats - Highlighted */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <CalendarCheck className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Today Completed Properties</p>
                  <p className="text-4xl font-heading font-bold">{stats?.today_completed || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <MapPin className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-blue-100 text-sm font-medium">Today Completed Wards</p>
                  <p className="text-4xl font-heading font-bold">{stats?.today_wards || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Total</p>
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
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Rejected</p>
                <p className="text-2xl font-bold font-heading text-red-600">{stats?.rejected || 0}</p>
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

        {/* Employee Progress Report - Clickable */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Employee Progress Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employeeProgress.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role</th>
                      <th className="text-center">Today Done</th>
                      <th className="text-center">Overall Done</th>
                      <th className="text-center">Pending</th>
                      <th>Progress</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeProgress.map((emp) => {
                      const percentage = emp.total_assigned > 0 
                        ? Math.round((emp.completed / emp.total_assigned) * 100) 
                        : 0;
                      return (
                        <tr key={emp.employee_id} className="cursor-pointer hover:bg-slate-50">
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-bold">{emp.employee_name?.charAt(0)}</span>
                              </div>
                              <span className="font-medium">{emp.employee_name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                              {ROLE_LABELS[emp.role] || emp.role}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                              {emp.today_completed}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold">
                              {emp.overall_completed}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-bold">
                              {emp.pending}
                            </span>
                          </td>
                          <td className="w-32">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 progress-bar">
                                <div 
                                  className="progress-bar-fill" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-slate-600">{percentage}%</span>
                            </div>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/admin/submissions?employee_id=${emp.employee_id}`)}
                            >
                              View All
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                No employee data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Employee Progress Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Employee Performance</CardTitle>
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
                    <Bar dataKey="today_completed" fill="#059669" name="Today" />
                    <Bar dataKey="overall_completed" fill="#3b82f6" name="Overall" />
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
      </div>
    </AdminLayout>
  );
}

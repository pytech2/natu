import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminEmployees from "./pages/admin/Employees";
import AdminProperties from "./pages/admin/Properties";
import AdminUpload from "./pages/admin/Upload";
import AdminSubmissions from "./pages/admin/Submissions";
import AdminExport from "./pages/admin/Export";
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeProperties from "./pages/employee/Properties";
import EmployeeSurvey from "./pages/employee/Survey";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "@/App.css";

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse-slow text-slate-600">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/employee'} replace />;
  }
  
  return children;
}

// All non-admin roles that can access employee/surveyor routes
const SURVEYOR_ROLES = ['EMPLOYEE', 'SURVEYOR', 'SUPERVISOR', 'MC_OFFICER'];

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/employees" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <AdminEmployees />
        </ProtectedRoute>
      } />
      <Route path="/admin/properties" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <AdminProperties />
        </ProtectedRoute>
      } />
      <Route path="/admin/upload" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <AdminUpload />
        </ProtectedRoute>
      } />
      <Route path="/admin/submissions" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <AdminSubmissions />
        </ProtectedRoute>
      } />
      <Route path="/admin/export" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <AdminExport />
        </ProtectedRoute>
      } />
      
      {/* Employee/Surveyor Routes */}
      <Route path="/employee" element={
        <ProtectedRoute allowedRoles={SURVEYOR_ROLES}>
          <EmployeeDashboard />
        </ProtectedRoute>
      } />
      <Route path="/employee/properties" element={
        <ProtectedRoute allowedRoles={SURVEYOR_ROLES}>
          <EmployeeProperties />
        </ProtectedRoute>
      } />
      <Route path="/employee/survey/:propertyId" element={
        <ProtectedRoute allowedRoles={SURVEYOR_ROLES}>
          <EmployeeSurvey />
        </ProtectedRoute>
      } />
      
      {/* Default redirect */}
      <Route path="/" element={
        user ? (
          <Navigate to={user.role === 'ADMIN' ? '/admin' : '/employee'} replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

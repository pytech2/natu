import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Upload,
  ClipboardCheck,
  Download,
  LogOut,
  Menu,
  X,
  Map
} from 'lucide-react';
import { Button } from './ui/button';

// Full navigation for ADMIN and SUPERVISOR
const fullNavItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/employees', icon: Users, label: 'Employees' },
  { path: '/admin/upload', icon: Upload, label: 'Upload Data' },
  { path: '/admin/properties', icon: FileSpreadsheet, label: 'Properties' },
  { path: '/admin/map', icon: Map, label: 'Property Map' },
  { path: '/admin/submissions', icon: ClipboardCheck, label: 'Submissions' },
  { path: '/admin/export', icon: Download, label: 'Export' },
];

// Limited navigation for MC_OFFICER (view-only)
const mcOfficerNavItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/properties', icon: FileSpreadsheet, label: 'Properties' },
  { path: '/admin/map', icon: Map, label: 'Property Map' },
  { path: '/admin/submissions', icon: ClipboardCheck, label: 'Submissions' },
];

const ROLE_DISPLAY = {
  'ADMIN': 'Super Admin',
  'SUPERVISOR': 'Supervisor',
  'MC_OFFICER': 'MC Officer'
};

export default function AdminLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Determine which nav items to show based on role
  const navItems = user?.role === 'MC_OFFICER' ? mcOfficerNavItems : fullNavItems;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <img 
              src="/nstu-logo.png" 
              alt="NSTU India Private Limited" 
              className="w-20 h-20 object-contain rounded-lg bg-white p-1"
            />
            <div>
              <h1 className="font-heading font-bold text-white text-sm">NSTU India Private Limited</h1>
              <p className="text-xs text-slate-400">Property Tax Manager</p>
            </div>
          </div>
        </div>

        <nav className="mt-4 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {user?.name?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400">{ROLE_DISPLAY[user?.role] || user?.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={handleLogout}
            data-testid="admin-logout-btn"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-30">
        <div className="flex items-center justify-between px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="mobile-menu-btn"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <h1 className="font-heading font-bold text-slate-900">{title}</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="main-with-sidebar pt-14 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-6 hidden lg:block">
            {title}
          </h1>
          {children}
        </div>
      </main>
    </div>
  );
}

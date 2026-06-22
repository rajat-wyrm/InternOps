import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/auth';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  TrendingUp,
  LogOut,
  User,
} from 'lucide-react';

const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Tasks', path: '/tasks', icon: CheckSquare },
    { name: 'Attendance', path: '/attendance', icon: Calendar },
    { name: 'Performance', path: '/ratings', icon: TrendingUp },
  ];

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-dark flex flex-col shadow-xl border-r border-gray-800 shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-brand-green">
            InternOps
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-green/10 text-brand-green shadow-sm border border-brand-green/20'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Navbar */}
        <header className="h-20 shrink-0 flex items-center justify-between px-8 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 z-10 sticky top-0">
          <div className="flex items-center">
            <h2 className="text-xl font-semibold text-gray-200 tracking-tight">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}
            </h2>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-brand-orange/20 flex items-center justify-center text-brand-orange">
                <User className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200 leading-tight">
                  {user?.name || 'Guest User'}
                </span>
                <span className="text-xs text-brand-green font-medium leading-tight mt-0.5">
                  {user?.role || 'Intern'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-400 hover:text-red-400 transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-red-400/10"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm hidden sm:inline-block">
                Logout
              </span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-900 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

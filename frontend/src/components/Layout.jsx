import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { 
  Globe, 
  LayoutDashboard, 
  Layers, 
  Settings, 
  Activity, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/presets", icon: Layers, label: "DNS Presets" },
  { to: "/activity-logs", icon: Activity, label: "Activity Logs" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-accent" strokeWidth={1.5} />
            <span className="font-heading font-bold text-lg">DNS Manager</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="mobile-menu-btn"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside 
          className={`
            fixed inset-y-0 left-0 z-30 w-64 bg-slate-50 border-r transform transition-transform duration-200 ease-in-out
            lg:translate-x-0 lg:static lg:inset-auto
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="hidden lg:flex items-center gap-2 px-6 py-5 border-b">
              <Globe className="h-7 w-7 text-accent" strokeWidth={1.5} />
              <span className="font-heading font-bold text-xl tracking-tight">DNS Manager</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 mt-14 lg:mt-0">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`
                  }
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <item.icon className="h-5 w-5" strokeWidth={1.5} />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* User Section */}
            <div className="p-3 border-t">
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-sm">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.username}</p>
                  <p className="text-xs text-muted-foreground">Administrator</p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground hover:text-destructive"
                onClick={handleLogout}
                data-testid="logout-btn"
              >
                <LogOut className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Logout
              </Button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen lg:min-h-[calc(100vh)]">
          <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

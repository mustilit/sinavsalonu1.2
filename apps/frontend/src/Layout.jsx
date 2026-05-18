import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_PAGES } from "@/lib/routeRoles";

const SIDEBAR_COLLAPSE_KEY = "sidebar:collapsed";

export default function Layout({ children, currentPageName }) {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage?.getItem(SIDEBAR_COLLAPSE_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage?.setItem(SIDEBAR_COLLAPSE_KEY, desktopCollapsed ? "1" : "0");
  }, [desktopCollapsed]);

  const path = (location.pathname || "").replace(/\/+$/, "") || "/";
  const isAuthPage = AUTH_PAGES.includes(currentPageName) ||
    /^\/login$/i.test(path) || /^\/register$/i.test(path);
  const isFullScreen = currentPageName === "TakeTest";

  // Login/Register: sadece içerik, sidebar yok
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        {children}
      </div>
    );
  }

  // Tam ekran (TakeTest vb.): sidebar yok, padding var
  if (isFullScreen) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
        <div className="p-4 lg:p-8">{children}</div>
      </div>
    );
  }

  // Giriş yok: sidebar yok (public sayfalar)
  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        {children}
      </div>
    );
  }

  // Giriş yapmış: sidebar + içerik
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex">
      <Button
        variant="ghost"
        size="icon"
        aria-label={sidebarOpen ? "Menüyü kapat" : "Menüyü aç"}
        aria-expanded={sidebarOpen}
        aria-controls="sidebar"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
      </Button>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Masaüstünde sidebar kapalıyken görünen "aç" düğmesi */}
      {desktopCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Menüyü aç"
          aria-expanded={false}
          aria-controls="sidebar"
          className="hidden lg:flex fixed top-4 left-4 z-50 bg-white/95 dark:bg-gray-900/95 shadow-md hover:bg-white dark:hover:bg-gray-800"
          onClick={() => setDesktopCollapsed(false)}
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </Button>
      )}
      <div
        id="sidebar"
        className={`
          fixed top-0 left-0 h-screen z-40 transform transition-all duration-300
          lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:transform-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${desktopCollapsed ? "lg:w-0 lg:overflow-hidden lg:pointer-events-none" : "lg:w-64"}
        `}
      >
        <Sidebar
          user={user}
          currentPage={currentPageName}
          onCollapse={() => setDesktopCollapsed(true)}
        />
      </div>
      <main className="flex-1 min-w-0 min-h-screen" id="main">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

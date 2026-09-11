import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import CommandPalette from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import Refrigerators from './pages/Refrigerators';
import RefrigeratorDetails from './pages/RefrigeratorDetails';
import Devices from './pages/Devices';
import DeviceDetails from './pages/DeviceDetails';
import Monitoring from './pages/Monitoring';
import Alerts from './pages/Alerts';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import Users from './pages/Users';
import Settings from './pages/Settings';

/**
 * Wraps ErrorBoundary with useLocation so the boundary resets automatically
 * whenever the user navigates to a different route. Without this, a crash on
 * one page keeps ErrorBoundary in the error state for all subsequent pages
 * until a full browser reload.
 */
function RouteAwareErrorBoundary({ children }) {
  const location = useLocation();
  // key={pathname} forces React to unmount+remount ErrorBoundary on every navigation,
  // which resets hasError to false and prevents error state from bleeding across routes.
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

export default function App() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', handleOpen);
    return () => window.removeEventListener('open-command-palette', handleOpen);
  }, []);

  return (
    <ToastProvider>
      <DataProvider>
        <Router>
          <div className="app-shell">
          <div className="ambient-background-mesh" />
          <Header 
            toggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)} 
            isMobileSidebarOpen={isMobileSidebarOpen}
            openCommandPalette={() => setIsCommandPaletteOpen(true)}
          />
          <div className="app-main-layout">
            <Sidebar 
              isOpen={isMobileSidebarOpen} 
              onCloseMobile={() => setIsMobileSidebarOpen(false)} 
            />
            <main className="app-content-area">
              <RouteAwareErrorBoundary>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/products/:id" element={<ProductDetails />} />
                  <Route path="/devices" element={<Devices />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/monitoring" element={<Monitoring />} />
                  <Route path="*" element={<div className="page-container flex-center"><h3>This feature is coming soon or has been deprecated in this version.</h3></div>} />
                </Routes>
              </RouteAwareErrorBoundary>
            </main>
          </div>
          <CommandPalette 
            isOpen={isCommandPaletteOpen} 
            onClose={() => setIsCommandPaletteOpen(false)} 
          />
        </div>
      </Router>
    </DataProvider>
  </ToastProvider>
  );
}

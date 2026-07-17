import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Products from './pages/Products';
import Analytics from './pages/Analytics';
import Alerts from './pages/Alerts';
import { DataProvider } from './context/DataContext';

function App() {
  return (
    <DataProvider>
      <Router>
        <div className="app-layout">
          <Sidebar />
          <div className="main-content">
            <Header />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/products" element={<Products />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/alerts" element={<Alerts />} />
            </Routes>
          </div>
        </div>
      </Router>
    </DataProvider>
  );
}

export default App;

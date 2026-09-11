import React from 'react';
import { useData } from '../context/DataContext';
import { AlertCircle } from 'lucide-react';

export default function DemoBanner() {
  const { isDemoMode, toggleDemoMode } = useData();

  if (!isDemoMode) return null;

  return (
    <div className="demo-banner">
      <div className="demo-banner-content">
        <AlertCircle size={18} className="demo-banner-icon" />
        <span>
          <strong>DEMO MODE ACTIVE:</strong> Data streams are simulated locally. No real production database mutations are occurring. Machine learning predictions remain unlinked.
        </span>
      </div>
      <button className="demo-banner-exit" onClick={toggleDemoMode}>
        Exit Demo Mode
      </button>
    </div>
  );
}

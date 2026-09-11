import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function DeleteConfirmModal({ title, message, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError("Failed to delete. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card max-w-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header border-b-0 pb-0">
          <div className="modal-title text-danger">
            <AlertTriangle size={24} />
            <h3>{title || "Confirm Deletion"}</h3>
          </div>
          <button className="icon-button" onClick={onClose} disabled={loading}><X size={20} /></button>
        </div>

        <div className="p-6 pt-2">
          {error && <div className="p-3 mb-4 bg-red-100 text-danger rounded border border-red-200">{error}</div>}
          <p className="text-muted">{message || "Are you sure you want to delete this item? This action cannot be undone."}</p>
        </div>

        <div className="modal-actions bg-slate-50 mt-0">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="btn-primary bg-danger border-danger text-white hover-bg-danger-dark" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

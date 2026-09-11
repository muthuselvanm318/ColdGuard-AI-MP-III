import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container" style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map(toast => (
          <div key={toast.id} className={`glass-card toast toast-${toast.type}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', backgroundColor: toast.type === 'success' ? '#E8F5E9' : '#FFEBEE', color: toast.type === 'success' ? '#2E7D32' : '#C62828', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div className="toast-icon">
              {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div className="toast-message" style={{ fontWeight: 500 }}>{toast.message}</div>
            <button className="icon-button" onClick={() => removeToast(toast.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

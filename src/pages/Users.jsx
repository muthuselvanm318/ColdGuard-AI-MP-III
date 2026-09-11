import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import DemoBanner from '../components/DemoBanner';
import { Users as UsersIcon, UserPlus, Shield, Check, X } from 'lucide-react';

export default function Users() {
  const { users, addUser, updateUserRole, userRole } = useData();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'OPERATOR' });

  const isAdmin = userRole === 'ADMIN';

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    await addUser(formData);
    setFormData({ name: '', email: '', role: 'OPERATOR' });
    setIsAddUserOpen(false);
  };

  return (
    <div className="page-container">
      <DemoBanner />

      <div className="page-header flex-between">
        <div>
          <h2 className="page-title">Role-Based Access Control (RBAC) & Users</h2>
          <p className="page-subtitle">Manage system users, access permissions, & organizational roles</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setIsAddUserOpen(true)}>
            <UserPlus size={18} /> Add New User
          </button>
        )}
      </div>

      {/* Role Matrix Overview */}
      <div className="glass-card section-card mb-6">
        <h3 className="section-title mb-4">
          <Shield size={18} className="text-primary" /> Role Permissions Matrix
        </h3>
        <div className="table-responsive">
          <table className="data-table border-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Dashboard & Monitoring</th>
                <th>Product & Hardware Mgmt</th>
                <th>Alerts & Resolutions</th>
                <th>Analytics & Reports</th>
                <th>System & RBAC Settings</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="role-badge-admin">ADMIN</span></td>
                <td><Check size={16} className="text-success" /></td>
                <td><Check size={16} className="text-success" /></td>
                <td><Check size={16} className="text-success" /></td>
                <td><Check size={16} className="text-success" /></td>
                <td><Check size={16} className="text-success" /> Full Access</td>
              </tr>
              <tr>
                <td><span className="role-badge-operator">OPERATOR</span></td>
                <td><Check size={16} className="text-success" /></td>
                <td><Check size={16} className="text-success" /></td>
                <td><Check size={16} className="text-success" /></td>
                <td><X size={16} className="text-muted" /></td>
                <td><X size={16} className="text-muted" /> Restricted</td>
              </tr>
              <tr>
                <td><span className="role-badge-quality">QUALITY_MANAGER</span></td>
                <td><Check size={16} className="text-success" /></td>
                <td><X size={16} className="text-muted" /> Read-Only</td>
                <td><Check size={16} className="text-success" /></td>
                <td><Check size={16} className="text-success" /></td>
                <td><X size={16} className="text-muted" /> Restricted</td>
              </tr>
              <tr>
                <td><span className="role-badge-viewer">VIEWER</span></td>
                <td><Check size={16} className="text-success" /> Read-Only</td>
                <td><X size={16} className="text-muted" /></td>
                <td><X size={16} className="text-muted" /></td>
                <td><X size={16} className="text-muted" /></td>
                <td><X size={16} className="text-muted" /> Restricted</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* User Directory */}
      <div className="glass-card section-card">
        <h3 className="section-title mb-4">
          <UsersIcon size={18} className="text-primary" /> Active User Directory
        </h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><code>{u.user_code}</code></td>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    {isAdmin ? (
                      <select 
                        value={u.role} 
                        onChange={(e) => updateUserRole(u.id, e.target.value)}
                        className="select-input-sm"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="OPERATOR">OPERATOR</option>
                        <option value="QUALITY_MANAGER">QUALITY_MANAGER</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    ) : (
                      <span className={`role-badge-${u.role.toLowerCase()}`}>{u.role}</span>
                    )}
                  </td>
                  <td><span className="badge-safe">{u.status}</span></td>
                  <td>
                    {isAdmin ? (
                      <span className="text-xs text-muted">Role Editable</span>
                    ) : (
                      <span className="text-xs text-muted">View Only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="modal-overlay" onClick={() => setIsAddUserOpen(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create System User</h3>
              <button className="icon-button" onClick={() => setIsAddUserOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="modal-form">
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  required 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  required 
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Assigned Role</label>
                <select 
                  value={formData.role} 
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="ADMIN">ADMIN (Full Control)</option>
                  <option value="OPERATOR">OPERATOR (Products + Devices)</option>
                  <option value="QUALITY_MANAGER">QUALITY_MANAGER (Analytics + Reports)</option>
                  <option value="VIEWER">VIEWER (Read-Only)</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsAddUserOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import DemoBanner from '../components/DemoBanner';
import { FileText, Download, Printer } from 'lucide-react';
import { formatDateTime, formatTimeOnly, formatDateOnly } from '../utils/dateTime';

export default function Reports() {
  const { products, refrigerators, devices, alerts, temperatureReadings } = useData();
  const [reportType, setReportType] = useState('TEMPERATURE');

  const exportCSV = () => {
    let dataToExport = [];
    if (reportType === 'TEMPERATURE') dataToExport = temperatureReadings;
    else if (reportType === 'PRODUCT') dataToExport = products;
    else if (reportType === 'ALERT') dataToExport = alerts;
    else if (reportType === 'DEVICE') dataToExport = devices;

    if (!dataToExport.length) return alert('No data available to export');

    const headers = Object.keys(dataToExport[0]).join(',');
    const rows = dataToExport.map(row => Object.values(row).map(v => `"${v}"`).join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ColdGuard_${reportType}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="page-container">
      <DemoBanner />

      <div className="page-header flex-between">
        <div>
          <h2 className="page-title">Compliance & Audit Reports</h2>
          <p className="page-subtitle">Export structured cold-chain reports for quality compliance</p>
        </div>
        <div className="flex-gap-2">
          <button className="btn-secondary" onClick={exportCSV}>
            <Download size={16} /> Export CSV
          </button>
          <button className="btn-primary" onClick={exportPDF}>
            <Printer size={16} /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* Report Selector */}
      <div className="glass-card table-toolbar mb-6">
        <div className="button-toggle-group">
          <button 
            className={`toggle-btn ${reportType === 'TEMPERATURE' ? 'active' : ''}`}
            onClick={() => setReportType('TEMPERATURE')}
          >
            Temperature Logs
          </button>
          <button 
            className={`toggle-btn ${reportType === 'PRODUCT' ? 'active' : ''}`}
            onClick={() => setReportType('PRODUCT')}
          >
            Product Summary
          </button>
          <button 
            className={`toggle-btn ${reportType === 'ALERT' ? 'active' : ''}`}
            onClick={() => setReportType('ALERT')}
          >
            Alert History
          </button>
          <button 
            className={`toggle-btn ${reportType === 'DEVICE' ? 'active' : ''}`}
            onClick={() => setReportType('DEVICE')}
          >
            Hardware Status
          </button>
        </div>
      </div>

      {/* Structured Report Preview Card */}
      <div className="glass-card section-card print-area">
        <div className="report-header-banner">
          <div>
            <h3 className="report-title font-bold text-lg">ColdGuard AI - {reportType} REPORT</h3>
            <p className="text-xs text-muted">Generated: {new Date().toLocaleString()}</p>
          </div>
          <div className="report-org-tag text-xs font-mono">
            ORGANIZATION: COLD-CHAIN QA DIVISION
          </div>
        </div>

        <div className="table-responsive mt-4">
          {reportType === 'TEMPERATURE' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reading ID</th>
                  <th>Device ID</th>
                  <th>Refrigerator</th>
                  <th>Product Code</th>
                  <th>Temperature (°C)</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {temperatureReadings.map(r => (
                  <tr key={r.id}>
                    <td><code>{r.id}</code></td>
                    <td>{r.device_id}</td>
                    <td>{r.refrigerator_id || 'REF-001'}</td>
                    <td>{r.product_id || 'MILK-001'}</td>
                    <td><strong>{r.temperature_c}°C</strong></td>
                    <td>{formatDateTime(r.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'PRODUCT' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Batch ID</th>
                  <th>Storage Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td><code>{p.product_code}</code></td>
                    <td>{p.name}</td>
                    <td>{p.product_type}</td>
                    <td><code>{p.batch_id}</code></td>
                    <td>{formatDateOnly(p.storage_start_date)}</td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'ALERT' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alert Code</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Recorded Temp</th>
                  <th>Message</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id}>
                    <td><code>{a.alert_code}</code></td>
                    <td>{a.type}</td>
                    <td>{a.severity}</td>
                    <td>{a.temperature_c ? `${a.temperature_c}°C` : 'N/A'}</td>
                    <td>{a.message}</td>
                    <td>{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'DEVICE' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Name</th>
                  <th>Sensor</th>
                  <th>IP Address</th>
                  <th>Firmware</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {devices.map(d => (
                  <tr key={d.id}>
                    <td><code>{d.device_code}</code></td>
                    <td>{d.device_name}</td>
                    <td>{d.sensor_type}</td>
                    <td><code>{d.ip_address}</code></td>
                    <td>{d.firmware_version}</td>
                    <td>{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}

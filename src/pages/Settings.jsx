import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Thermometer, 
  Clock, 
  BrainCircuit, 
  Bell, 
  Save, 
  RefreshCcw, 
  Info,
  ShieldCheck,
  AlertTriangle,
  Flame
} from 'lucide-react';
import { getSettings, updateSettings, resetSettings } from '../api/settingsApi';
import { useToast } from '../context/ToastContext';

export default function Settings() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const [settings, setSettings] = useState({
    recommended_temperature: 4.0,
    maximum_temperature: 5.0,
    warning_temperature: 7.0,
    critical_temperature: 10.0,
    monitoring_interval_minutes: 1,
    temperature_history_hours: 24,
    excursion_duration_minutes: 30,
    prediction_frequency: 'Automatically',
    minimum_prediction_confidence: 70,
    temperature_alert_enabled: true,
    prediction_alert_enabled: true,
    shelf_life_alert_enabled: true,
    sensor_offline_alert_enabled: true,
    data_delay_alert_enabled: true,
    alert_cooldown_minutes: 30
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getSettings();
      if (data) {
        setSettings(data);
      }
    } catch (err) {
      addToast("Failed to load settings from server.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    // Validation
    if (settings.recommended_temperature >= settings.maximum_temperature ||
        settings.maximum_temperature >= settings.warning_temperature ||
        settings.warning_temperature >= settings.critical_temperature) {
      addToast("Temperatures must be in logical order: Recommended < Maximum < Warning < Critical", "error");
      return;
    }
    if (settings.monitoring_interval_minutes <= 0 || settings.temperature_history_hours <= 0 || settings.alert_cooldown_minutes < 0) {
      addToast("Intervals and history limits must be positive.", "error");
      return;
    }
    if (settings.minimum_prediction_confidence < 0 || settings.minimum_prediction_confidence > 100) {
      addToast("Confidence must be between 0 and 100.", "error");
      return;
    }

    setSaving(true);
    try {
      await updateSettings(settings);
      addToast("Settings saved successfully.", "success");
    } catch (err) {
      addToast("Unable to save settings. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setShowConfirmReset(false);
    try {
      const data = await resetSettings();
      if (data) {
        setSettings(data);
        addToast("Settings reset to defaults.", "success");
      }
    } catch (err) {
      addToast("Failed to reset settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container flex-center">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p>Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title"><SettingsIcon size={24} className="inline mr-2 text-primary" /> Settings</h2>
        <p className="page-subtitle">Configure temperature monitoring and safety behavior.</p>
      </div>

      {/* Advanced Information Panel */}
      <div className="glass-card section-card mb-6 bg-blue-50/50 border-blue-100">
        <h3 className="section-title text-blue-800"><Info size={18} className="mr-2" /> How ColdGuard AI Determines Safety</h3>
        <p className="text-sm mt-2 text-blue-900 leading-relaxed">
          ColdGuard AI continuously analyzes temperature exposure data. The XGBoost model estimates remaining shelf life, 
          while the Random Forest model determines the current safety status. Configured temperature values below are used 
          for <strong>monitoring and alert management only</strong>. They do not manually override the ML prediction.
        </p>
      </div>

      <div className="grid-2-col gap-6">
        
        {/* Left Column */}
        <div className="space-y-6">
          
          <div className="glass-card section-card">
            <h3 className="section-title border-b pb-2"><Thermometer size={18} className="text-primary mr-2" /> Temperature & Safety Settings</h3>
            
            <div className="mt-4 space-y-4">
              <div className="form-group">
                <label className="font-semibold text-gray-800">Recommended Storage Temperature (°C)</label>
                <input type="number" step="0.1" value={settings.recommended_temperature} onChange={e => handleChange('recommended_temperature', parseFloat(e.target.value))} className="w-32" />
                <p className="text-xs text-muted mt-1">Target temperature for refrigerated pasteurized whole milk.</p>
              </div>
              
              <div className="form-group">
                <label className="font-semibold text-gray-800">Maximum Recommended Temperature (°C)</label>
                <input type="number" step="0.1" value={settings.maximum_temperature} onChange={e => handleChange('maximum_temperature', parseFloat(e.target.value))} className="w-32" />
                <p className="text-xs text-muted mt-1">Temperature above this value should be treated as an elevated storage condition.</p>
              </div>

              <div className="form-group">
                <label className="font-semibold text-gray-800">Warning Temperature (°C)</label>
                <input type="number" step="0.1" value={settings.warning_temperature} onChange={e => handleChange('warning_temperature', parseFloat(e.target.value))} className="w-32" />
                <p className="text-xs text-muted mt-1">Used to identify significant temperature excursions for monitoring and alerts.</p>
              </div>

              <div className="form-group">
                <label className="font-semibold text-gray-800">Critical Temperature (°C)</label>
                <input type="number" step="0.1" value={settings.critical_temperature} onChange={e => handleChange('critical_temperature', parseFloat(e.target.value))} className="w-32" />
                <p className="text-xs text-muted mt-1">Used to identify severe temperature excursions. Note: ML model determines final safety status.</p>
              </div>
            </div>
          </div>

          <div className="glass-card section-card">
            <h3 className="section-title border-b pb-2"><Clock size={18} className="text-emerald mr-2" /> Temperature Exposure</h3>
            
            <div className="mt-4 space-y-4">
              <div className="form-group">
                <label className="font-semibold text-gray-800">Sensor Reading Interval (Minutes)</label>
                <select value={settings.monitoring_interval_minutes} onChange={e => handleChange('monitoring_interval_minutes', parseInt(e.target.value))} className="w-48">
                  <option value={0.5}>30 seconds</option>
                  <option value={1}>1 minute</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                </select>
              </div>

              <div className="form-group">
                <label className="font-semibold text-gray-800">Temperature History Window (Hours)</label>
                <input type="number" value={settings.temperature_history_hours} onChange={e => handleChange('temperature_history_hours', parseInt(e.target.value))} className="w-32" />
                <p className="text-xs text-muted mt-1">Amount of historical data to compile for prediction context.</p>
              </div>

              <div className="form-group">
                <label className="font-semibold text-gray-800">Maximum Excursion Duration (Minutes)</label>
                <input type="number" value={settings.excursion_duration_minutes} onChange={e => handleChange('excursion_duration_minutes', parseInt(e.target.value))} className="w-32" />
                <p className="text-xs text-muted mt-1">Defines how long an elevated temperature condition can persist before an alert is generated.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-6">

          <div className="glass-card section-card">
            <h3 className="section-title border-b pb-2"><BrainCircuit size={18} className="text-purple mr-2" /> ML Prediction Settings</h3>
            
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded">
                <div>
                  <div className="text-xs text-muted font-bold uppercase">Shelf-Life Model</div>
                  <div className="font-semibold text-sm">XGBoost Regressor</div>
                </div>
                <div>
                  <div className="text-xs text-muted font-bold uppercase">Status Model</div>
                  <div className="font-semibold text-sm">Random Forest Classifier</div>
                </div>
              </div>

              <div className="form-group mt-2">
                <label className="font-semibold text-gray-800">Prediction Update Frequency</label>
                <select value={settings.prediction_frequency} onChange={e => handleChange('prediction_frequency', e.target.value)} className="w-full">
                  <option value="Automatically">Automatically (Every temperature reading)</option>
                  <option value="5">Every 5 minutes</option>
                  <option value="10">Every 10 minutes</option>
                  <option value="15">Every 15 minutes</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>

              <div className="form-group mt-2">
                <label className="font-semibold text-gray-800">Minimum Prediction Confidence (%)</label>
                <input type="number" value={settings.minimum_prediction_confidence} onChange={e => handleChange('minimum_prediction_confidence', parseInt(e.target.value))} className="w-32" />
                <p className="text-xs text-muted mt-1">Predictions below this confidence threshold will be flagged visually, but the status will not be overridden.</p>
              </div>
            </div>
            
            {/* Model Generated Statuses Info */}
            <div className="mt-6 pt-4 border-t">
              <label className="font-semibold text-gray-800 mb-2 block">Safety Statuses (Determined by ML)</label>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="text-success mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-sm">SAFE</strong>
                    <p className="text-xs text-muted">Model determines that current conditions are within the learned safe pattern.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-warning mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-sm">CAUTION</strong>
                    <p className="text-xs text-muted">Model identifies increased risk or reduced remaining shelf life.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Flame size={18} className="text-danger mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-sm">UNSAFE</strong>
                    <p className="text-xs text-muted">Model identifies conditions associated with unsafe food storage.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card section-card">
            <h3 className="section-title border-b pb-2"><Bell size={18} className="text-amber mr-2" /> Alert Configuration</h3>
            
            <div className="mt-4 space-y-4">
              <div className="flex-between items-center py-2">
                <div>
                  <div className="font-semibold">Temperature Excursion</div>
                  <div className="text-xs text-muted">Triggers when temperature exceeds warning limits.</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.temperature_alert_enabled} onChange={e => handleChange('temperature_alert_enabled', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="flex-between items-center py-2">
                <div>
                  <div className="font-semibold">ML Safety Prediction Alert</div>
                  <div className="text-xs text-muted">Triggers on transitions to CAUTION or UNSAFE.</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.prediction_alert_enabled} onChange={e => handleChange('prediction_alert_enabled', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="flex-between items-center py-2">
                <div>
                  <div className="font-semibold">Low Remaining Shelf Life</div>
                  <div className="text-xs text-muted">Triggers when model predicts rapid expiration.</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.shelf_life_alert_enabled} onChange={e => handleChange('shelf_life_alert_enabled', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
              
              <div className="flex-between items-center py-2">
                <div>
                  <div className="font-semibold">Sensor Offline</div>
                  <div className="text-xs text-muted">Triggers if hardware node stops reporting.</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.sensor_offline_alert_enabled} onChange={e => handleChange('sensor_offline_alert_enabled', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="pt-4 border-t">
                <div className="form-group">
                  <label className="font-semibold text-gray-800">Alert Cooldown (Minutes)</label>
                  <input type="number" value={settings.alert_cooldown_minutes} onChange={e => handleChange('alert_cooldown_minutes', parseInt(e.target.value))} className="w-32" />
                  <p className="text-xs text-muted mt-1">Prevents repeated identical alerts from being generated continuously.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="flex-between items-center mt-8 mb-12 bg-white p-4 rounded shadow-sm border">
        {showConfirmReset ? (
          <div className="flex items-center gap-4">
            <span className="text-danger font-semibold">Reset settings? All configurable values will return to defaults.</span>
            <button className="btn-secondary btn-sm" onClick={() => setShowConfirmReset(false)}>Cancel</button>
            <button className="btn-danger btn-sm" onClick={handleReset} disabled={saving}>Confirm Reset</button>
          </div>
        ) : (
          <button className="btn-secondary flex items-center" onClick={() => setShowConfirmReset(true)} disabled={saving}>
            <RefreshCcw size={16} className="mr-2" /> Reset to Default
          </button>
        )}
        
        <button className="btn-primary flex items-center" onClick={handleSave} disabled={saving}>
          <Save size={16} className="mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

    </div>
  );
}

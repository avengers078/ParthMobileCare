import React, { useEffect, useState } from 'react';
import {
  Settings,
  Store,
  MapPin,
  Clock,
  Phone,
  Mail,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Navigation,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useExitConfirmation } from '../context/ExitConfirmationContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { ShopConfig } from '../types';

export const SettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const { registerUnsavedChanges, clearUnsavedChanges } = useExitConfirmation();
  const initialConfigRef = React.useRef<string>('');

  const [config, setConfig] = useState<ShopConfig>({
    shopName: 'Parth Mobile Care',
    tagline: 'Your Trusted Smartphone Store',
    shopAddress: 'Parth Mobile Care, Ahmedabad, Gujarat',
    phone: '+91 98765 43210',
    alternatePhone: '+91 98765 43211',
    email: 'info@parthmobilecare.com',
    gstNumber: '24ABCDE1234F1Z5',
    latitude: 23.032588,
    longitude: 72.661115,
    allowedRadiusMeters: 30,
    openingTime: '10:00',
    closingTime: '21:00',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getShopConfig();
      if (data) {
        setConfig(data);
        initialConfigRef.current = JSON.stringify(data);
      }
    } catch (err) {
      console.warn('Shop config load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    return () => {
      clearUnsavedChanges();
    };
  }, []);

  // Track unsaved configuration changes
  useEffect(() => {
    if (!initialConfigRef.current || loading) return;
    const isDirty = JSON.stringify(config) !== initialConfigRef.current;
    registerUnsavedChanges('shop_settings', isDirty);
  }, [config, loading, registerUnsavedChanges]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Validation
    const lat = Number(config.latitude);
    const lng = Number(config.longitude);
    const radius = Number(config.allowedRadiusMeters);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setErrorMsg('Invalid latitude. Must be a valid number between -90 and 90.');
      setSaving(false);
      return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      setErrorMsg('Invalid longitude. Must be a valid number between -180 and 180.');
      setSaving(false);
      return;
    }

    if (isNaN(radius) || radius <= 0 || radius > 5000) {
      setErrorMsg('Allowed radius must be between 1 and 5000 meters.');
      setSaving(false);
      return;
    }

    try {
      const payload: ShopConfig = {
        shopName: config.shopName?.trim() || 'Parth Mobile Care',
        tagline: config.tagline?.trim() || '',
        shopAddress: config.shopAddress?.trim() || '',
        phone: config.phone?.trim() || '',
        alternatePhone: config.alternatePhone?.trim() || '',
        email: config.email?.trim() || 'info@parthmobilecare.com',
        gstNumber: config.gstNumber?.trim() || '',
        latitude: lat,
        longitude: lng,
        allowedRadiusMeters: radius,
        openingTime: config.openingTime?.trim() || '10:00',
        closingTime: config.closingTime?.trim() || '21:00',
        _syncedAt: new Date().toISOString(),
      };

      await ApiService.saveShopConfig(payload, {
        id: currentUser?.id || 'admin',
        name: currentUser?.name || 'Administrator',
      });
      initialConfigRef.current = JSON.stringify(payload);
      clearUnsavedChanges();
      showSuccess('Shop settings and geofencing configuration updated successfully.');
      setSuccessMsg('Shop settings and geofencing configuration updated successfully in Firestore.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save shop settings.');
      showError(err, 'Failed to save shop settings.');
    } finally {
      setSaving(false);
    }
  };

  const openInGoogleMaps = () => {
    if (config.latitude && config.longitude) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${config.latitude},${config.longitude}`,
        '_blank'
      );
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Top Banner */}
      <Card
        title="Store & Geofence Settings"
        subtitle="Configure business profile, operational hours, and GPS geofence validation coordinates for staff mobile attendance"
      />

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center space-x-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-200 flex items-center space-x-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <Card>
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading shop configuration...</p>
          </div>
        </Card>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Business Profile */}
          <Card
            title="Business Identity & Contact"
            subtitle="Details displayed on invoices, export sheets, and customer communications"
          >
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Store Legal Name *"
                  required
                  value={config.shopName}
                  onChange={e => setConfig({ ...config, shopName: e.target.value })}
                  placeholder="Parth Mobile Care"
                />
                <Input
                  label="Tagline / Slogan"
                  value={config.tagline || ''}
                  onChange={e => setConfig({ ...config, tagline: e.target.value })}
                  placeholder="Your Trusted Smartphone Store"
                />
              </div>

              <Input
                label="Physical Store Address *"
                required
                value={config.shopAddress}
                onChange={e => setConfig({ ...config, shopAddress: e.target.value })}
                placeholder="Main Market Road, Near City Center, Surat, Gujarat - 395001"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Primary Phone *"
                  required
                  value={config.phone}
                  onChange={e => setConfig({ ...config, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
                <Input
                  label="Alternate Phone"
                  value={config.alternatePhone || ''}
                  onChange={e => setConfig({ ...config, alternatePhone: e.target.value })}
                  placeholder="+91 98765 43211"
                />
                <Input
                  label="Store Official Email"
                  type="email"
                  value={config.email || ''}
                  onChange={e => setConfig({ ...config, email: e.target.value })}
                  placeholder="info@parthmobilecare.com"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="GSTIN Number"
                  value={config.gstNumber || ''}
                  onChange={e => setConfig({ ...config, gstNumber: e.target.value })}
                  placeholder="24ABCDE1234F1Z5"
                  helper="Format: 15 alphanumeric characters (24 for Gujarat state)"
                />
              </div>
            </div>
          </Card>

          {/* Operating Hours */}
          <Card
            title="Store Operating Hours"
            subtitle="Standard operating shifts used for attendance punctuality and reporting"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Input
                label="Opening / Shift Start Time (24h HH:mm)"
                value={config.openingTime || '10:00'}
                onChange={e => setConfig({ ...config, openingTime: e.target.value })}
                placeholder="10:00"
                icon={Clock}
                helper="Staff punching in after this time will be flagged as late"
              />
              <Input
                label="Closing / Shift End Time (24h HH:mm)"
                value={config.closingTime || '21:00'}
                onChange={e => setConfig({ ...config, closingTime: e.target.value })}
                placeholder="21:00"
                icon={Clock}
                helper="Standard shop closing time for shift completion"
              />
            </div>
          </Card>

          {/* Geofence Parameters */}
          <Card
            title="Attendance Geofence Coordinates"
            subtitle="GPS parameters required by staff mobile application to validate physical shop presence during Punch In"
            headerAction={
              <Button
                variant="outline"
                size="xs"
                icon={ExternalLink}
                onClick={openInGoogleMaps}
                type="button"
              >
                View on Google Maps
              </Button>
            }
          >
            <div className="space-y-4 pt-2">
              <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 flex items-start space-x-2.5">
                <Navigation className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                <span>
                  The mobile app computes the Haversine distance between the staff device's GPS fix and these coordinates.
                  If the calculated distance exceeds the allowed radius, Punch In is rejected.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Store Latitude *"
                  type="number"
                  step="any"
                  required
                  value={config.latitude}
                  onChange={e => setConfig({ ...config, latitude: Number(e.target.value) })}
                  icon={MapPin}
                />
                <Input
                  label="Store Longitude *"
                  type="number"
                  step="any"
                  required
                  value={config.longitude}
                  onChange={e => setConfig({ ...config, longitude: Number(e.target.value) })}
                  icon={MapPin}
                />
                <Input
                  label="Allowed Radius (Meters) *"
                  type="number"
                  min="5"
                  max="5000"
                  required
                  value={config.allowedRadiusMeters}
                  onChange={e => setConfig({ ...config, allowedRadiusMeters: Number(e.target.value) })}
                  helper="Recommended: 50–100m to account for GPS drift"
                />
              </div>
            </div>
          </Card>

          {/* Form Action Footer Card */}
          <div className="bg-white dark:bg-[#0F192C] p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-[#24344D] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-slate-500 dark:text-[#94A3B8] text-xs">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-[#17243A] text-brand-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/40">
                <Store className="w-4 h-4" />
              </div>
              <p className="leading-relaxed">
                Updating these parameters immediately synchronizes store address, invoice metadata, and live GPS geofence rules across all staff mobile applications.
              </p>
            </div>
            <div className="w-full sm:w-auto shrink-0 flex items-center justify-end">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={Save}
                loading={saving}
                disabled={saving}
                className="w-full sm:w-auto h-11 px-7 text-sm font-bold shadow-md shadow-[#194D9C]/20"
              >
                {saving ? 'Saving Configuration...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

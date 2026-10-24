import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Camera,
  Crosshair,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle,
  Upload,
  Info
} from 'lucide-react';
import { createCitizenReport, reverseGeocode } from '../../lib/potholeService';
import { uploadImageWithFallback } from '../../lib/firebase';

export default function ReportPotholeModal({
  isOpen,
  onClose,
  initialLocation,
  onOpenMapPicker = () => {}
}) {
  const [lat, setLat] = useState(initialLocation?.lat || '');
  const [lng, setLng] = useState(initialLocation?.lng || '');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [severityScore, setSeverityScore] = useState(2.8); // 1.5 - 4.5
  const [citizenEmail, setCitizenEmail] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Sync initial location
  useEffect(() => {
    if (initialLocation?.lat && initialLocation?.lng) {
      setLat(initialLocation.lat);
      setLng(initialLocation.lng);
      fetchAddress(initialLocation.lat, initialLocation.lng);
    }
  }, [initialLocation]);

  const fetchAddress = async (latitude, longitude) => {
    setIsGeocoding(true);
    const resolved = await reverseGeocode(latitude, longitude);
    setAddress(resolved);
    setIsGeocoding(false);
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        fetchAddress(latitude, longitude);
      },
      (err) => {
        alert('Could not retrieve current location. Please grant location permissions or enter coordinates.');
      },
      { enableHighAccuracy: true }
    );
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lat || !lng) {
      setErrorMsg('Please specify a defect location on the map or use your GPS.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      let imageUrl = null;
      if (photoFile) {
        const storagePath = `citizen_reports/${Date.now()}_${photoFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const uploadResult = await uploadImageWithFallback(photoFile, storagePath);
        imageUrl = uploadResult?.url || null;
      }

      const potholeId = await createCitizenReport({
        lat: Number(lat),
        lng: Number(lng),
        description,
        severityScore: Number(severityScore),
        citizenEmail: citizenEmail || null,
        imageUrl,
        address: address || null
      });

      setSuccessId(potholeId);
    } catch (err) {
      console.error('[Citizen Report] Submission error:', err);
      setErrorMsg('Failed to submit report. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-civic-500/20 border border-civic-400/30 flex items-center justify-center text-civic-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Report a Pothole or Road Defect</h2>
              <p className="text-xs text-slate-400">Directly alerts municipal road maintenance dispatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {successId ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-9 h-9" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">Report Logged Successfully</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Your road hazard report has been added to the public queue. Municipal authorities have been notified for triage.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 font-mono">
              Defect Reference ID: <span className="font-bold text-civic-700">{successId}</span>
            </div>
            <div className="pt-2">
              <button
                onClick={() => {
                  setSuccessId(null);
                  onClose();
                }}
                className="w-full py-2.5 bg-civic-700 hover:bg-civic-800 text-white font-semibold text-xs rounded-xl shadow-md transition-colors"
              >
                Return to Live Map
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Location selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Defect Location <span className="text-red-500">*</span>
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUseGps}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-colors"
                >
                  <Crosshair className="w-4 h-4 text-civic-600" />
                  Use My Current GPS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenMapPicker();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-civic-50 hover:bg-civic-100 text-civic-700 rounded-lg text-xs font-semibold border border-civic-200 transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Pick on Map
                </button>
              </div>

              {/* Coordinates display */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-[10px] text-slate-500">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lat}
                    onChange={(e) => {
                      setLat(e.target.value);
                      if (e.target.value && lng) fetchAddress(Number(e.target.value), Number(lng));
                    }}
                    placeholder="e.g. 16.4947"
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-civic-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={lng}
                    onChange={(e) => {
                      setLng(e.target.value);
                      if (lat && e.target.value) fetchAddress(Number(lat), Number(e.target.value));
                    }}
                    placeholder="e.g. 80.4992"
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-civic-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Reverse geocoded address indicator */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-civic-600 mt-0.5 shrink-0" />
                <span className="flex-1">
                  {isGeocoding ? 'Reverse geocoding street address...' : (address || 'No location pinpointed yet.')}
                </span>
              </div>
            </div>

            {/* Severity Estimate */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Severity Assessment
                </label>
                <span className="text-xs font-semibold text-slate-600">
                  {severityScore < 2.3 ? 'Low (Surface crack)' : severityScore < 3.8 ? 'Medium (Moderate bump)' : 'High (Dangerous wheel impact)'}
                </span>
              </div>
              <input
                type="range"
                min="1.5"
                max="5.0"
                step="0.1"
                value={severityScore}
                onChange={(e) => setSeverityScore(e.target.value)}
                className="w-full accent-civic-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>Minor (1.5G)</span>
                <span>Moderate (3.0G)</span>
                <span>Critical Crater (5.0G)</span>
              </div>
            </div>

            {/* Description textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Description & Landmarks
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Deep pothole on right lane near junction, causing vehicles to swerve suddenly."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-civic-500 focus:outline-none"
              />
            </div>

            {/* Photo upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Attach Hazard Photo (Optional)
              </label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors">
                  <Camera className="w-4 h-4 text-slate-600" />
                  <span>Choose Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
                {photoFile && (
                  <span className="text-xs text-slate-500 truncate max-w-[200px]">
                    {photoFile.name}
                  </span>
                )}
              </div>

              {photoPreview && (
                <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 max-h-32 bg-slate-100">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-black/80"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Citizen email (optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Your Email (Optional, for repair status notifications)
              </label>
              <input
                type="email"
                value={citizenEmail}
                onChange={(e) => setCitizenEmail(e.target.value)}
                placeholder="citizen@example.com"
                className="w-full text-xs p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-civic-500 focus:outline-none"
              />
            </div>

            {/* Submit button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-civic-700 hover:bg-civic-800 disabled:bg-slate-400 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Transmitting Report to Firestore...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Pothole Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

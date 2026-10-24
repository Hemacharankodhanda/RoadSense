import React, { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Calendar,
  Layers,
  Activity,
  Cpu,
  CheckCircle,
  Clock,
  ExternalLink,
  Shield,
  DollarSign,
  User,
  History,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import { StatusBadge, SeverityBadge } from '../common/Badges';
import { subscribeStatusHistory } from '../../lib/potholeService';

export default function PotholeDetailModal({ pothole, onClose }) {
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pothole?.id) return;
    const unsub = subscribeStatusHistory(pothole.id, (logs) => {
      setHistory(logs);
    });
    return () => unsub();
  }, [pothole?.id]);

  if (!pothole) return null;

  const lat = pothole.location?.lat?.toFixed(5);
  const lng = pothole.location?.lng?.toFixed(5);
  const formattedCoords = `${lat}, ${lng}`;

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(formattedCoords);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-end sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
      {/* Drawer / Panel */}
      <div className="w-full sm:max-w-lg h-full sm:h-[95vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
              DEFECT #{pothole.id?.slice(0, 8)}
            </span>
            <StatusBadge status={pothole.status} size="xs" />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Main Title & Address */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                {pothole.address || 'Street Surface Defect'}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <MapPin className="w-3.5 h-3.5 text-civic-600 shrink-0" />
              <span>{formattedCoords}</span>
              <button
                type="button"
                onClick={handleCopyCoords}
                className="hover:text-slate-800 p-0.5 rounded text-slate-400"
                title="Copy GPS coordinates"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Severity Card */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-rose-500" />
                Impact Severity
              </div>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={pothole.severity} size="sm" />
                <span className="text-xs font-bold text-slate-700 font-mono">
                  {pothole.severityScore ? `${Number(pothole.severityScore).toFixed(2)}G` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Confirmations Card */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-civic-500" />
                Crowd Confirmations
              </div>
              <div className="text-base font-bold text-slate-900">
                {pothole.confirmationCount || 1}
                <span className="text-xs font-normal text-slate-500 ml-1">sensor hits</span>
              </div>
            </div>
          </div>

          {/* Detection & Source Metadata */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Cpu className="w-3.5 h-3.5" /> Source Node
              </span>
              <span className="font-medium text-slate-800 capitalize">
                {pothole.source === 'device' ? 'Automated IoT Sensor (ESP32)' : 'Citizen Field Report'}
              </span>
            </div>

            {pothole.deviceIds && pothole.deviceIds.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Contributing Node IDs</span>
                <span className="font-mono text-[11px] text-slate-700">
                  {pothole.deviceIds.join(', ')}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-500">
                <Calendar className="w-3.5 h-3.5" /> First Detected
              </span>
              <span className="font-medium text-slate-700">
                {formatDate(pothole.firstDetectedAt)}
              </span>
            </div>

            {pothole.lastDetectedAt && pothole.lastDetectedAt !== pothole.firstDetectedAt && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="w-3.5 h-3.5" /> Last Confirmed
                </span>
                <span className="font-medium text-slate-700">
                  {formatDate(pothole.lastDetectedAt)}
                </span>
              </div>
            )}
          </div>

          {/* Citizen Description / Initial Photo if available */}
          {pothole.description && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                Description / Notes
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed p-3 bg-slate-50 rounded-lg border border-slate-200/60">
                {pothole.description}
              </p>
            </div>
          )}

          {pothole.imageUrl && (
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                Citizen Attached Photo
              </h3>
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-48">
                <img
                  src={pothole.imageUrl}
                  alt="Citizen report"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* WORK COMPLETED SECTION (If Repaired) */}
          {pothole.status === 'repaired' && pothole.completion && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Municipal Repair Completion Record</span>
              </div>

              {pothole.completion.proofPhotoUrl && (
                <div className="rounded-xl overflow-hidden border border-emerald-300/60 shadow-sm bg-white">
                  <img
                    src={pothole.completion.proofPhotoUrl}
                    alt="Proof of completed repair"
                    className="w-full h-44 object-cover"
                  />
                  <div className="p-2 text-[11px] text-center font-medium text-emerald-800 bg-emerald-100/60">
                    Official After-Repair Proof Photo
                  </div>
                </div>
              )}

              <div className="text-xs text-emerald-950 space-y-1.5 pt-1">
                {pothole.completion.remarks && (
                  <div>
                    <span className="font-semibold text-emerald-900">Officer Remarks: </span>
                    <span className="text-emerald-800">{pothole.completion.remarks}</span>
                  </div>
                )}
                {pothole.completion.cost > 0 && (
                  <div className="flex items-center gap-1 font-semibold text-emerald-900">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Repair Cost: ${pothole.completion.cost.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-emerald-700 text-[11px]">
                  <User className="w-3.5 h-3.5" />
                  <span>Inspected by: {pothole.completion.completedBy?.name || 'Municipal Works Officer'}</span>
                </div>
                <div className="text-[11px] text-emerald-700">
                  Completed on: {formatDate(pothole.completion.completedAt)}
                </div>
              </div>
            </div>
          )}

          {/* STATUS TIMELINE AUDIT TRAIL */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              Status Lifecycle Timeline
            </h3>

            {history.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No timeline entries recorded yet.</p>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {history.map((entry, idx) => (
                  <div key={entry.id || idx} className="relative text-xs">
                    <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-civic-600 shadow-sm" />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {entry.action?.replace(/_/g, ' ') || 'Status Updated'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDate(entry.timestamp)}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{entry.note}</p>
                    )}
                    {entry.performedBy && (
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        By: {entry.performedBy.name || entry.performedBy.email || entry.performedBy.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${pothole.location?.lat},${pothole.location?.lng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-civic-700 hover:text-civic-900 font-semibold"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Navigation Map
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

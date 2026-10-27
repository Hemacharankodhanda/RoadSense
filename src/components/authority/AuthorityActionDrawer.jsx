import React, { useState, useEffect } from 'react';
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
  Wrench,
  Camera,
  RotateCcw,
  Trash2,
  Send,
  Loader2,
  Check,
  Building
} from 'lucide-react';
import { StatusBadge, SeverityBadge } from '../common/Badges';
import {
  subscribeStatusHistory,
  updatePotholeStatus,
  assignPothole,
  markPotholeCompleted,
  reopenPothole,
  softDeletePothole
} from '../../lib/potholeService';
import { uploadImageWithFallback } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';

export default function AuthorityActionDrawer({ pothole, onClose, onRefresh = () => {} }) {
  const { currentUser, userProfile } = useAuth();
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'actions' | 'timeline'

  // Action Form States
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const [department, setDepartment] = useState(pothole?.assignedDepartment || '');
  const [expectedDate, setExpectedDate] = useState(pothole?.expectedCompletionDate || '');
  const [assignNote, setAssignNote] = useState('');

  // Completion Form States
  const [proofPhotoFile, setProofPhotoFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [completionCost, setCompletionCost] = useState('');
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().slice(0, 10));

  // Reopen State
  const [reopenReason, setReopenReason] = useState('');
  const [isReopening, setIsReopening] = useState(false);

  // Soft delete state
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Processing state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  useEffect(() => {
    if (!pothole?.id) return;
    const unsub = subscribeStatusHistory(pothole.id, (logs) => {
      setHistory(logs);
    });
    return () => unsub();
  }, [pothole?.id]);

  if (!pothole) return null;

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

  const handleVerify = async (accepted) => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      if (accepted) {
        await updatePotholeStatus(pothole.id, 'verified', 'Citizen report verified by authority dispatch.', {
          uid: currentUser?.uid,
          displayName: userProfile?.name || currentUser?.email
        });
        setActionFeedback('Pothole successfully verified.');
      } else {
        if (!rejectReason.trim()) {
          alert('Please enter a rejection reason.');
          setActionLoading(false);
          return;
        }
        await updatePotholeStatus(pothole.id, 'rejected', `Report rejected: ${rejectReason}`, {
          uid: currentUser?.uid,
          displayName: userProfile?.name || currentUser?.email
        });
        setActionFeedback('Pothole rejected.');
      }
      onRefresh();
    } catch (err) {
      console.error('[AuthorityDrawer] Error in verify:', err);
      alert('Action failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!department.trim()) {
      alert('Please specify a department or contractor name.');
      return;
    }
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await assignPothole(pothole.id, department, expectedDate, {
        uid: currentUser?.uid,
        displayName: userProfile?.name || currentUser?.email
      }, assignNote);
      setActionFeedback('Assigned to contractor & advanced to In Progress.');
      onRefresh();
    } catch (err) {
      console.error('[AuthorityDrawer] Assign error:', err);
      alert('Assignment failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setProofPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleMarkCompleted = async (e) => {
    e.preventDefault();
    if (!completionRemarks.trim()) {
      alert('Please provide repair remarks.');
      return;
    }

    setActionLoading(true);
    setActionFeedback(null);
    try {
      let proofUrl = null;
      if (proofPhotoFile) {
        const storagePath = `proof_photos/${Date.now()}_${proofPhotoFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const uploadRes = await uploadImageWithFallback(proofPhotoFile, storagePath);
        proofUrl = uploadRes?.url || null;
      }

      await markPotholeCompleted(pothole.id, {
        proofPhotoUrl: proofUrl,
        remarks: completionRemarks,
        cost: Number(completionCost) || 0,
        completedAt: new Date(completionDate).toISOString()
      }, {
        uid: currentUser?.uid,
        displayName: userProfile?.name || currentUser?.email,
        department: userProfile?.department || 'Road Operations'
      });

      setActionFeedback('Repair marked as COMPLETED. Live map updated.');
      onRefresh();
    } catch (err) {
      console.error('[AuthorityDrawer] Mark complete error:', err);
      alert('Completion failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      alert('Please enter a reopening reason.');
      return;
    }
    setActionLoading(true);
    try {
      await reopenPothole(pothole.id, reopenReason, {
        uid: currentUser?.uid,
        displayName: userProfile?.name || currentUser?.email
      });
      setIsReopening(false);
      setActionFeedback('Pothole reopened & returned to active triage queue.');
      onRefresh();
    } catch (err) {
      alert('Reopen failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteReason.trim()) {
      alert('Please provide a reason for soft-deletion.');
      return;
    }
    if (!window.confirm('Are you sure you want to soft-delete this pothole from the active queue?')) return;
    setActionLoading(true);
    try {
      await softDeletePothole(pothole.id, deleteReason, {
        uid: currentUser?.uid,
        displayName: userProfile?.name || currentUser?.email
      });
      onClose();
      onRefresh();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-end sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full sm:max-w-xl h-full sm:h-[95vh] bg-slate-900 border border-slate-800 text-slate-100 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                DEFECT #{pothole.id?.slice(0, 8)}
              </span>
              <StatusBadge status={pothole.status} size="xs" />
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {pothole.location?.lat?.toFixed(5)}, {pothole.location?.lng?.toFixed(5)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-civic-500 text-civic-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Telemetry & Data
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'actions'
                ? 'border-civic-500 text-civic-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Triage & Repair Actions</span>
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'border-civic-500 text-civic-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail ({history.length})</span>
          </button>
        </div>

        {/* Feedback message banner */}
        {actionFeedback && (
          <div className="bg-emerald-950/80 border-b border-emerald-800 px-4 py-2 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: OVERVIEW & TELEMETRY */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Address */}
              <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Reverse Geocoded Location
                </span>
                <p className="text-sm font-semibold text-slate-200">
                  {pothole.address || 'Street defect location'}
                </p>
              </div>

              {/* Hardware / IoT Telemetry Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-rose-400" />
                    Impact Magnitude
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <SeverityBadge severity={pothole.severity} size="sm" />
                    <span className="font-mono font-bold text-slate-200">
                      {pothole.severityScore ? `${Number(pothole.severityScore).toFixed(2)}G` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-civic-400" />
                    Crowd Confirmations
                  </span>
                  <p className="text-base font-bold text-slate-100 mt-1">
                    {pothole.confirmationCount || 1} hits
                  </p>
                </div>
              </div>

              {/* Hardware Source & Devices */}
              <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Detection Channel</span>
                  <span className="font-semibold text-slate-200 capitalize">
                    {pothole.source === 'device' ? 'Automated IoT Sensor Node' : 'Citizen Mobile Report'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Est. depth</span>
                  {typeof pothole.depth_cm === 'number' && !isNaN(pothole.depth_cm) ? (
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <span>{Number(pothole.depth_cm).toFixed(1)} cm</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        pothole.depth_cm >= 7
                          ? 'bg-rose-900/60 text-rose-300 border border-rose-700/50'
                          : pothole.depth_cm >= 3
                          ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                          : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                      }`}>
                        {pothole.depth_cm >= 7 ? 'Deep' : pothole.depth_cm >= 3 ? 'Moderate' : 'Shallow'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-500 font-mono">n/a</span>
                  )}
                </div>
                {pothole.deviceIds && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Patrol Device ID(s)</span>
                    <span className="font-mono text-civic-300">
                      {pothole.deviceIds.join(', ')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">First Detected</span>
                  <span className="text-slate-300">{formatDate(pothole.firstDetectedAt)}</span>
                </div>
                {pothole.lastDetectedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Last Telemetry Spike</span>
                    <span className="text-slate-300">{formatDate(pothole.lastDetectedAt)}</span>
                  </div>
                )}
              </div>

              {/* Assignment info if already assigned */}
              {pothole.assignedDepartment && (
                <div className="p-3.5 bg-civic-950/40 border border-civic-800 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-civic-300 font-bold">
                    <Building className="w-3.5 h-3.5" />
                    <span>Contractor Assignment</span>
                  </div>
                  <div className="text-slate-300">
                    Assigned Unit: <span className="font-semibold text-white">{pothole.assignedDepartment}</span>
                  </div>
                  {pothole.expectedCompletionDate && (
                    <div className="text-slate-400 text-[11px]">
                      Target Completion: {pothole.expectedCompletionDate}
                    </div>
                  )}
                </div>
              )}

              {/* Citizen attached photo if any */}
              {pothole.imageUrl && (
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Citizen Submission Photo
                  </span>
                  <div className="rounded-xl overflow-hidden border border-slate-700 max-h-48">
                    <img src={pothole.imageUrl} alt="Hazard photo" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              {/* Completion data if repaired */}
              {pothole.status === 'repaired' && pothole.completion && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <CheckCircle className="w-4 h-4" />
                    <span>Repair Work Record</span>
                  </div>
                  {pothole.completion.proofPhotoUrl && (
                    <div className="rounded-lg overflow-hidden border border-emerald-700/60 max-h-44">
                      <img src={pothole.completion.proofPhotoUrl} alt="Proof" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="text-xs text-slate-300 space-y-1">
                    <p><span className="text-slate-400">Remarks:</span> {pothole.completion.remarks}</p>
                    {pothole.completion.cost > 0 && (
                      <p><span className="text-slate-400">Total Expenditure:</span> ${pothole.completion.cost.toLocaleString()}</p>
                    )}
                    <p className="text-[11px] text-emerald-400">
                      Certified by: {pothole.completion.completedBy?.name || 'Officer'} on {formatDate(pothole.completion.completedAt)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TRIAGE & REPAIR ACTIONS */}
          {activeTab === 'actions' && (
            <div className="space-y-6">
              {/* ACTION 1: VERIFY / REJECT (If Reported) */}
              {pothole.status === 'reported' && (
                <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                    <Shield className="w-4 h-4 text-civic-400" />
                    <span>Step 1: Citizen Report Verification</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Review sensor telemetry / citizen notes and verify the physical defect before assigning roadworks.
                  </p>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleVerify(true)}
                      className="flex-1 py-2 px-3 bg-civic-600 hover:bg-civic-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Accept & Verify Defect
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRejecting(!isRejecting)}
                      className="py-2 px-3 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Reject Report
                    </button>
                  </div>

                  {isRejecting && (
                    <div className="pt-2 space-y-2 border-t border-slate-700/60 mt-2">
                      <label className="text-[11px] text-slate-400 block">Rejection Reason</label>
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g. Duplicate report, minor road joint, or invalid coordinates"
                        className="w-full text-xs p-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleVerify(false)}
                        className="w-full py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-bold"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ACTION 2: ASSIGN TO CONTRACTOR / DEPARTMENT */}
              {(pothole.status === 'verified' || pothole.status === 'reported' || pothole.status === 'in_progress') && (
                <form onSubmit={handleAssign} className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                    <Building className="w-4 h-4 text-civic-400" />
                    <span>Assign Work to Department / Contractor</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Department / Asphalting Contractor Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. Municipal Paving Unit #4, Apex Roadworks LLC"
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-civic-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Expected Completion Target Date
                      </label>
                      <input
                        type="date"
                        value={expectedDate}
                        onChange={(e) => setExpectedDate(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-civic-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Work Order Dispatch Note
                      </label>
                      <input
                        type="text"
                        value={assignNote}
                        onChange={(e) => setAssignNote(e.target.value)}
                        placeholder="e.g. Hot-mix asphalt patch required. High traffic corridor."
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-civic-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Dispatch to Contractor (Set Status: In Progress)</span>
                  </button>
                </form>
              )}

              {/* ACTION 3: MARK WORK COMPLETED (CRITICAL REQUIREMENT) */}
              {pothole.status !== 'repaired' && (
                <form onSubmit={handleMarkCompleted} className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Mark Work Completed & Upload Proof</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Certifying this repair will immediately update the public civic map to Green (Repaired).
                  </p>

                  <div className="space-y-2 text-xs">
                    {/* Proof photo */}
                    <div>
                      <label className="text-[11px] text-emerald-300 font-semibold block mb-1">
                        After-Repair Proof Photo
                      </label>
                      <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs transition-colors">
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span>Select Inspection Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                      </label>
                      {proofPreview && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-emerald-700 max-h-32">
                          <img src={proofPreview} alt="Proof preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    {/* Remarks */}
                    <div>
                      <label className="text-[11px] text-emerald-300 font-semibold block mb-1">
                        Officer Remarks & Work Summary *
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={completionRemarks}
                        onChange={(e) => setCompletionRemarks(e.target.value)}
                        placeholder="e.g. Surface leveled, hot asphalt compacted, edge sealed. Verified flush with street grade."
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Cost and Completion Date */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          Repair Cost ($ / Currency)
                        </label>
                        <input
                          type="number"
                          value={completionCost}
                          onChange={(e) => setCompletionCost(e.target.value)}
                          placeholder="e.g. 450"
                          className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          Completion Date
                        </label>
                        <input
                          type="date"
                          value={completionDate}
                          onChange={(e) => setCompletionDate(e.target.value)}
                          className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs"
                        />
                      </div>
                    </div>

                    {/* Officer attribution auto-fill badge */}
                    <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Certifying Official:</span>
                      <span className="font-semibold text-slate-200">
                        {userProfile?.name || currentUser?.email}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Transmitting Proof to Database...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Confirm Work Completed</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ACTION 4: REOPEN POTHOLE (If Repaired) */}
              {pothole.status === 'repaired' && (
                <div className="p-4 bg-amber-950/40 border border-amber-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">Reopen Defect</span>
                    <button
                      type="button"
                      onClick={() => setIsReopening(!isReopening)}
                      className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isReopening ? 'Cancel' : 'Reopen Pothole'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    If asphalt failed or new sensor readings detect recurring depression, reopen this record.
                  </p>

                  {isReopening && (
                    <div className="pt-2 space-y-2 border-t border-amber-900/60 mt-2">
                      <input
                        type="text"
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        placeholder="Reason for reopening (e.g. Patch eroded after heavy rain)..."
                        className="w-full text-xs p-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleReopen}
                        className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg"
                      >
                        Confirm Reopen Pothole
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ACTION 5: SOFT DELETE (AUDIT COMPLIANT) */}
              <div className="pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDeleting(!isDeleting)}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Soft-Delete Pothole (Audit Safe)</span>
                </button>

                {isDeleting && (
                  <div className="mt-2 p-3 bg-red-950/40 border border-red-900 rounded-xl space-y-2 text-xs">
                    <label className="text-[11px] text-red-300 block">Deletion Audit Reason</label>
                    <input
                      type="text"
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="e.g. Sensor erroneous trigger during bridge expansion joint crossing"
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    />
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleSoftDelete}
                      className="w-full py-1.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg"
                    >
                      Archive & Soft-Delete Record
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TIMELINE AUDIT TRAIL */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Immutable Status History</span>
                <span className="font-mono">{history.length} logged events</span>
              </div>

              {history.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-4 text-center">No audit trail records found.</p>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {history.map((item, idx) => (
                    <div key={item.id || idx} className="relative text-xs">
                      <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 bg-civic-500 shadow-sm" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">
                          {item.action?.replace(/_/g, ' ') || 'STATUS UPDATE'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatDate(item.timestamp)}
                        </span>
                      </div>
                      {item.note && (
                        <p className="text-slate-300 mt-1 leading-relaxed bg-slate-800/40 p-2 rounded-lg border border-slate-800">
                          {item.note}
                        </p>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1">
                        By: <span className="text-slate-400 font-medium">{item.performedBy?.name || item.performedBy?.email || 'System'}</span>
                        {item.performedBy?.role && ` (${item.performedBy.role})`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${pothole.location?.lat},${pothole.location?.lng}`}
            target="_blank"
            rel="noreferrer"
            className="text-civic-400 hover:text-civic-300 flex items-center gap-1 font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in External Map</span>
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

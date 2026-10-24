import React, { useState, useEffect } from 'react';
import PublicHeader from '../components/public/PublicHeader';
import PublicStatsCards from '../components/public/PublicStatsCards';
import PotholeMap from '../components/map/PotholeMap';
import PublicTableView from '../components/public/PublicTableView';
import PotholeDetailModal from '../components/potholes/PotholeDetailModal';
import ReportPotholeModal from '../components/potholes/ReportPotholeModal';
import { subscribePotholes, subscribeRealtimeDatabaseReadings } from '../lib/potholeService';
import { isFirebaseConfigured } from '../lib/firebase';
import { AlertTriangle, Database, Info, Loader2, Sparkles } from 'lucide-react';

export default function PublicPortal() {
  const [potholes, setPotholes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('map'); // 'map' | 'list'
  const [selectedPothole, setSelectedPothole] = useState(null);

  // Citizen report states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isMapPickerMode, setIsMapPickerMode] = useState(false);
  const [pickedLocation, setPickedLocation] = useState(null);

  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    // 1. Subscribe to Firestore defects stream
    const unsubFirestore = subscribePotholes(
      (data) => {
        setPotholes(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[PublicPortal] Firestore subscription error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    // 2. Subscribe to live ESP32 Realtime Database /potholes stream
    const unsubRTDB = subscribeRealtimeDatabaseReadings((newReading) => {
      console.log('[PublicPortal] ESP32 live reading arrived from RTDB /potholes:', newReading);
    });

    return () => {
      unsubFirestore();
      unsubRTDB();
    };
  }, []);

  const handleMapLocationSelect = (loc) => {
    setPickedLocation(loc);
    if (isMapPickerMode) {
      setIsMapPickerMode(false);
      setIsReportModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Top Header */}
      <PublicHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenReportModal={() => {
          setPickedLocation(null);
          setIsReportModalOpen(true);
        }}
      />

      {/* Firebase Configuration Banner if developer hasn't configured .env yet */}
      {!firebaseReady && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-medium flex items-center justify-between border-b border-amber-600 shadow-sm">
          <div className="flex items-center gap-2 max-w-5xl mx-auto">
            <Info className="w-4 h-4 shrink-0 text-slate-950" />
            <span>
              <strong>Firebase Setup Note:</strong> Connect your Firebase project in <code>.env</code> and run <code>node seed.js</code> from your terminal to populate initial IoT telemetry.
            </span>
          </div>
        </div>
      )}

      {/* Main App Workspace */}
      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-4 sm:p-6 gap-4">
        {/* Top Summary Stat Cards */}
        <PublicStatsCards potholes={potholes} />

        {/* Loading Skeleton */}
        {loading && (
          <div className="flex-1 min-h-[450px] bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-civic-600 mb-3" />
            <p className="text-sm font-semibold text-slate-700">Connecting to Live Firestore Stream...</p>
            <p className="text-xs text-slate-400 mt-1">Retrieving IoT sensor telemetry and crowdsourced reports</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-red-900">Firestore Stream Error</h3>
            <p className="text-xs text-red-700 mt-1 max-w-md mx-auto">{error}</p>
          </div>
        )}

        {/* Tab 1: Interactive Map View */}
        {!loading && !error && activeTab === 'map' && (
          <div className="flex-1 min-h-[550px] lg:min-h-[640px] bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative">
            <PotholeMap
              potholes={potholes}
              selectedPothole={selectedPothole}
              onSelectPothole={(p) => setSelectedPothole(p)}
              isReportMode={isMapPickerMode}
              reportLocation={pickedLocation}
              onReportLocationSelect={handleMapLocationSelect}
            />
          </div>
        )}

        {/* Tab 2: Directory Table View */}
        {!loading && !error && activeTab === 'list' && (
          <div className="flex-1">
            <PublicTableView
              potholes={potholes}
              onSelectPothole={(p) => setSelectedPothole(p)}
            />
          </div>
        )}
      </main>

      {/* Pothole Detail Modal / Drawer */}
      {selectedPothole && (
        <PotholeDetailModal
          pothole={selectedPothole}
          onClose={() => setSelectedPothole(null)}
        />
      )}

      {/* Citizen Report Modal */}
      <ReportPotholeModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialLocation={pickedLocation}
        onOpenMapPicker={() => {
          setActiveTab('map');
          setIsMapPickerMode(true);
        }}
      />
    </div>
  );
}

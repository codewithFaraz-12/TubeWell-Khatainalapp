import React, { useState } from 'react';
import { KhataProvider, useKhata } from './context/KhataContext';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { HomeScreen } from './views/HomeScreen';
import { InvoicesView } from './views/InvoicesView';
import { InsightsView } from './views/InsightsView';
import { SettingsView } from './views/SettingsView';
import { CustomerLedgerView } from './components/CustomerLedgerView';
import { AddCustomerModal } from './components/AddCustomerModal';
import { AddWaterRecordModal } from './components/AddWaterRecordModal';
import { PinLockScreen } from './components/PinLockScreen';
import { Customer, WaterRecord } from './types';
import { Droplets, CloudUpload, ShieldCheck, RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    isLoading,
    settings,
    selectedCustomerId,
    setSelectedCustomerId,
    selectedCustomer,
    customers,
    waterRecords,
    payments,
    googleUser,
    isMigrationPromptOpen,
    confirmMigration,
    cancelMigration,
  } = useKhata();

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => !settings.pinLock.enabled);
  const [isMigratingInProgress, setIsMigratingInProgress] = useState<boolean>(false);

  // Global modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddWaterOpen, setIsAddWaterOpen] = useState(false);
  const [prefilledCustomerId, setPrefilledCustomerId] = useState<string | undefined>(undefined);
  const [editingWaterRecord, setEditingWaterRecord] = useState<WaterRecord | null>(null);

  // When settings change to PIN enabled
  const shouldShowLock = settings.pinLock.enabled && !isUnlocked;

  const handleOpenCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
  };

  const handleOpenAddWater = (customerId?: string, recordToEdit?: WaterRecord) => {
    setPrefilledCustomerId(customerId);
    setEditingWaterRecord(recordToEdit || null);
    setIsAddWaterOpen(true);
  };

  const handleOpenStatementFromLedger = (customerId: string) => {
    setSelectedCustomerId(null);
    setActiveTab('invoices');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-3xl bg-[#087C71] flex items-center justify-center shadow-xl shadow-teal-900/30 mb-4 animate-bounce">
          <Droplets className="w-8 h-8 text-white fill-white/30" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">
          TubeWell Khata
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Loading persistent irrigation ledger...
        </p>
      </div>
    );
  }

  if (shouldShowLock) {
    return (
      <PinLockScreen
        correctPin={settings.pinLock.pin}
        appName={settings.tubeWellName || 'TubeWell Khata'}
        onUnlocked={() => setIsUnlocked(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-teal-700 selection:text-white">
      {/* If a customer is opened, show their dedicated ledger screen */}
      {selectedCustomer ? (
        <CustomerLedgerView
          customer={selectedCustomer}
          onBack={() => setSelectedCustomerId(null)}
          onOpenStatement={handleOpenStatementFromLedger}
        />
      ) : (
        <>
          {/* Top Header */}
          <Header onOpenQuickWater={() => handleOpenAddWater()} />

          {/* Tab Views */}
          <main className="flex-1 overflow-x-hidden">
            {activeTab === 'home' && (
              <HomeScreen
                onOpenCustomer={handleOpenCustomer}
                onOpenAddCustomer={() => setIsAddCustomerOpen(true)}
                onOpenAddWater={handleOpenAddWater}
              />
            )}

            {activeTab === 'invoices' && (
              <InvoicesView initialCustomerId={prefilledCustomerId} />
            )}

            {activeTab === 'insights' && (
              <InsightsView
                onSelectCustomer={(id) => {
                  setSelectedCustomerId(id);
                }}
              />
            )}

            {activeTab === 'settings' && <SettingsView />}
          </main>

          {/* Bottom Navigation */}
          <BottomNav
            activeTab={activeTab}
            onSelectTab={(tab) => {
              setSelectedCustomerId(null);
              setActiveTab(tab);
            }}
          />
        </>
      )}

      {/* Global Add Customer Modal */}
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
      />

      {/* Global Add Water Record Modal */}
      <AddWaterRecordModal
        isOpen={isAddWaterOpen}
        onClose={() => {
          setIsAddWaterOpen(false);
          setPrefilledCustomerId(undefined);
          setEditingWaterRecord(null);
        }}
        initialCustomerId={prefilledCustomerId}
        recordToEdit={editingWaterRecord}
      />

      {/* Explicit User Confirmation Modal for Local Records Cloud Migration */}
      {isMigrationPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="w-12 h-12 mx-auto bg-teal-50 dark:bg-teal-950/70 text-[#087C71] rounded-2xl flex items-center justify-center shadow-xs">
              <CloudUpload className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Upload Records to Google Cloud?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connected: <span className="font-semibold text-slate-700 dark:text-slate-300">{googleUser?.email}</span>
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Farmers / Customers:</span>
                <span className="font-bold text-slate-900 dark:text-white">{customers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Water Irrigation Entries:</span>
                <span className="font-bold text-slate-900 dark:text-white">{waterRecords.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Entries:</span>
                <span className="font-bold text-slate-900 dark:text-white">{payments.length}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-teal-800 dark:text-teal-300 font-medium bg-teal-50 dark:bg-teal-950/50 p-2.5 rounded-xl border border-teal-200/50 dark:border-teal-900/50">
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#087C71] mt-0.5" />
              <span>Existing records on this phone are protected. If you sign in on another phone with this Gmail, all records will be automatically available.</span>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={cancelMigration}
                disabled={isMigratingInProgress}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Keep Local Only
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsMigratingInProgress(true);
                  try {
                    await confirmMigration();
                  } finally {
                    setIsMigratingInProgress(false);
                  }
                }}
                disabled={isMigratingInProgress}
                className="flex-1 py-2.5 bg-[#087C71] hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {isMigratingInProgress ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>Upload & Sync</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <KhataProvider>
      <AppContent />
    </KhataProvider>
  );
}

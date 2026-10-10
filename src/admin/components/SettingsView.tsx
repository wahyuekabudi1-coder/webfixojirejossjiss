import React, { useState, useMemo, useEffect } from 'react';
import { 
  Settings, Shield, User, Key, Save, Check, X, ShieldAlert, 
  Building, Lock, LogOut, CheckCircle2, AlertCircle, RefreshCw, 
  Eye, EyeOff, Sparkles, UserCheck, HelpCircle, Compass, Truck, 
  DollarSign, Globe, Layers, Phone, Mail, MapPin, ExternalLink, 
  ShieldCheck, Plane
} from 'lucide-react';
import { 
  RolePermissions, 
  CANONICAL_ROLES, 
  getStoredRoles, 
  saveStoredRoles, 
  getActiveRole, 
  saveActiveRole,
  checkModulePermission,
  checkSubItemPermission
} from '../../utils/rbac';
import { getAdminHeaders, handleAdminResponse } from '../../utils/adminAuth';

interface SettingsViewProps {
  theme: any;
  isDark?: boolean;
  activeTab: 'general' | 'rbac' | 'account';
  setActiveTab: (tab: 'general' | 'rbac' | 'account') => void;
  triggerToast: (msg: string) => void;
  serviceLimits: {
    tour?: number;
    airport?: number;
    taxi?: number;
    rental?: number;
    [key: string]: number | undefined;
  };
  setServiceLimit: (type: 'tour' | 'airport' | 'taxi' | 'rental' | string, limit: number) => Promise<void>;
  currentRole: string;
  setCurrentRole: (role: string) => void;
  onLogout: () => void;
  adminEmail?: string;
  accountSubTab?: 'profile' | 'password' | 'logout';
  setAccountSubTab?: (tab: 'profile' | 'password' | 'logout') => void;
}

export default function SettingsView({
  theme,
  isDark = false,
  activeTab,
  setActiveTab,
  triggerToast,
  serviceLimits,
  setServiceLimit,
  currentRole,
  setCurrentRole,
  onLogout,
  adminEmail = 'sawahjayagroup@gmail.com',
  accountSubTab,
  setAccountSubTab
}: SettingsViewProps) {
  // ---------------------------------------------------------------------------
  // 1. RBAC PERMISSION ENFORCEMENT FOR SETTINGS MODULE
  // ---------------------------------------------------------------------------
  const [roles, setRoles] = useState<RolePermissions[]>(() => getStoredRoles());

  const canManageSettings = useMemo(() => {
    return checkModulePermission('settings', currentRole, roles);
  }, [currentRole, roles]);

  // ---------------------------------------------------------------------------
  // 2. GENERAL & LIMITS STATE
  // ---------------------------------------------------------------------------
  const [isSavingLimits, setIsSavingLimits] = useState(false);
  const [savingService, setSavingService] = useState<string | null>(null);
  const [localLimits, setLocalLimits] = useState({
    tour: serviceLimits?.tour ?? 5,
    airport: serviceLimits?.airport ?? 5,
    taxi: serviceLimits?.taxi ?? 5,
    rental: serviceLimits?.rental ?? 5
  });

  // Keep local limits in sync when external serviceLimits prop updates
  useEffect(() => {
    if (serviceLimits) {
      setLocalLimits({
        tour: serviceLimits.tour ?? 5,
        airport: serviceLimits.airport ?? 5,
        taxi: serviceLimits.taxi ?? 5,
        rental: serviceLimits.rental ?? 5
      });
    }
  }, [serviceLimits?.tour, serviceLimits?.airport, serviceLimits?.taxi, serviceLimits?.rental]);

  const handleUpdateLimitInput = (serviceType: 'tour' | 'airport' | 'taxi' | 'rental', val: number) => {
    const clamped = Math.max(1, Math.min(100, val || 1));
    setLocalLimits(prev => ({ ...prev, [serviceType]: clamped }));
  };

  const handleSaveSingleLimit = async (serviceType: 'tour' | 'airport' | 'taxi' | 'rental') => {
    if (!canManageSettings) {
      triggerToast('Akses ditolak: Izin manageSettings diperlukan untuk mengubah batas operasional.');
      return;
    }
    setSavingService(serviceType);
    try {
      await setServiceLimit(serviceType, localLimits[serviceType]);
      triggerToast(`Batas kapasitas ${serviceType.toUpperCase()} berhasil disimpan!`);
    } catch (err) {
      console.error(`Error saving limit for ${serviceType}:`, err);
      triggerToast(`Gagal menyimpan batas operasional ${serviceType}.`);
    } finally {
      setSavingService(null);
    }
  };

  const handleSaveAllLimits = async () => {
    if (!canManageSettings) {
      triggerToast('Akses ditolak: Izin manageSettings diperlukan untuk mengubah batas operasional.');
      return;
    }
    setIsSavingLimits(true);
    try {
      // Execute sequential saves to prevent state closure race conditions
      await setServiceLimit('tour', localLimits.tour);
      await setServiceLimit('airport', localLimits.airport);
      await setServiceLimit('taxi', localLimits.taxi);
      await setServiceLimit('rental', localLimits.rental);
      triggerToast('Seluruh kapasitas batas operasional berhasil disimpan ke database!');
    } catch (err) {
      console.error('Error saving operational limits:', err);
      triggerToast('Gagal menyimpan batas operasional ke server.');
    } finally {
      setIsSavingLimits(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. STAFF ROLES & RBAC MATRIX ACTIONS
  // ---------------------------------------------------------------------------
  const togglePermission = (roleIndex: number, permissionKey: keyof RolePermissions['permissions']) => {
    if (!canManageSettings) {
      triggerToast('Akses ditolak: Hanya peran dengan izin manageSettings yang dapat mengubah matriks RBAC.');
      return;
    }

    // Prevent locking out Super Administrator from manageSettings to protect system integrity
    if (roles[roleIndex].role === 'Super Administrator' && permissionKey === 'manageSettings') {
      triggerToast('Izin manageSettings untuk Super Administrator tidak dapat dinonaktifkan.');
      return;
    }

    const updated = [...roles];
    updated[roleIndex] = {
      ...updated[roleIndex],
      permissions: {
        ...updated[roleIndex].permissions,
        [permissionKey]: !updated[roleIndex].permissions[permissionKey]
      }
    };
    setRoles(updated);
    saveStoredRoles(updated);
    triggerToast(`Izin "${permissionKey}" untuk ${roles[roleIndex].role} diperbarui!`);
  };

  const handleSelectActiveRole = (roleName: string) => {
    setCurrentRole(roleName);
    saveActiveRole(roleName);
    triggerToast(`Peran staf aktif portal beralih ke: ${roleName}`);
  };

  const handleResetRBACDefaults = () => {
    if (!canManageSettings) {
      triggerToast('Akses ditolak: Anda tidak memiliki izin manageSettings.');
      return;
    }
    if (confirm('Kembalikan semua role dan izin ke setelan awal sistem?')) {
      setRoles(CANONICAL_ROLES);
      saveStoredRoles(CANONICAL_ROLES);
      triggerToast('Konfigurasi RBAC dikembalikan ke setelan awal sistem.');
    }
  };

  // ---------------------------------------------------------------------------
  // 4. ACCOUNT PROFILE & SECURITY STATE
  // ---------------------------------------------------------------------------
  const [internalAccountSubTab, setInternalAccountSubTab] = useState<'profile' | 'password' | 'logout'>('profile');
  const activeAccountSubTab = accountSubTab ?? internalAccountSubTab;
  const setActiveAccountSubTab = setAccountSubTab ?? setInternalAccountSubTab;

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) {
      triggerToast('Masukkan kata sandi saat ini.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      triggerToast('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      triggerToast('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword
        })
      });

      const data = await handleAdminResponse(res, 'Gagal mengubah kata sandi pada server.');
      triggerToast(data.message || 'Kata sandi operasional admin berhasil diverifikasi dan diperbarui di database server!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      console.error('Password change error:', err);
      triggerToast(err.message || 'Gagal mengubah kata sandi.');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* ------------------------------------------------------------------- */}
      {/* HEADER & MODULE SUB-NAV                                             */}
      {/* ------------------------------------------------------------------- */}
      <div className={`p-4 rounded-2xl border ${theme.card} flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm`}>
        <div className="space-y-0.5">
          <h3 className="text-sm font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>PORTAL SETTINGS &amp; RBAC HUB</span>
          </h3>
          <p className={`text-xs ${theme.textSecondary}`}>
            Konfigurasi batas kapasitas operasional harian, kontrol hak akses staf (RBAC), dan profil keamanan akun staf terautentikasi.
          </p>
        </div>

        <div className={`flex items-center gap-1.5 p-1 rounded-xl ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-100 border-slate-200'} border shrink-0`}>
          <button
            onClick={() => {
              if (!canManageSettings) {
                triggerToast('Izin manageSettings diperlukan untuk membuka General & Limits.');
                return;
              }
              setActiveTab('general');
            }}
            disabled={!canManageSettings}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !canManageSettings
                ? 'opacity-40 cursor-not-allowed text-neutral-500'
                : activeTab === 'general'
                ? 'bg-amber-500 text-neutral-950 font-black shadow-sm cursor-pointer'
                : isDark
                ? 'text-neutral-400 hover:text-white cursor-pointer'
                : 'text-neutral-600 hover:text-neutral-900 cursor-pointer'
            }`}
            title={!canManageSettings ? 'Terkunci: Memerlukan izin manageSettings' : undefined}
          >
            <Building className="h-3.5 w-3.5" />
            <span>General &amp; Limits</span>
            {!canManageSettings && <Lock className="h-2.5 w-2.5 text-neutral-500 ml-1" />}
          </button>
          
          <button
            onClick={() => {
              if (!canManageSettings) {
                triggerToast('Izin manageSettings diperlukan untuk membuka Staff Roles (RBAC).');
                return;
              }
              setActiveTab('rbac');
            }}
            disabled={!canManageSettings}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !canManageSettings
                ? 'opacity-40 cursor-not-allowed text-neutral-500'
                : activeTab === 'rbac'
                ? 'bg-amber-500 text-neutral-950 font-black shadow-sm cursor-pointer'
                : isDark
                ? 'text-neutral-400 hover:text-white cursor-pointer'
                : 'text-neutral-600 hover:text-neutral-900 cursor-pointer'
            }`}
            title={!canManageSettings ? 'Terkunci: Memerlukan izin manageSettings' : undefined}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Staff Roles (RBAC)</span>
            {!canManageSettings && <Lock className="h-2.5 w-2.5 text-neutral-500 ml-1" />}
          </button>
          
          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'account'
                ? 'bg-amber-500 text-neutral-950 font-black shadow-sm'
                : isDark
                ? 'text-neutral-400 hover:text-white'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Account &amp; Security</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* RBAC GUARD BANNER FOR NON-ADMINISTRATOR ROLES                       */}
      {/* =================================================================== */}
      {!canManageSettings && activeTab !== 'account' ? (
        <div className="p-8 rounded-2xl border border-rose-500/30 bg-rose-500/5 space-y-4 max-w-xl mx-auto my-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black font-mono uppercase text-rose-400">
              Akses Modul Pengaturan Terbatas (RBAC Protected)
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Peran staf aktif Anda (<strong className="text-neutral-200">{currentRole}</strong>) tidak memiliki izin <strong>manageSettings</strong> untuk mengonfigurasi batas operasional atau hak akses staf.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => setActiveTab('account')}
              className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 text-xs font-black cursor-pointer transition-all shadow-sm flex items-center gap-2 mx-auto active:scale-95"
            >
              <User className="h-3.5 w-3.5" />
              <span>Buka Profil Akun &amp; Keamanan Saya</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* =================================================================== */}
          {/* SUBTAB 1: GENERAL & OPERATIONAL LIMITS                             */}
          {/* =================================================================== */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className={`${theme.card} border rounded-2xl p-6 space-y-6`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-neutral-850 pb-4">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest font-mono text-amber-500">
                      Operational Capacity Limits (Batas Kuota Harian)
                    </h4>
                    <p className={`text-xs mt-0.5 ${theme.textSecondary}`}>
                      Batas kuota harian yang langsung mengontrol validasi kalender reservasi admin dan formulir checkout pelanggan di database.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 font-bold">
                      ✓ Terhubung ke Database Server (/api/service-limits)
                    </span>
                  </div>
                </div>

                {/* Service Limits Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* 1. Private Tour */}
                  <div className={`p-4 rounded-xl border ${theme.innerCard} space-y-3`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-extrabold flex items-center gap-1.5 ${isDark ? 'text-neutral-200' : 'text-slate-900'}`}>
                        <Compass className="h-3.5 w-3.5 text-amber-500" />
                        <span>Private Tour</span>
                      </span>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>Slots / Hari</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min={1}
                        max={100}
                        value={localLimits.tour} 
                        onChange={(e) => handleUpdateLimitInput('tour', parseInt(e.target.value, 10))}
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:border-amber-500`} 
                      />
                      <button
                        onClick={() => handleSaveSingleLimit('tour')}
                        disabled={savingService === 'tour'}
                        title="Simpan Batas Tour"
                        className={`p-2 rounded-xl ${isDark ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-slate-200 hover:bg-slate-300 shadow-2xs'} text-amber-500 cursor-pointer transition-all shrink-0 disabled:opacity-50`}
                      >
                        {savingService === 'tour' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-slate-500'} leading-tight`}>
                      Konsumen: Form reservasi Private Tour, TourDetailView, dan batasan jadwal harian.
                    </p>
                  </div>

                  {/* 2. Airport Transfer */}
                  <div className={`p-4 rounded-xl border ${theme.innerCard} space-y-3`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-extrabold flex items-center gap-1.5 ${isDark ? 'text-neutral-200' : 'text-slate-900'}`}>
                        <Plane className="h-3.5 w-3.5 text-sky-400" />
                        <span>Airport Transfer</span>
                      </span>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>Armada / Hari</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min={1}
                        max={100}
                        value={localLimits.airport} 
                        onChange={(e) => handleUpdateLimitInput('airport', parseInt(e.target.value, 10))}
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:border-amber-500`} 
                      />
                      <button
                        onClick={() => handleSaveSingleLimit('airport')}
                        disabled={savingService === 'airport'}
                        title="Simpan Batas Airport"
                        className={`p-2 rounded-xl ${isDark ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-slate-200 hover:bg-slate-300 shadow-2xs'} text-sky-500 cursor-pointer transition-all shrink-0 disabled:opacity-50`}
                      >
                        {savingService === 'airport' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-slate-500'} leading-tight`}>
                      Konsumen: AirportBookingCalendar &amp; kuota armada jemput/antar bandara.
                    </p>
                  </div>

                  {/* 3. Taxi Service */}
                  <div className={`p-4 rounded-xl border ${theme.innerCard} space-y-3`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-extrabold flex items-center gap-1.5 ${isDark ? 'text-neutral-200' : 'text-slate-900'}`}>
                        <Truck className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Taxi Service</span>
                      </span>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>Antar-Jemput / Hari</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min={1}
                        max={100}
                        value={localLimits.taxi} 
                        onChange={(e) => handleUpdateLimitInput('taxi', parseInt(e.target.value, 10))}
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:border-amber-500`} 
                      />
                      <button
                        onClick={() => handleSaveSingleLimit('taxi')}
                        disabled={savingService === 'taxi'}
                        title="Simpan Batas Taxi"
                        className={`p-2 rounded-xl ${isDark ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-slate-200 hover:bg-slate-300 shadow-2xs'} text-emerald-500 cursor-pointer transition-all shrink-0 disabled:opacity-50`}
                      >
                        {savingService === 'taxi' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-slate-500'} leading-tight`}>
                      Konsumen: TaxiBookingCalendar &amp; alokasi keberangkatan taksi kota harian.
                    </p>
                  </div>

                  {/* 4. Car Rental */}
                  <div className={`p-4 rounded-xl border ${theme.innerCard} space-y-3`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-extrabold flex items-center gap-1.5 ${isDark ? 'text-neutral-200' : 'text-slate-900'}`}>
                        <Layers className="h-3.5 w-3.5 text-purple-400" />
                        <span>Car Rental</span>
                      </span>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>Unit Sewa / Hari</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min={1}
                        max={100}
                        value={localLimits.rental} 
                        onChange={(e) => handleUpdateLimitInput('rental', parseInt(e.target.value, 10))}
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:border-amber-500`} 
                      />
                      <button
                        onClick={() => handleSaveSingleLimit('rental')}
                        disabled={savingService === 'rental'}
                        title="Simpan Batas Rental"
                        className={`p-2 rounded-xl ${isDark ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-slate-200 hover:bg-slate-300 shadow-2xs'} text-purple-500 cursor-pointer transition-all shrink-0 disabled:opacity-50`}
                      >
                        {savingService === 'rental' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-neutral-500 leading-tight">
                      Konsumen: RentalBookingCalendar, CarRentalView, &amp; RentalAdminWorkspace.
                    </p>
                  </div>
                </div>

                {/* Operational Constants Display */}
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                  <h5 className="text-xs font-bold text-neutral-300 uppercase font-mono tracking-wider flex items-center gap-2">
                    <Building className="h-3.5 w-3.5 text-amber-500" />
                    <span>Parameter Operasional Sistem Terpasang</span>
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800">
                      <span className="text-[10px] text-neutral-500 uppercase font-mono block">Entitas Badan Usaha</span>
                      <span className="font-bold text-neutral-200">PT Sawajaya Trans (Smart Journey)</span>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800">
                      <span className="text-[10px] text-neutral-500 uppercase font-mono block">Gerbang Pembayaran Otomatis</span>
                      <span className="font-bold text-amber-400 font-mono">ArtoPay Dynamic QRIS &amp; VA</span>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800">
                      <span className="text-[10px] text-neutral-500 uppercase font-mono block">Status Proteksi API</span>
                      <span className="font-bold text-emerald-400 font-mono">Server-Side Bearer Auth</span>
                    </div>
                  </div>
                </div>

                {/* Save Limits Action Button */}
                <div className="pt-2 flex justify-end">
                  <button 
                    onClick={handleSaveAllLimits}
                    disabled={isSavingLimits}
                    className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSavingLimits ? 'Menyimpan Semua...' : 'Simpan Semua Batas Operasional'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* SUBTAB 2: STAFF ROLES & RBAC MATRIX                                */}
          {/* =================================================================== */}
          {activeTab === 'rbac' && (
            <div className="space-y-6">
              <div className={`${theme.card} border rounded-2xl p-6 space-y-6`}>
                {/* Active Role Selector Card */}
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-amber-500 font-bold block">
                      Peran Staf Aktif Saat Ini
                    </span>
                    <h4 className="text-base font-black text-neutral-100 flex items-center gap-2">
                      <UserCheck className="h-4.5 w-4.5 text-amber-500" />
                      <span>{currentRole}</span>
                    </h4>
                    <p className={`text-xs ${theme.textSecondary}`}>
                      {roles.find(r => r.role === currentRole)?.description || 'Hak akses penuh ke portal admin.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className={`text-xs font-bold ${isDark ? 'text-neutral-400' : 'text-slate-700'}`}>Ganti Peran Uji:</label>
                    <select
                      value={currentRole}
                      onChange={(e) => handleSelectActiveRole(e.target.value)}
                      className={`border rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer focus:outline-none focus:border-amber-500 ${
                        isDark 
                          ? 'bg-neutral-900 border-neutral-700 text-amber-400' 
                          : 'bg-white border-slate-300 text-slate-800 shadow-xs'
                      }`}
                    >
                      {roles.map(r => (
                        <option key={r.role} value={r.role}>
                          {r.role} ({r.department})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* RBAC Matrix Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-neutral-850 pb-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest font-mono text-amber-500 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-amber-500" />
                      <span>Matriks Hak Akses Staf (RBAC Enforcement)</span>
                    </h4>
                    <p className={`text-xs ${theme.textSecondary}`}>
                      Setiap peran staf membatasi akses menu di sidebar dan proteksi rute di dalam portal admin.
                    </p>
                  </div>

                  <button
                    onClick={handleResetRBACDefaults}
                    className={`text-[11px] font-bold ${
                      isDark 
                        ? 'text-neutral-300 hover:text-white border-neutral-700/60 hover:bg-neutral-800' 
                        : 'text-slate-700 hover:text-slate-900 border-slate-300 hover:bg-slate-100 bg-white'
                    } px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5`}
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Reset Default</span>
                  </button>
                </div>

                {/* RBAC Table Matrix */}
                <div className={`overflow-x-auto no-scrollbar border rounded-2xl ${isDark ? 'border-neutral-800' : 'border-neutral-200 shadow-xs'}`}>
                  <table className="w-full text-left text-xs">
                    <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase ${isDark ? 'text-neutral-400' : 'text-slate-700'} font-black`}>
                      <tr>
                        <th className="p-3.5">Peran &amp; Divisi</th>
                        <th className="p-3.5 text-center">Pesanan &amp; Ops<br/><span className={`text-[9px] font-normal ${isDark ? 'text-neutral-500' : 'text-slate-500'}`}>manageBookings</span></th>
                        <th className="p-3.5 text-center">Paket Tur<br/><span className={`text-[9px] font-normal ${isDark ? 'text-neutral-500' : 'text-slate-500'}`}>manageTours</span></th>
                        <th className="p-3.5 text-center">Armada Fleet<br/><span className={`text-[9px] font-normal ${isDark ? 'text-neutral-500' : 'text-slate-500'}`}>manageFleet</span></th>
                        <th className="p-3.5 text-center">Finansial<br/><span className={`text-[9px] font-normal ${isDark ? 'text-neutral-500' : 'text-slate-500'}`}>manageFinance</span></th>
                        <th className="p-3.5 text-center">Marketing CMS<br/><span className={`text-[9px] font-normal ${isDark ? 'text-neutral-500' : 'text-slate-500'}`}>manageCMS</span></th>
                        <th className="p-3.5 text-center">Pengaturan<br/><span className={`text-[9px] font-normal ${isDark ? 'text-neutral-500' : 'text-slate-500'}`}>manageSettings</span></th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-neutral-850' : 'divide-neutral-200'}`}>
                      {roles.map((r, roleIdx) => {
                        const isCurrent = r.role === currentRole;
                        return (
                          <tr key={r.role} className={`${isCurrent ? 'bg-amber-500/5' : theme.hover} transition-colors`}>
                            <td className="p-3.5">
                              <div className="flex items-center gap-2">
                                <span className={`font-bold text-xs ${isDark ? 'text-neutral-200' : 'text-slate-900'}`}>
                                  {r.role}
                                </span>
                                {isCurrent && (
                                  <span className="text-[9px] font-mono font-black bg-amber-500 text-neutral-950 px-1.5 py-0.5 rounded">
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              <span className={`text-[10px] font-mono block mt-0.5 ${isDark ? 'text-neutral-400' : 'text-slate-600'}`}>
                                {r.department}
                              </span>
                            </td>

                            {(['manageBookings', 'manageTours', 'manageFleet', 'manageFinance', 'manageCMS', 'manageSettings'] as const).map((permKey) => {
                              const isAllowed = r.permissions[permKey];
                              const isLockedSuperAdminSettings = r.role === 'Super Administrator' && permKey === 'manageSettings';

                              return (
                                <td key={permKey} className="p-3.5 text-center">
                                  <button
                                    onClick={() => togglePermission(roleIdx, permKey)}
                                    disabled={isLockedSuperAdminSettings}
                                    className={`p-1.5 rounded-lg transition-all ${
                                      isLockedSuperAdminSettings
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-not-allowed opacity-90'
                                        : isAllowed 
                                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 cursor-pointer' 
                                        : isDark
                                        ? 'bg-neutral-800/80 text-neutral-400 border border-neutral-700/50 hover:bg-neutral-800 cursor-pointer'
                                        : 'bg-slate-100 text-slate-400 border border-slate-300 hover:bg-slate-200 hover:text-slate-600 cursor-pointer'
                                    }`}
                                    title={isLockedSuperAdminSettings ? 'Super Administrator harus selalu memiliki izin manageSettings' : `Ubah izin ${permKey}`}
                                  >
                                    {isAllowed ? (
                                      <Check className="h-4 w-4 stroke-[3]" />
                                    ) : (
                                      <X className={`h-4 w-4 ${isDark ? 'text-neutral-400' : 'text-slate-500'}`} />
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Permission Mapping Legend */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2">
                  <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-amber-500 font-bold block">
                      manageBookings
                    </span>
                    <p className="text-[11px] text-neutral-400">
                      Mengakses Orders (pesanan masuk, verifikasi), Operations (jadwal keberangkatan, manifest), dan direktori Customers.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-amber-500 font-bold block">
                      manageFinance &amp; manageCMS
                    </span>
                    <p className="text-[11px] text-neutral-400">
                      manageFinance: Transaksi ArtoPay, invoice resmi, pembukuan kas.<br/>
                      manageCMS: Voucher diskon, moderasi ulasan, dan mitra partner.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-amber-500 font-bold block">
                      manageSettings
                    </span>
                    <p className="text-[11px] text-neutral-400">
                      Mengubah kapasitas operasional harian terpasang di database dan matriks izin RBAC staf.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* SUBTAB 3: ACCOUNT & SECURITY                                        */}
          {/* =================================================================== */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-black tracking-tight font-mono text-amber-500">
                  ACCOUNT SETTINGS &amp; SECURITY
                </h2>
                <p className={`text-xs ${theme.textSecondary}`}>
                  Informasi akun administrator terautentikasi, manajemen kata sandi akses portal, dan penutupan sesi aman.
                </p>
              </div>

              {/* Sub Navigation */}
              <div className="flex gap-2 border-b border-neutral-850 pb-px overflow-x-auto no-scrollbar">
                {[
                  { id: 'profile', label: 'Profil Saya', icon: User },
                  { id: 'password', label: 'Keamanan / Ganti Sandi', icon: Key },
                  { id: 'logout', label: 'Keluar Sesi', icon: LogOut }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveAccountSubTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        activeAccountSubTab === tab.id 
                          ? 'border-amber-500 text-amber-500 font-extrabold' 
                          : isDark
                          ? 'border-transparent text-neutral-400 hover:text-white'
                          : 'border-transparent text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Card: Staff Badge */}
                <div className={`${theme.card} border rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4`}>
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-neutral-950 font-black text-2xl font-mono shadow-xl ring-4 ring-amber-500/10">
                    AD
                  </div>
                  <div className="space-y-0.5">
                    <h4 className={`text-base font-black ${isDark ? 'text-white' : 'text-neutral-900'}`}>Smart Journey Administrator</h4>
                    <p className={`text-xs ${theme.textSecondary} font-mono`}>{adminEmail}</p>
                  </div>
                  <span className="text-[10px] font-mono font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full uppercase flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Verified Staff Session</span>
                  </span>
                  <div className="pt-2 border-t border-neutral-800 w-full text-left space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-mono text-[10px]">Peran Aktif:</span>
                      <span className="font-bold text-amber-400 font-mono">{currentRole}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-mono text-[10px]">ID Karyawan:</span>
                      <span className="font-mono text-neutral-300">SJT-2026-HQ</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-mono text-[10px]">Protokol:</span>
                      <span className="font-mono text-emerald-400">Bearer Token Auth</span>
                    </div>
                  </div>
                </div>

                {/* Right Card: Dynamic Sub Tab Panel */}
                <div className={`lg:col-span-2 ${theme.card} border rounded-2xl p-6 space-y-6`}>
                  {/* Profile Details */}
                  {activeAccountSubTab === 'profile' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest font-mono text-amber-500 border-b border-neutral-850 pb-2">
                        Profil Personal Administrator
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className={`text-[10px] font-black uppercase ${isDark ? 'text-neutral-400' : 'text-slate-700'}`}>Nama Lengkap Staff</label>
                          <input 
                            type="text" 
                            readOnly 
                            defaultValue="Smart Journey Administrator" 
                            className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs`} 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[10px] font-black uppercase ${isDark ? 'text-neutral-400' : 'text-slate-700'}`}>Alamat Email Resmi</label>
                          <input 
                            type="email" 
                            readOnly 
                            defaultValue={adminEmail} 
                            className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs font-mono`} 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[10px] font-black uppercase ${isDark ? 'text-neutral-400' : 'text-slate-700'}`}>Nomor WhatsApp Operasional</label>
                          <input 
                            type="text" 
                            readOnly 
                            defaultValue="+62 852-1234-7289" 
                            className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs font-mono`} 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[10px] font-black uppercase ${isDark ? 'text-neutral-400' : 'text-slate-700'}`}>Divisi Penugasan</label>
                          <input 
                            type="text" 
                            readOnly 
                            defaultValue="Central Operational &amp; Executive HQ" 
                            className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs`} 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Password Change */}
                  {activeAccountSubTab === 'password' && (
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest font-mono text-amber-500 border-b border-neutral-850 pb-2">
                        Ubah Kata Sandi Akses Portal Admin
                      </h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className={`text-[10px] font-black uppercase ${isDark ? 'text-neutral-400' : 'text-slate-700'}`}>Sandi Saat Ini *</label>
                          <input 
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            placeholder="••••••••" 
                            className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs`} 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[10px] font-black uppercase ${isDark ? 'text-neutral-400' : 'text-slate-700'}`}>Sandi Baru (Min. 6 Karakter) *</label>
                          <input 
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            placeholder="••••••••" 
                            className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs`} 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[10px] font-black uppercase ${isDark ? 'text-neutral-400' : 'text-slate-700'}`}>Konfirmasi Sandi Baru *</label>
                          <input 
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            placeholder="••••••••" 
                            className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs`} 
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className={`text-xs ${isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'} flex items-center gap-1.5 cursor-pointer`}
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          <span>{showPassword ? 'Sembunyikan Karakter' : 'Tampilkan Karakter'}</span>
                        </button>

                        <button 
                          type="submit"
                          disabled={isSubmittingPassword}
                          className={`bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                            isSubmittingPassword ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <Save className="h-4 w-4" />
                          <span>{isSubmittingPassword ? 'Memperbarui...' : 'Perbarui Sandi'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Logout Session */}
                  {activeAccountSubTab === 'logout' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest font-mono text-amber-500 border-b border-neutral-850 pb-2">
                        Keluar Sesi Portal Admin
                      </h4>
                      <p className={`text-xs ${theme.textSecondary} leading-relaxed`}>
                        Menutup sesi admin aktif, mengakhiri session token pada database server via endpoint <code>/api/auth/logout</code>, dan mengamankan kembali portal ke layar login kunci.
                      </p>
                      <div className="pt-3">
                        <button 
                          onClick={onLogout}
                          className="px-5 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 transition-all font-black text-xs cursor-pointer flex items-center gap-2 active:scale-95 shadow-sm"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Keluar Sesi Sekarang</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

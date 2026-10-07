import React from 'react';
import { 
  LayoutDashboard, ClipboardList, CalendarDays, Layers, Users, 
  DollarSign, BarChart3, Sparkles, Settings, ChevronLeft, ChevronRight, 
  LogOut, Globe, CheckCircle2, AlertTriangle, FileText, Compass, 
  Plane, MapPin, Truck, CreditCard, Receipt, TrendingUp, Tag, Shield, 
  Clock, ShieldAlert, ArrowUpRight, UserCheck, Lock
} from 'lucide-react';
import { checkModulePermission, checkSubItemPermission } from '../../utils/rbac';

export type AdminModule = 
  | 'dashboard'
  | 'orders'
  | 'operations'
  | 'services'
  | 'customers'
  | 'finance'
  | 'analytics'
  | 'marketing'
  | 'settings'
  | 'account';

export type AdminTab = AdminModule | string;

export interface NavGroupItem {
  id: AdminModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeColor?: string;
  subItems?: {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    badge?: number;
    group?: string;
  }[];
}

interface SidebarProps {
  activeModule: AdminModule;
  setActiveModule: (module: AdminModule) => void;
  activeSubItem?: string;
  setActiveSubItem?: (subItem: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  pendingConfirmationCount: number;
  pendingPaymentCount?: number;
  onExit: () => void;
  role?: string;
  isDark?: boolean;
  // Backward compatibility props
  activeTab?: any;
  setActiveTab?: (tab: any) => void;
  pendingBookingsCount?: number;
}

export default function Sidebar({ 
  activeModule, 
  setActiveModule, 
  activeSubItem,
  setActiveSubItem,
  collapsed, 
  setCollapsed, 
  pendingConfirmationCount,
  pendingPaymentCount = 0,
  onExit,
  role = 'central',
  isDark = false,
  activeTab,
  setActiveTab,
  pendingBookingsCount
}: SidebarProps) {
  // Support both activeModule and legacy activeTab
  const currentModule = activeModule || (activeTab as AdminModule) || 'dashboard';
  const handleSelectModule = (mod: AdminModule) => {
    if (setActiveModule) setActiveModule(mod);
    if (setActiveTab) setActiveTab(mod);
  };

  const effectivePendingCount = pendingConfirmationCount ?? pendingBookingsCount ?? 0;

  // The 9 canonical Admin sections defined in the specifications
  const navSections: { label: string; items: NavGroupItem[] }[] = [
    {
      label: 'OVERVIEW',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard
        }
      ]
    },
    {
      label: 'TRANSAKSI & OPERASIONAL',
      items: [
        {
          id: 'orders',
          label: 'Orders',
          icon: ClipboardList,
          badge: effectivePendingCount > 0 ? effectivePendingCount : undefined,
          badgeColor: 'bg-amber-500 text-neutral-950 font-black',
          subItems: [
            { id: 'all', label: 'All Orders' },
            { id: 'pending_payment', label: 'Pending Payment', badge: pendingPaymentCount > 0 ? pendingPaymentCount : undefined },
            { id: 'pending_confirmation', label: 'Pending Confirmation', badge: effectivePendingCount > 0 ? effectivePendingCount : undefined },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' }
          ]
        },
        {
          id: 'operations',
          label: 'Operations',
          icon: CalendarDays,
          subItems: [
            { id: 'calendar', label: 'Calendar', icon: CalendarDays },
            { id: 'departures', label: 'Departures', icon: Clock },
            { id: 'manifest', label: 'Manifest', icon: FileText },
            { id: 'assignment', label: 'Assignment', icon: UserCheck }
          ]
        }
      ]
    },
    {
      label: 'KATALOG & DIVISI',
      items: [
        {
          id: 'services',
          label: 'Services',
          icon: Layers,
          subItems: [
            { id: 'private-tour', label: 'Private Tour', icon: Compass, group: 'TOURS' },
            { id: 'open-trip', label: 'Open Trip / Share Tour', icon: Users, group: 'TOURS' },
            { id: 'airport', label: 'Airport Transfer', icon: Plane, group: 'TRANSPORTATION' },
            { id: 'taxi', label: 'Taxi Service', icon: MapPin, group: 'TRANSPORTATION' },
            { id: 'rental', label: 'Car Rental', icon: Truck, group: 'TRANSPORTATION' }
          ]
        },
        {
          id: 'customers',
          label: 'Customers',
          icon: Users,
          subItems: [
            { id: 'list', label: 'Customer Directory' },
            { id: 'reviews', label: 'Reviews & Ratings' }
          ]
        }
      ]
    },
    {
      label: 'FINANSIAL & KONTEN',
      items: [
        {
          id: 'finance',
          label: 'Finance',
          icon: DollarSign,
          subItems: [
            { id: 'payments', label: 'Payments', icon: CreditCard },
            { id: 'invoices', label: 'Invoices', icon: Receipt },
            { id: 'revenue', label: 'Revenue', icon: TrendingUp },
            { id: 'reports', label: 'Reports', icon: FileText }
          ]
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: BarChart3
        },
        {
          id: 'marketing',
          label: 'Marketing',
          icon: Sparkles,
          subItems: [
            { id: 'promo', label: 'Promo', icon: Tag },
            { id: 'content', label: 'Website Content', icon: Globe }
          ]
        }
      ]
    },
    {
      label: 'PENGATURAN',
      items: [
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          subItems: [
            { id: 'general', label: 'General & Limits' },
            { id: 'rbac', label: 'Roles & Staff Access' },
            { id: 'account', label: 'Account & Security' }
          ]
        }
      ]
    }
  ];

  return (
    <aside 
      className={`${
        isDark 
          ? 'bg-neutral-900 border-neutral-800 text-neutral-100' 
          : 'bg-white border-neutral-200 text-neutral-900 shadow-sm'
      } border-r min-h-screen flex flex-col justify-between transition-all duration-300 z-30 sticky top-0 shrink-0 ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Upper Navigation Content */}
      <div className="flex-grow overflow-y-auto no-scrollbar py-5 px-3.5 space-y-6">
        {/* Brand Header */}
        <div className={`flex items-center justify-between border-b ${isDark ? 'border-neutral-800' : 'border-neutral-200'} pb-4`}>
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-neutral-950 font-black shadow-sm">
                <Globe className="h-5 w-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <h1 className={`text-xs font-black tracking-widest font-mono ${isDark ? 'text-neutral-100' : 'text-neutral-900'} truncate`}>
                  SMART JOURNEY
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-mono bg-amber-500/10 text-amber-500 font-extrabold px-1.5 py-0.5 rounded border border-amber-500/20">
                    SJOMS v2.0
                  </span>
                  <span className="text-[9px] font-mono text-emerald-500 font-bold flex items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-neutral-950 mx-auto shadow-sm">
              <Globe className="h-5 w-5 stroke-[2.5]" />
            </div>
          )}

          {/* Collapse Toggle */}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden md:flex p-1.5 rounded-lg ${
              isDark 
                ? 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white' 
                : 'bg-neutral-100 border-neutral-200 text-neutral-500 hover:text-neutral-900'
            } border transition-all cursor-pointer`}
            title={collapsed ? 'Perluas Menu' : 'Ciutkan Menu'}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-5 text-left">
          {navSections.map((section) => (
            <div key={section.label} className="space-y-1">
              {!collapsed && (
                <span className={`text-[9px] font-mono font-extrabold ${isDark ? 'text-neutral-500' : 'text-neutral-400'} uppercase tracking-wider px-2.5 block mb-1`}>
                  {section.label}
                </span>
              )}
              
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentModule === item.id;
                  const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
                  const isPermitted = checkModulePermission(item.id, role || 'Super Administrator') || 
                    (item.id === 'settings' && hasSubItems && (item.subItems?.some(s => checkSubItemPermission(item.id, s.id, role || 'Super Administrator')) ?? false));

                  return (
                    <div key={item.id} className="space-y-0.5">
                      <button
                        onClick={() => {
                          if (!isPermitted) return;
                          handleSelectModule(item.id);
                          if (hasSubItems && item.subItems && setActiveSubItem) {
                            const firstPermitted = item.subItems.find(sub => checkSubItemPermission(item.id, sub.id, role || 'Super Administrator')) || item.subItems[0];
                            setActiveSubItem(firstPermitted.id);
                          }
                        }}
                        disabled={!isPermitted}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all relative ${
                          !isPermitted
                            ? 'opacity-40 cursor-not-allowed text-neutral-500'
                            : isActive 
                            ? isDark
                              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold cursor-pointer'
                              : 'bg-amber-500/15 border border-amber-500/30 text-amber-700 font-extrabold shadow-xs cursor-pointer'
                            : isDark
                              ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50 border border-transparent cursor-pointer'
                              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-transparent cursor-pointer'
                        }`}
                        title={collapsed ? (isPermitted ? item.label : `${item.label} (Terkunci oleh RBAC)`) : undefined}
                      >
                        <Icon className={`h-4.5 w-4.5 shrink-0 ${!isPermitted ? 'text-neutral-600' : isActive ? 'text-amber-500' : isDark ? 'text-neutral-400' : 'text-neutral-500'}`} />
                        
                        {!collapsed && (
                          <div className="flex items-center justify-between flex-grow min-w-0">
                            <span className="truncate text-left text-xs">
                              {item.label}
                            </span>
                            
                            {!isPermitted ? (
                              <Lock className="h-3 w-3 text-neutral-500 shrink-0 ml-1.5" />
                            ) : item.badge !== undefined ? (
                              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                                item.badgeColor || 'bg-amber-500 text-neutral-950'
                              } animate-pulse`}>
                                {item.badge}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </button>

                      {/* Expanded Sub-items (visible when module active & sidebar not collapsed) */}
                      {!collapsed && isActive && hasSubItems && (
                        <div className={`ml-4 pl-3.5 border-l ${isDark ? 'border-neutral-800' : 'border-neutral-200'} space-y-0.5 py-1`}>
                          {item.subItems?.map((sub, idx, arr) => {
                            const SubIcon = sub.icon;
                            const isSubActive = activeSubItem === sub.id;
                            const isSubPermitted = checkSubItemPermission(item.id, sub.id, role || 'Super Administrator');
                            const showGroupHeader = sub.group && (idx === 0 || arr[idx - 1]?.group !== sub.group);
                            
                            return (
                              <React.Fragment key={sub.id}>
                                {showGroupHeader && (
                                  <div className={`pt-2 pb-1 px-1 flex items-center gap-1.5 ${idx > 0 ? 'border-t ' + (isDark ? 'border-neutral-800/80' : 'border-neutral-200/80') + ' mt-1.5' : ''}`}>
                                    <span className="text-[9px] font-mono font-black uppercase tracking-wider text-amber-500 flex items-center gap-1 select-none">
                                      <span className="h-1 w-1 rounded-full bg-amber-500"></span>
                                      {sub.group}
                                    </span>
                                  </div>
                                )}
                                <button
                                  disabled={!isSubPermitted}
                                  onClick={() => {
                                    if (!isSubPermitted) return;
                                    if (setActiveSubItem) {
                                      setActiveSubItem(sub.id);
                                    }
                                  }}
                                  title={!isSubPermitted ? `${sub.label} (Terkunci oleh RBAC)` : undefined}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all text-left ${
                                    sub.group ? 'pl-3 ' : ''
                                  }${
                                    !isSubPermitted
                                      ? 'opacity-40 cursor-not-allowed text-neutral-500'
                                      : 'cursor-pointer ' + (isSubActive
                                      ? isDark
                                        ? 'text-amber-400 font-bold bg-amber-500/10'
                                        : 'text-amber-700 font-bold bg-amber-500/10'
                                      : isDark
                                        ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100')
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    {SubIcon && <SubIcon className="h-3 w-3 shrink-0" />}
                                    <span className="truncate">{sub.label}</span>
                                  </div>
                                  {!isSubPermitted ? (
                                    <Lock className="h-2.5 w-2.5 text-neutral-500 shrink-0 ml-1" />
                                  ) : sub.badge !== undefined && sub.badge > 0 ? (
                                    <span className="ml-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                                      {sub.badge}
                                    </span>
                                  ) : null}
                                </button>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Profile & Exit Section */}
      <div className={`p-3.5 border-t ${isDark ? 'border-neutral-800 bg-neutral-950/70' : 'border-neutral-200 bg-neutral-50'} flex flex-col gap-2.5`}>
        {!collapsed && (
          <button
            type="button"
            onClick={() => {
              handleSelectModule('account');
              if (setActiveSubItem) setActiveSubItem('account');
            }}
            className={`w-full flex items-center gap-2.5 p-2 rounded-xl transition-all text-left cursor-pointer ${
              isDark ? 'hover:bg-neutral-800/50' : 'hover:bg-neutral-100'
            }`}
            title="Klik untuk membuka Pengaturan Akun & Profil"
          >
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 font-black font-mono text-xs shrink-0">
              AD
            </div>
            <div className="min-w-0 flex-grow text-left">
              <p className={`text-xs font-bold ${isDark ? 'text-neutral-200' : 'text-neutral-800'} truncate`}>
                Admin Pusat
              </p>
              <p className="text-[10px] text-neutral-500 font-mono truncate">
                {role || 'Super Administrator'}
              </p>
            </div>
          </button>
        )}

        <button
          onClick={onExit}
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border ${
            isDark
              ? 'border-neutral-800 hover:border-rose-900/40 hover:bg-rose-950/20 text-neutral-400 hover:text-rose-400'
              : 'border-neutral-200 hover:border-rose-200 hover:bg-rose-50 text-neutral-600 hover:text-rose-600'
          } transition-all text-xs font-bold cursor-pointer font-mono`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Keluar Portal</span>}
        </button>
      </div>
    </aside>
  );
}

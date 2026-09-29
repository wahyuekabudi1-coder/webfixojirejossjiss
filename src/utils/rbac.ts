/**
 * SMART JOURNEY — ROLE-BASED ACCESS CONTROL (RBAC) DEFINITIONS & ENFORCEMENT
 * 
 * Maps canonical operational roles to authoritative granular permissions.
 * Enforces menu visibility and module route guards across the Admin Portal.
 */

export interface RolePermissions {
  role: string;
  department: string;
  description: string;
  permissions: {
    manageBookings: boolean;
    manageTours: boolean;
    manageFleet: boolean;
    manageFinance: boolean;
    manageSettings: boolean;
    manageCMS: boolean;
  };
}

export const CANONICAL_ROLES: RolePermissions[] = [
  {
    role: 'Super Administrator',
    department: 'Executive HQ',
    description: 'Akses penuh ke semua modul operasional, finansial, CMS, dan konfigurasi sistem.',
    permissions: {
      manageBookings: true,
      manageTours: true,
      manageFleet: true,
      manageFinance: true,
      manageSettings: true,
      manageCMS: true
    }
  },
  {
    role: 'Operations Manager',
    department: 'Logistics Fleet',
    description: 'Mengelola jadwal penjemputan, kalender keberangkatan, dan manifest tur & armada.',
    permissions: {
      manageBookings: true,
      manageTours: true,
      manageFleet: true,
      manageFinance: false,
      manageSettings: false,
      manageCMS: false
    }
  },
  {
    role: 'Finance Officer',
    department: 'Finance & Tax',
    description: 'Mengelola verifikasi pembayaran, pembukuan kas/invoice, dan audit finansial.',
    permissions: {
      manageBookings: false,
      manageTours: false,
      manageFleet: false,
      manageFinance: true,
      manageSettings: false,
      manageCMS: false
    }
  },
  {
    role: 'Customer Service Support',
    department: 'Guest Relations',
    description: 'Menangani pesanan tamu masuk, verifikasi data pemesan, dan koordinasi customer.',
    permissions: {
      manageBookings: true,
      manageTours: false,
      manageFleet: false,
      manageFinance: false,
      manageSettings: false,
      manageCMS: false
    }
  },
  {
    role: 'Marketing Executive',
    department: 'Growth Content',
    description: 'Mengelola kupon promosi, publikasi konten website, testimoni, dan mitra platform.',
    permissions: {
      manageBookings: false,
      manageTours: true,
      manageFleet: false,
      manageFinance: false,
      manageSettings: false,
      manageCMS: true
    }
  }
];

export function getStoredRoles(): RolePermissions[] {
  if (typeof window === 'undefined') return CANONICAL_ROLES;
  try {
    const stored = localStorage.getItem('smartjourney_rbac_roles');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length >= 5) return parsed;
    }
  } catch (e) {
    console.error('Error loading stored RBAC roles:', e);
  }
  return CANONICAL_ROLES;
}

export function saveStoredRoles(roles: RolePermissions[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('smartjourney_rbac_roles', JSON.stringify(roles));
  } catch (e) {
    console.error('Error persisting RBAC roles:', e);
  }
}

export function getActiveRole(): string {
  if (typeof window === 'undefined') return 'Super Administrator';
  return localStorage.getItem('smartjourney_active_role') || 'Super Administrator';
}

export function saveActiveRole(role: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('smartjourney_active_role', role);
}

/**
 * Checks whether a given role has permission to access a specific module.
 */
export function checkModulePermission(
  module: string,
  roleName: string,
  rolesList: RolePermissions[] = getStoredRoles()
): boolean {
  if (module === 'dashboard') return true;
  const currentRole = rolesList.find(r => r.role === roleName) || rolesList[0];
  const p = currentRole.permissions;

  switch (module) {
    case 'orders':
    case 'operations':
    case 'customers':
      return Boolean(p.manageBookings);
    case 'services':
      return Boolean(p.manageTours || p.manageFleet);
    case 'finance':
    case 'analytics':
      return Boolean(p.manageFinance);
    case 'marketing':
    case 'cms':
      return Boolean(p.manageCMS);
    case 'settings':
      return Boolean(p.manageSettings);
    case 'account':
      return true; // Any authenticated user can view their account/profile & logout
    default:
      return true;
  }
}

/**
 * Checks whether a given role has permission to access a specific sub-item within a module.
 */
export function checkSubItemPermission(
  module: string,
  subItem: string,
  roleName: string,
  rolesList: RolePermissions[] = getStoredRoles()
): boolean {
  const currentRole = rolesList.find(r => r.role === roleName) || rolesList[0];
  const p = currentRole.permissions;

  if (module === 'services') {
    if (subItem === 'private-tour' || subItem === 'open-trip') {
      return Boolean(p.manageTours);
    }
    if (subItem === 'airport' || subItem === 'taxi' || subItem === 'rental') {
      return Boolean(p.manageFleet);
    }
  }

  if (module === 'settings') {
    if (subItem === 'general' || subItem === 'rbac') {
      return Boolean(p.manageSettings);
    }
    if (subItem === 'account') {
      return true; // Personal account settings are always accessible
    }
  }

  return checkModulePermission(module, roleName, rolesList);
}

/**
 * Returns human-readable permission requirements for a module.
 */
export function getRequiredPermissionLabel(module: string): string {
  switch (module) {
    case 'orders':
    case 'operations':
    case 'customers':
      return 'manageBookings (Pesanan & Operasional)';
    case 'services':
      return 'manageTours / manageFleet (Katalog Layanan & Armada)';
    case 'finance':
    case 'analytics':
      return 'manageFinance (Finansial & Pembukuan)';
    case 'marketing':
    case 'cms':
      return 'manageCMS (Marketing & Website CMS)';
    case 'settings':
      return 'manageSettings (Konfigurasi & Pengaturan)';
    default:
      return 'Izin Staff Resmi';
  }
}

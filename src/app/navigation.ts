import type { UserRole } from '@/types/database';
import { isManagerRole } from '@/features/auth/roleRoutes';

export type NavItem = { to: string; label: string };

const MANAGER_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/orders', label: 'Orders' },
  { to: '/products', label: 'Products' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/reports/vendor-damage', label: 'Damage report' },
  { to: '/trace', label: 'Trace' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/team', label: 'Employees' },
];

const ADMIN_EXTRA_NAV: NavItem[] = [
  { to: '/procurement', label: 'Procurement' },
  { to: '/tasks', label: 'Employee tasks' },
  { to: '/admin', label: 'Administration' },
  { to: '/admin/invite', label: 'Invite user' },
];

const PROCUREMENT_NAV: NavItem[] = [
  { to: '/procurement', label: 'Overview' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/tasks', label: 'Employee handover' },
];

const INVENTORY_NAV: NavItem[] = [
  { to: '/inventory', label: 'Inventory' },
  { to: '/products', label: 'Products' },
];

export function isAdminRole(role: UserRole): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function canAccessRoles(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  if (isAdminRole(userRole)) return true;
  return allowedRoles.includes(userRole);
}

export function getSidebarNavItems(role: UserRole): NavItem[] {
  if (isAdminRole(role)) {
    return [...MANAGER_NAV, ...ADMIN_EXTRA_NAV];
  }
  if (isManagerRole(role)) {
    return MANAGER_NAV;
  }
  if (role === 'procurement') {
    return PROCUREMENT_NAV;
  }
  if (role === 'inventory' || role === 'user') {
    return INVENTORY_NAV;
  }
  return [];
}

export function getWorkspaceLabel(role: UserRole): string {
  if (role === 'super_admin') return 'Super admin';
  if (isAdminRole(role)) return 'Admin';
  if (role === 'inventory') return 'Inventory';
  if (role === 'user') return 'User';
  if (role === 'senior_manager') return 'Senior manager';
  if (role === 'manager') return 'Manager';
  if (role === 'procurement') return 'Procurement';
  if (role === 'employee') return 'Employee';
  return 'Cortex';
}

export function pickNavItemForPath(pathname: string, items: NavItem[]): string {
  const match = items
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.to ?? items[0]?.to ?? '/';
}

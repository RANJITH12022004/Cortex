import type { UserRole } from '@/types/database';

const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
  super_admin: '/dashboard',
  admin: '/dashboard',
  manager: '/dashboard',
  senior_manager: '/dashboard',
  inventory: '/inventory',
  procurement: '/procurement',
  employee: '/tasks',
  user: '/inventory',
};

export function getDefaultRouteForRole(role: UserRole): string {
  return ROLE_DEFAULT_ROUTES[role];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  manager: 'Manager',
  senior_manager: 'Senior manager',
  inventory: 'Inventory',
  procurement: 'Procurement',
  employee: 'Employee',
  user: 'User',
};

export const MANAGER_ROLES: UserRole[] = ['manager', 'senior_manager'];

export function isManagerRole(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role);
}

export function canManageProducts(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin' || isManagerRole(role);
}

export function canWriteStock(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'inventory' || role === 'procurement';
}

export function canImportInventory(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'inventory';
}

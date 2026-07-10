import type { UserRole } from '@/types/database';

const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
  admin: '/dashboard',
  manager: '/dashboard',
  senior_manager: '/dashboard',
  procurement: '/procurement',
  employee: '/tasks',
};

export function getDefaultRouteForRole(role: UserRole): string {
  return ROLE_DEFAULT_ROUTES[role];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  senior_manager: 'Senior manager',
  procurement: 'Procurement',
  employee: 'Employee',
};

export const MANAGER_ROLES: UserRole[] = ['manager', 'senior_manager'];

export function isManagerRole(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role);
}

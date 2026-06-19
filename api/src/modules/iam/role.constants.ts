export const ROLE_USER = 'user';
export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';

export const APP_ROLES = [
  { code: ROLE_USER, name: 'User' },
  { code: ROLE_ADMIN, name: 'Admin' },
  { code: ROLE_SUPER_ADMIN, name: 'Super Admin' },
] as const;

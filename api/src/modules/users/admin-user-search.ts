export type AdminUserSearchTarget = {
  userEmail?: string | null;
  userId?: string | null;
  userPhone?: string | null;
};

export function normalizeAdminUserSearch(search?: string | null) {
  const normalized = search?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function matchesAdminUserSearch(
  target: AdminUserSearchTarget,
  search?: string | null,
) {
  const normalizedSearch = normalizeAdminUserSearch(search);

  if (!normalizedSearch) {
    return true;
  }

  return [target.userEmail, target.userId, target.userPhone].some((value) =>
    value?.toLowerCase().includes(normalizedSearch),
  );
}

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

export function getCorsOrigins(value?: string) {
  if (!value || value.trim().length === 0) {
    return DEFAULT_CORS_ORIGINS;
  }

  return [...new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean))];
}

export function getDefaultCorsOrigins() {
  return [...DEFAULT_CORS_ORIGINS];
}

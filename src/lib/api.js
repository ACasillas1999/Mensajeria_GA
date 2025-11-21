// Helper para construir URLs de API con el base path correcto
const BASE = import.meta.env.BASE_URL || '';

export function apiUrl(path) {
  return `${BASE}${path}`.replace(/\/\//g, '/');
}

export async function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), options);
}

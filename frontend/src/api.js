export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

const CSRF_KEY = 'wms.csrf';

let accessToken = null;
let refreshPromise = null;
let onSessionLost = () => {};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function setSessionLostHandler(handler) {
  onSessionLost = handler;
}

export function hasStoredSession() {
  return Boolean(localStorage.getItem(CSRF_KEY));
}

function saveSession(data) {
  accessToken = data.accessToken;
  if (data.csrfToken) localStorage.setItem(CSRF_KEY, data.csrfToken);
}

export function clearSession() {
  accessToken = null;
  localStorage.removeItem(CSRF_KEY);
}

async function parse(response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) return response.json();
  if (type.startsWith('image/')) return response.blob();
  return response.text();
}

async function send(path, { method = 'GET', body, query, auth = true, headers = {} } = {}) {
  const url = new URL(API_URL + path);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }

  const init = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json', ...headers },
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  if (auth && accessToken) init.headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(0, 'Сервер недоступен. На бесплатном тарифе Render он просыпается до минуты — повторите попытку.');
  }
  const payload = await parse(response);
  if (!response.ok) {
    const error = payload?.error || {};
    throw new ApiError(response.status, error.message || `Ошибка ${response.status}`, error.details);
  }
  return payload;
}

/**
 * Обновляет access-токен по refresh-cookie. Параллельные запросы ждут одно обновление,
 * иначе второй запрос предъявил бы уже отозванный refresh-токен.
 */
export function refreshSession() {
  if (!refreshPromise) {
    const csrf = localStorage.getItem(CSRF_KEY);
    refreshPromise = (csrf
      ? send('/auth/refresh', { method: 'POST', body: {}, auth: false, headers: { 'X-CSRF-Token': csrf } })
      : Promise.reject(new ApiError(401, 'Нет сохранённой сессии')))
      .then(({ data }) => {
        saveSession(data);
        return data.user;
      })
      .catch((err) => {
        clearSession();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function request(path, options = {}) {
  try {
    return await send(path, options);
  } catch (err) {
    const canRetry = err.status === 401 && options.auth !== false && hasStoredSession();
    if (!canRetry) throw err;
    try {
      await refreshSession();
    } catch {
      onSessionLost();
      throw err;
    }
    return send(path, options);
  }
}

export const api = {
  async login(email, password) {
    const { data } = await send('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    saveSession(data);
    return data.user;
  },
  register: (body) => send('/auth/register', { method: 'POST', body, auth: false }),
  async logout() {
    const csrf = localStorage.getItem(CSRF_KEY);
    try {
      await send('/auth/logout', { method: 'POST', body: {}, auth: false, headers: { 'X-CSRF-Token': csrf || '' } });
    } finally {
      clearSession();
    }
  },
  me: () => request('/auth/me'),

  shipments: (query) => request('/shipments', { query }),
  shipment: (id) => request(`/shipments/${id}`),
  shipmentStats: () => request('/shipments/stats'),
  scan: (code) => request(`/shipments/scan/${encodeURIComponent(code)}`),
  createShipment: (body) => request('/shipments', { method: 'POST', body }),
  updateShipment: (id, body) => request(`/shipments/${id}`, { method: 'PUT', body }),
  changeStatus: (id, status) => request(`/shipments/${id}/status`, { method: 'PATCH', body: { status } }),
  deleteShipment: (id) => request(`/shipments/${id}`, { method: 'DELETE' }),
  shipmentQr: (id) => request(`/shipments/${id}/qr`, { headers: { Accept: 'image/png' } }),

  products: (query) => request('/products', { query, auth: false }),
  locations: (query) => request('/locations', { query }),

  health: () => send('/health', { auth: false }),
  metrics: () => send('/metrics', { auth: false }),
  backendTestError: () => request('/monitoring/test-error', { method: 'POST', body: {} }),
};

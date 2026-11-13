export const STATUSES = ['new', 'picking', 'packed', 'shipped', 'delivered', 'cancelled'];

export const STATUS_LABELS = {
  new: 'Новая',
  picking: 'Сборка',
  packed: 'Упакована',
  shipped: 'Отгружена',
  delivered: 'Доставлена',
  cancelled: 'Отменена',
};

// Те же правила, что на сервере (src/constants/shipments.js): статус движется только вперёд.
export const TRANSITIONS = {
  new: ['picking', 'cancelled'],
  picking: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const ACTION_LABELS = {
  picking: 'Начать сборку',
  packed: 'Упаковано',
  shipped: 'Отгрузить',
  delivered: 'Доставлено',
  cancelled: 'Отменить',
};

export const OPEN_STATUSES = ['new', 'picking', 'packed'];

const ROLE_RANK = { user: 1, moderator: 2, admin: 3 };

export const ROLE_LABELS = {
  user: 'Кладовщик',
  moderator: 'Старший смены',
  admin: 'Администратор',
};

export function hasRole(user, role) {
  return Boolean(user) && (ROLE_RANK[user.role] || 0) >= ROLE_RANK[role];
}

export function canEdit(shipment, user) {
  if (!shipment || !user || !OPEN_STATUSES.includes(shipment.status)) return false;
  return shipment.createdBy === user.id || hasRole(user, 'moderator');
}

export function nextStatuses(status) {
  return TRANSITIONS[status] || [];
}

export function todayIso(date = new Date()) {
  return date.toLocaleDateString('sv-SE');
}

export function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

export function isOverdue(shipment, today = todayIso()) {
  return OPEN_STATUSES.includes(shipment.status) && shipment.plannedDate < today;
}

export function formatWeight(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг`;
}

// Терминалы и камеры отдают код с пробелами и в нижнем регистре; сервер ждёт SHP- и 16 hex-символов.
export function normalizeQr(raw) {
  const value = String(raw || '').trim().toUpperCase();
  const match = value.match(/SHP-[0-9A-F]{16}/);
  return match ? match[0] : null;
}

export function emptyShipmentForm() {
  return {
    orderNumber: '',
    customerName: '',
    deliveryAddress: '',
    plannedDate: todayIso(),
    packagesCount: 1,
    totalWeightKg: '',
    carrier: '',
    comment: '',
  };
}

export function toShipmentPayload(form) {
  return {
    orderNumber: form.orderNumber.trim(),
    customerName: form.customerName.trim(),
    deliveryAddress: form.deliveryAddress.trim(),
    plannedDate: form.plannedDate,
    packagesCount: Number(form.packagesCount),
    totalWeightKg: form.totalWeightKg === '' || form.totalWeightKg === null ? null : Number(form.totalWeightKg),
    carrier: form.carrier?.trim() || null,
    comment: form.comment?.trim() || null,
  };
}

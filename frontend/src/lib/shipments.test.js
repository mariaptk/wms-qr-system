import { describe, expect, test } from 'vitest';
import {
  canEdit,
  formatDate,
  hasRole,
  isOverdue,
  nextStatuses,
  normalizeQr,
  toShipmentPayload,
} from './shipments.js';

const worker = { id: 'u1', role: 'user' };
const senior = { id: 'u2', role: 'moderator' };

describe('права', () => {
  test('старшая роль включает младшие', () => {
    expect(hasRole({ role: 'admin' }, 'moderator')).toBe(true);
    expect(hasRole(worker, 'moderator')).toBe(false);
    expect(hasRole(null, 'user')).toBe(false);
  });

  test('редактирует автор или старший смены, пока груз на складе', () => {
    expect(canEdit({ status: 'new', createdBy: 'u1' }, worker)).toBe(true);
    expect(canEdit({ status: 'new', createdBy: 'other' }, worker)).toBe(false);
    expect(canEdit({ status: 'packed', createdBy: 'other' }, senior)).toBe(true);
    expect(canEdit({ status: 'shipped', createdBy: 'u1' }, worker)).toBe(false);
  });
});

describe('статусы', () => {
  test('переходы как на сервере', () => {
    expect(nextStatuses('new')).toEqual(['picking', 'cancelled']);
    expect(nextStatuses('shipped')).toEqual(['delivered']);
    expect(nextStatuses('delivered')).toEqual([]);
  });

  test('просрочена только незавершённая отгрузка с датой в прошлом', () => {
    expect(isOverdue({ status: 'packed', plannedDate: '2026-11-01' }, '2026-11-13')).toBe(true);
    expect(isOverdue({ status: 'shipped', plannedDate: '2026-11-01' }, '2026-11-13')).toBe(false);
    expect(isOverdue({ status: 'new', plannedDate: '2026-11-13' }, '2026-11-13')).toBe(false);
  });
});

describe('QR-код', () => {
  test('приводит отсканированный текст к виду SHP-…', () => {
    expect(normalizeQr('  shp-0123456789abcdef ')).toBe('SHP-0123456789ABCDEF');
    expect(normalizeQr('https://wms/scan/SHP-0123456789ABCDEF')).toBe('SHP-0123456789ABCDEF');
    expect(normalizeQr('ORD-1')).toBeNull();
  });
});

describe('форма отгрузки', () => {
  test('пустые необязательные поля уходят как null, числа — числами', () => {
    expect(toShipmentPayload({
      orderNumber: ' ord-1 ',
      customerName: 'ООО «Тест»',
      deliveryAddress: 'г. Минск, ул. Тестовая, 1',
      plannedDate: '2026-11-20',
      packagesCount: '3',
      totalWeightKg: '',
      carrier: ' ',
      comment: '',
    })).toEqual({
      orderNumber: 'ord-1',
      customerName: 'ООО «Тест»',
      deliveryAddress: 'г. Минск, ул. Тестовая, 1',
      plannedDate: '2026-11-20',
      packagesCount: 3,
      totalWeightKg: null,
      carrier: null,
      comment: null,
    });
  });

  test('дата в формате ДД.ММ.ГГГГ', () => {
    expect(formatDate('2026-11-19')).toBe('19.11.2026');
    expect(formatDate(null)).toBe('—');
  });
});

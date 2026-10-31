const SHIPMENT_STATUSES = Object.freeze(['new', 'picking', 'packed', 'shipped', 'delivered', 'cancelled']);

// Отгрузка движется только вперёд; отменить можно, пока груз не покинул склад.
const SHIPMENT_TRANSITIONS = Object.freeze({
  new: ['picking', 'cancelled'],
  picking: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
});

// Пока груз на складе, карточку можно править; после отгрузки она становится документом.
const SHIPMENT_OPEN_STATUSES = Object.freeze(['new', 'picking', 'packed']);

const SHIPMENT_SORT_FIELDS = Object.freeze([
  'createdAt',
  'plannedDate',
  'orderNumber',
  'customerName',
  'packagesCount',
  'totalWeightKg',
]);

module.exports = {
  SHIPMENT_STATUSES,
  SHIPMENT_TRANSITIONS,
  SHIPMENT_OPEN_STATUSES,
  SHIPMENT_SORT_FIELDS,
};

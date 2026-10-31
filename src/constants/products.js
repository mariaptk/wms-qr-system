// Категории и единицы хранятся кодами: подписи на русском показывает клиент.
const PRODUCT_CATEGORIES = Object.freeze([
  'food',
  'beverages',
  'household',
  'electronics',
  'building',
  'clothing',
  'other',
]);

const PRODUCT_UNITS = Object.freeze(['pcs', 'kg', 'g', 'l', 'box', 'pack']);

// Поля, по которым разрешена сортировка списка; всё остальное отклоняет валидация.
const PRODUCT_SORT_FIELDS = Object.freeze(['createdAt', 'name', 'sku', 'price', 'weightKg']);

module.exports = { PRODUCT_CATEGORIES, PRODUCT_UNITS, PRODUCT_SORT_FIELDS };

import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useDebounced, useLoad } from '../hooks.js';
import { Empty, ErrorMessage, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import { STATUSES, STATUS_LABELS, formatDate, formatWeight, isOverdue, todayIso } from '../lib/shipments.js';

const SORTS = {
  plannedDate: 'Плановая дата',
  createdAt: 'Дата создания',
  orderNumber: 'Номер заказа',
  customerName: 'Получатель',
  packagesCount: 'Количество мест',
  totalWeightKg: 'Вес',
};

export default function ShipmentsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = {
    search: params.get('search') || '',
    status: params.get('status') || '',
    plannedFrom: params.get('plannedFrom') || '',
    plannedTo: params.get('plannedTo') || '',
    sort: params.get('sort') || 'plannedDate',
    order: params.get('order') || 'asc',
    page: Number(params.get('page') || 1),
  };
  const overdueOnly = params.get('overdue') === '1';
  const search = useDebounced(filters.search);

  // «Просроченные» — не отдельный фильтр API: это открытые статусы с датой до сегодняшней.
  const query = overdueOnly
    ? { plannedTo: dayBefore(todayIso()), sort: 'plannedDate', order: 'asc', limit: 100, page: 1 }
    : { ...filters, search, limit: 20 };

  const { data, error, loading } = useLoad(
    () => api.shipments(query),
    [JSON.stringify(query)],
  );
  const rows = overdueOnly ? data?.data.filter((item) => isOverdue(item)) : data?.data;
  const meta = data?.meta;

  function update(patch) {
    const next = new URLSearchParams(params);
    next.delete('overdue');
    for (const [key, value] of Object.entries({ page: 1, ...patch })) {
      if (value === '' || value === null || (key === 'page' && value === 1)) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  return (
    <>
      <PageHeader title="Отгрузки" subtitle={meta ? `Найдено: ${overdueOnly ? rows.length : meta.total}` : ' '}>
        <Link className="btn btn-primary" to="/shipments/new">Новая отгрузка</Link>
      </PageHeader>

      <div className="card filters">
        <input type="search" placeholder="Номер заказа, получатель или адрес" value={filters.search}
          onChange={(e) => update({ search: e.target.value })} />
        <select value={filters.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">Все статусы</option>
          {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
        </select>
        <label className="inline">с <input type="date" value={filters.plannedFrom} onChange={(e) => update({ plannedFrom: e.target.value })} /></label>
        <label className="inline">по <input type="date" value={filters.plannedTo} onChange={(e) => update({ plannedTo: e.target.value })} /></label>
        <select value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
          {Object.entries(SORTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <button className="btn" type="button" onClick={() => update({ order: filters.order === 'asc' ? 'desc' : 'asc' })}
          title="Направление сортировки">
          {filters.order === 'asc' ? '↑ по возрастанию' : '↓ по убыванию'}
        </button>
        {(params.toString() !== '') && (
          <button className="btn btn-ghost" type="button" onClick={() => setParams({}, { replace: true })}>Сбросить</button>
        )}
      </div>
      {overdueOnly && <div className="alert alert-warn">Показаны просроченные отгрузки: плановая дата прошла, груз ещё на складе.</div>}

      <ErrorMessage error={error} />
      {loading && !data && <Loading />}
      {rows?.length === 0 && <Empty>Отгрузок по этим условиям нет</Empty>}
      {rows?.length > 0 && (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Заказ</th>
                <th>Получатель</th>
                <th>Плановая дата</th>
                <th className="num">Мест</th>
                <th className="num">Вес</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} onClick={() => navigate(`/shipments/${item.id}`)} className="clickable">
                  <td><Link to={`/shipments/${item.id}`}><strong>{item.orderNumber}</strong></Link></td>
                  <td>
                    {item.customerName}
                    <div className="muted small">{item.deliveryAddress}</div>
                  </td>
                  <td className={isOverdue(item) ? 'text-bad' : ''}>{formatDate(item.plannedDate)}</td>
                  <td className="num">{item.packagesCount}</td>
                  <td className="num">{formatWeight(item.totalWeightKg)}</td>
                  <td><StatusBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!overdueOnly && meta?.pages > 1 && (
        <div className="pager">
          <button className="btn" type="button" disabled={meta.page <= 1} onClick={() => update({ page: meta.page - 1 })}>← Назад</button>
          <span>Страница {meta.page} из {meta.pages}</span>
          <button className="btn" type="button" disabled={meta.page >= meta.pages} onClick={() => update({ page: meta.page + 1 })}>Вперёд →</button>
        </div>
      )}
    </>
  );
}

function dayBefore(iso) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return todayIso(date);
}

import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { ErrorMessage, Loading, PageHeader, StatusBadge, Empty } from '../components/ui.jsx';
import { STATUSES, STATUS_LABELS, formatDate, formatWeight, todayIso } from '../lib/shipments.js';
import { useAuth } from '../auth.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const today = todayIso();
  const stats = useLoad(() => api.shipmentStats().then((r) => r.data), []);
  const todayList = useLoad(
    () => api.shipments({ plannedFrom: today, plannedTo: today, sort: 'createdAt', limit: 10 }).then((r) => r.data),
    [today],
  );

  const s = stats.data;
  return (
    <>
      <PageHeader title={`Добрый день, ${user.name.split(' ')[0]}`} subtitle={`Сводка склада на ${formatDate(today)}`}>
        <Link className="btn btn-primary" to="/shipments/new">Новая отгрузка</Link>
        <Link className="btn" to="/scan">Сканировать QR</Link>
      </PageHeader>

      <ErrorMessage error={stats.error} />
      {!s && stats.loading && <Loading />}
      {s && (
        <div className="kpis">
          <Link to={`/shipments?plannedFrom=${today}&plannedTo=${today}`} className="kpi">
            <span>На сегодня</span><strong>{s.plannedToday}</strong>
          </Link>
          <Link to="/shipments?overdue=1" className={`kpi ${s.overdue ? 'kpi-bad' : ''}`}>
            <span>Просрочено</span><strong>{s.overdue}</strong>
          </Link>
          <div className="kpi"><span>Всего отгрузок</span><strong>{s.total}</strong></div>
          <div className="kpi"><span>Мест / вес</span><strong>{s.packages}</strong><em>{formatWeight(s.weightKg)}</em></div>
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <h2>По статусам</h2>
          {s && (
            <div className="bars">
              {STATUSES.map((status) => (
                <Link key={status} to={`/shipments?status=${status}`} className="bar-row">
                  <span className="bar-label">{STATUS_LABELS[status]}</span>
                  <span className="bar-track">
                    <span className={`bar-fill status-${status}`} style={{ width: `${s.total ? (s.byStatus[status] / s.total) * 100 : 0}%` }} />
                  </span>
                  <span className="bar-value">{s.byStatus[status]}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Отгрузки на сегодня</h2>
          <ErrorMessage error={todayList.error} />
          {todayList.loading && !todayList.data && <Loading />}
          {todayList.data?.length === 0 && <Empty>На сегодня отгрузок нет</Empty>}
          <ul className="list">
            {todayList.data?.map((item) => (
              <li key={item.id}>
                <Link to={`/shipments/${item.id}`}>
                  <div>
                    <strong>{item.orderNumber}</strong>
                    <div className="muted small">{item.customerName}</div>
                  </div>
                  <StatusBadge status={item.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import { ErrorMessage, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import {
  ACTION_LABELS,
  canEdit,
  formatDate,
  formatDateTime,
  formatWeight,
  hasRole,
  isOverdue,
  nextStatuses,
} from '../lib/shipments.js';

// Картинка QR отдаётся только с токеном, поэтому <img src> на API не подходит: качаем blob.
function useQrImage(id) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    api.shipmentQr(id).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => setUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url;
}

export default function ShipmentPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: shipment, error, loading, setData } = useLoad(() => api.shipment(id).then((r) => r.data), [id]);
  const qrUrl = useQrImage(id);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading && !shipment) return <Loading />;
  if (error) return <><ErrorMessage error={error} /><Link to="/shipments">← К списку отгрузок</Link></>;

  async function changeStatus(status) {
    if (status === 'cancelled' && !window.confirm('Отменить отгрузку? Вернуть статус будет нельзя.')) return;
    setBusy(true);
    setActionError(null);
    try {
      setData((await api.changeStatus(id, status)).data);
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Удалить отгрузку ${shipment.orderNumber}?`)) return;
    try {
      await api.deleteShipment(id);
      navigate('/shipments', { replace: true });
    } catch (err) {
      setActionError(err);
    }
  }

  const actions = nextStatuses(shipment.status);

  return (
    <>
      <PageHeader title={`Отгрузка ${shipment.orderNumber}`} subtitle={shipment.customerName}>
        <StatusBadge status={shipment.status} />
      </PageHeader>
      {location.state?.saved && <div className="alert alert-success">Отгрузка сохранена</div>}
      <ErrorMessage error={actionError} />

      <div className="grid-2 grid-wide-left">
        <section className="card">
          <dl className="details">
            <dt>Получатель</dt><dd>{shipment.customerName}</dd>
            <dt>Адрес доставки</dt><dd>{shipment.deliveryAddress}</dd>
            <dt>Плановая дата</dt>
            <dd className={isOverdue(shipment) ? 'text-bad' : ''}>
              {formatDate(shipment.plannedDate)}{isOverdue(shipment) && ' — просрочена'}
            </dd>
            <dt>Мест</dt><dd>{shipment.packagesCount}</dd>
            <dt>Вес</dt><dd>{formatWeight(shipment.totalWeightKg)}</dd>
            <dt>Перевозчик</dt><dd>{shipment.carrier || '—'}</dd>
            <dt>Комментарий</dt><dd>{shipment.comment || '—'}</dd>
            <dt>Отгружена</dt><dd>{formatDateTime(shipment.shippedAt)}</dd>
            <dt>Создана</dt><dd>{formatDateTime(shipment.createdAt)}</dd>
            <dt>Изменена</dt><dd>{formatDateTime(shipment.updatedAt)}</dd>
          </dl>

          {actions.length > 0 && (
            <div className="status-actions">
              <h3>Следующий шаг</h3>
              {actions.map((status) => (
                <button key={status} type="button" disabled={busy}
                  className={`btn ${status === 'cancelled' ? 'btn-danger-ghost' : 'btn-primary'}`}
                  onClick={() => changeStatus(status)}>
                  {ACTION_LABELS[status]}
                </button>
              ))}
            </div>
          )}

          <div className="form-actions">
            {canEdit(shipment, user) && <Link className="btn" to={`/shipments/${id}/edit`}>Изменить</Link>}
            {hasRole(user, 'admin') && <button className="btn btn-danger-ghost" type="button" onClick={remove}>Удалить</button>}
            <Link className="btn btn-ghost" to="/shipments">← К списку</Link>
          </div>
        </section>

        <section className="card label-card">
          <h2>Этикетка</h2>
          <div className="label" id="label">
            {qrUrl ? <img src={qrUrl} alt={`QR-код ${shipment.qrCode}`} width="220" height="220" /> : <div className="qr-placeholder"><Loading text="" /></div>}
            <div className="label-text">
              <strong>{shipment.orderNumber}</strong>
              <span>{shipment.customerName}</span>
              <span>{shipment.deliveryAddress}</span>
              <span>Мест: {shipment.packagesCount} · {formatDate(shipment.plannedDate)}</span>
              <code>{shipment.qrCode}</code>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="button" onClick={() => window.print()} disabled={!qrUrl}>Печать этикетки</button>
            {qrUrl && <a className="btn btn-ghost" href={qrUrl} download={`${shipment.orderNumber}-qr.png`}>Скачать PNG</a>}
          </div>
        </section>
      </div>
    </>
  );
}

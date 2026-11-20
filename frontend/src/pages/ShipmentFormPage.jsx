import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorMessage, Loading, PageHeader, fieldError } from '../components/ui.jsx';
import { emptyShipmentForm, toShipmentPayload, todayIso } from '../lib/shipments.js';

const CARRIERS = ['Собственный транспорт', 'Белпочта', 'Европочта', 'Автолайт Экспресс'];

export default function ShipmentFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(editing ? null : emptyShipmentForm());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) return;
    api.shipment(id)
      .then(({ data }) => setForm({
        ...emptyShipmentForm(),
        ...data,
        totalWeightKg: data.totalWeightKg ?? '',
        carrier: data.carrier ?? '',
        comment: data.comment ?? '',
      }))
      .catch(setError);
  }, [editing, id]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = toShipmentPayload(form);
      const { data } = editing ? await api.updateShipment(id, payload) : await api.createShipment(payload);
      navigate(`/shipments/${data.id}`, { replace: true, state: { saved: true } });
    } catch (err) {
      setError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  if (!form) return error ? <ErrorMessage error={error} /> : <Loading />;
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <>
      <PageHeader
        title={editing ? `Изменение ${form.orderNumber}` : 'Новая отгрузка'}
        subtitle={editing ? 'Карточку можно менять, пока груз на складе' : 'QR-код для этикетки сервер выдаст после сохранения'}
      />
      <form className="card form" onSubmit={submit}>
        <ErrorMessage error={error} />
        <div className="form-grid">
          <label>
            Номер заказа *
            <input required value={form.orderNumber} onChange={set('orderNumber')} placeholder="ORD-2026-0200" />
            <span className="hint">Латиница, цифры и дефис, 3–32 символа</span>
            {fieldError(error, 'orderNumber')}
          </label>
          <label>
            Плановая дата *
            <input type="date" required min={editing ? undefined : todayIso()} value={form.plannedDate} onChange={set('plannedDate')} />
            {fieldError(error, 'plannedDate')}
          </label>
          <label className="span-2">
            Получатель *
            <input required value={form.customerName} onChange={set('customerName')} placeholder="ООО «Продторг»" />
            {fieldError(error, 'customerName')}
          </label>
          <label className="span-2">
            Адрес доставки *
            <input required value={form.deliveryAddress} onChange={set('deliveryAddress')} placeholder="г. Минск, ул. Тимирязева, 65" />
            {fieldError(error, 'deliveryAddress')}
          </label>
          <label>
            Количество мест *
            <input type="number" min="1" max="1000" required value={form.packagesCount} onChange={set('packagesCount')} />
            {fieldError(error, 'packagesCount')}
          </label>
          <label>
            Общий вес, кг
            <input type="number" min="0" step="0.001" value={form.totalWeightKg} onChange={set('totalWeightKg')} />
            {fieldError(error, 'totalWeightKg')}
          </label>
          <label className="span-2">
            Перевозчик
            <input list="carriers" value={form.carrier} onChange={set('carrier')} />
            <datalist id="carriers">{CARRIERS.map((item) => <option key={item} value={item} />)}</datalist>
            {fieldError(error, 'carrier')}
          </label>
          <label className="span-2">
            Комментарий
            <textarea rows="3" value={form.comment} onChange={set('comment')} />
            {fieldError(error, 'comment')}
          </label>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
          <Link className="btn btn-ghost" to={editing ? `/shipments/${id}` : '/shipments'}>Отмена</Link>
        </div>
      </form>
    </>
  );
}

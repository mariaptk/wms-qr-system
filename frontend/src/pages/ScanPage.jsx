import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorMessage, PageHeader, StatusBadge } from '../components/ui.jsx';
import { ACTION_LABELS, formatDate, nextStatuses, normalizeQr } from '../lib/shipments.js';

const READER_ID = 'qr-reader';

export default function ScanPage() {
  const [manual, setManual] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [camera, setCamera] = useState('off');
  const scanner = useRef(null);
  const lastCode = useRef({ code: null, at: 0 });

  const lookup = useCallback(async (raw) => {
    const code = normalizeQr(raw);
    if (!code) {
      setResult(null);
      setError({ message: `«${String(raw).slice(0, 40)}» — не QR-код отгрузки (ожидается SHP- и 16 символов)` });
      return;
    }
    // Камера распознаёт один и тот же код много раз в секунду.
    const now = Date.now();
    if (lastCode.current.code === code && now - lastCode.current.at < 3000) return;
    lastCode.current = { code, at: now };

    setError(null);
    try {
      const { data } = await api.scan(code);
      setResult(data);
      if (navigator.vibrate) navigator.vibrate(80);
    } catch (err) {
      setResult(null);
      setError(err);
    }
  }, []);

  const stopCamera = useCallback(async () => {
    if (scanner.current?.isScanning) await scanner.current.stop().catch(() => {});
    setCamera('off');
  }, []);

  async function startCamera() {
    setError(null);
    setCamera('starting');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      scanner.current = scanner.current || new Html5Qrcode(READER_ID, { verbose: false });
      await scanner.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => lookup(text),
        () => {},
      );
      setCamera('on');
    } catch (err) {
      setCamera('off');
      setError({ message: `Камера недоступна: ${err?.message || err}. Разрешите доступ к камере или введите код вручную.` });
    }
  }

  useEffect(() => () => {
    if (scanner.current?.isScanning) scanner.current.stop().catch(() => {});
  }, []);

  async function advance(status) {
    try {
      setResult((await api.changeStatus(result.id, status)).data);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <>
      <PageHeader title="Сканер QR-кода" subtitle="Наведите камеру на этикетку отгрузки или введите код с ручного сканера" />
      <div className="grid-2">
        <section className="card">
          <div id={READER_ID} className={`reader ${camera === 'on' ? 'reader-on' : ''}`} />
          <div className="form-actions">
            {camera !== 'on'
              ? <button className="btn btn-primary" type="button" onClick={startCamera} disabled={camera === 'starting'}>
                  {camera === 'starting' ? 'Запускаем камеру…' : 'Включить камеру'}
                </button>
              : <button className="btn" type="button" onClick={stopCamera}>Выключить камеру</button>}
          </div>
          <form className="scan-manual" onSubmit={(e) => { e.preventDefault(); lastCode.current = { code: null, at: 0 }; lookup(manual); }}>
            <input placeholder="SHP-0123456789ABCDEF" value={manual} onChange={(e) => setManual(e.target.value)} autoFocus />
            <button className="btn" type="submit">Найти</button>
          </form>
        </section>

        <section className="card">
          <h2>Результат</h2>
          <ErrorMessage error={error} />
          {!result && !error && <p className="muted">Здесь появится найденная отгрузка.</p>}
          {result && (
            <div className="scan-result">
              <div className="scan-title">
                <strong>{result.orderNumber}</strong>
                <StatusBadge status={result.status} />
              </div>
              <p>{result.customerName}<br /><span className="muted">{result.deliveryAddress}</span></p>
              <p className="muted">Мест: {result.packagesCount} · плановая дата {formatDate(result.plannedDate)}</p>
              <div className="form-actions">
                {nextStatuses(result.status).filter((s) => s !== 'cancelled').map((status) => (
                  <button key={status} className="btn btn-primary" type="button" onClick={() => advance(status)}>
                    {ACTION_LABELS[status]}
                  </button>
                ))}
                <Link className="btn" to={`/shipments/${result.id}`}>Открыть карточку</Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { API_URL, api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ErrorMessage, Loading, PageHeader } from '../components/ui.jsx';
import { hasRole } from '../lib/shipments.js';
import { Sentry, sentryEnabled } from '../sentry.js';

function duration(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d} д ${h} ч`;
  if (h) return `${h} ч ${m} мин`;
  return `${m} мин ${seconds % 60} с`;
}

function Chart({ history }) {
  const max = Math.max(1, ...history.map((b) => b.requests));
  const width = 600 / 60;
  return (
    <svg className="chart" viewBox="0 0 600 140" preserveAspectRatio="none" role="img" aria-label="Запросы по минутам">
      {history.map((b, i) => {
        const x = (60 - history.length + i) * width;
        const h = (b.requests / max) * 130;
        const e = (b.errors / max) * 130;
        return (
          <g key={b.minute}>
            <rect x={x + 1} y={140 - h} width={width - 2} height={h} className="chart-bar">
              <title>{`${new Date(b.minute).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}: ${b.requests} запр., ${b.avgMs} мс`}</title>
            </rect>
            {b.errors > 0 && <rect x={x + 1} y={140 - e} width={width - 2} height={e} className="chart-error" />}
          </g>
        );
      })}
    </svg>
  );
}

function Crash() {
  throw new Error('Тестовая ошибка рендеринга React (ErrorBoundary)');
}

export default function MonitoringPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [crash, setCrash] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data } = await api.metrics();
        if (active) {
          setMetrics(data);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err);
      }
    }
    load();
    const timer = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function backendError() {
    setMessage(null);
    try {
      await api.backendTestError();
    } catch (err) {
      setMessage(`Сервер ответил ${err.status}: «${err.message}». Ошибка ушла в Sentry и Telegram.`);
    }
  }

  function frontendError() {
    const eventId = Sentry.captureException(new Error(`Тестовая ошибка фронтенда ${new Date().toISOString()}`));
    setMessage(sentryEnabled ? `Ошибка фронтенда отправлена в Sentry, id события ${eventId}` : 'VITE_SENTRY_DSN не задан — Sentry во фронтенде выключен');
  }

  if (crash) return <Crash />;
  const m = metrics;

  return (
    <>
      <PageHeader title="Мониторинг" subtitle="Состояние бэкенда, обновляется каждые 10 секунд">
        <a className="btn" href={`${API_URL}/status`} target="_blank" rel="noreferrer">Страница метрик API</a>
        <a className="btn btn-ghost" href={`${API_URL}/api-docs`} target="_blank" rel="noreferrer">Swagger</a>
      </PageHeader>
      <ErrorMessage error={error} />
      {!m && !error && <Loading />}
      {m && (
        <>
          <div className="kpis">
            <div className={`kpi ${m.db.status === 'ok' ? 'kpi-ok' : 'kpi-bad'}`}>
              <span>Статус</span><strong>{m.db.status === 'ok' ? 'работает' : 'сбой БД'}</strong>
              <em>база {m.db.latencyMs} мс</em>
            </div>
            <div className="kpi"><span>Время работы</span><strong>{duration(m.uptimeSeconds)}</strong></div>
            <div className="kpi"><span>Память RSS</span><strong>{m.memoryMb.rss} МБ</strong><em>heap {m.memoryMb.heapUsed} / {m.memoryMb.heapTotal} МБ</em></div>
            <div className="kpi"><span>CPU процесса</span><strong>{m.cpu.processPercent} %</strong><em>load {m.cpu.loadAverage.join(' / ')}</em></div>
            <div className="kpi"><span>Запросов</span><strong>{m.requests.total}</strong><em>4xx {m.requests.byStatusClass['4xx']} · 5xx {m.requests.byStatusClass['5xx']}</em></div>
            <div className="kpi"><span>Время ответа</span><strong>{m.responseTimeMs.avg} мс</strong><em>p95 {m.responseTimeMs.p95} мс</em></div>
          </div>
          <div className="grid-2">
            <section className="card">
              <h2>Запросы за час</h2>
              <Chart history={m.history} />
              <p className="muted small">Синие — все запросы за минуту, красные — ошибки 5xx</p>
            </section>
            <section className="card">
              <h2>Сборка и интеграции</h2>
              <dl className="details">
                <dt>API</dt><dd>{m.release.version} · <code>{m.release.commit.slice(0, 7)}</code> · {m.release.env}</dd>
                <dt>Фронтенд</dt><dd><code>{(import.meta.env.VITE_RELEASE || 'local').slice(0, 30)}</code></dd>
                <dt>Sentry API</dt><dd>{m.integrations.sentry ? 'подключён' : 'выключен'}</dd>
                <dt>Sentry React</dt><dd>{sentryEnabled ? 'подключён' : 'выключен'}</dd>
                <dt>Better Stack</dt><dd>{m.integrations.betterStack ? 'подключён' : 'выключен'}</dd>
                <dt>Telegram</dt><dd>{m.integrations.telegram ? 'подключён' : 'выключен'}</dd>
              </dl>
            </section>
          </div>
        </>
      )}

      {hasRole(user, 'admin') && (
        <section className="card">
          <h2>Проверка сбора ошибок</h2>
          <p className="muted">Кнопки создают тестовые ошибки, чтобы проверить Sentry и уведомления в Telegram.</p>
          {message && <div className="alert alert-success">{message}</div>}
          <div className="form-actions">
            <button className="btn btn-danger-ghost" type="button" onClick={backendError}>Ошибка на сервере</button>
            <button className="btn btn-danger-ghost" type="button" onClick={frontendError}>Ошибка во фронтенде</button>
            <button className="btn btn-danger-ghost" type="button" onClick={() => setCrash(true)}>Сбой рендеринга</button>
          </div>
        </section>
      )}
    </>
  );
}

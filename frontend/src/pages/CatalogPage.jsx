import { useState } from 'react';
import { api } from '../api.js';
import { useDebounced, useLoad } from '../hooks.js';
import { Empty, ErrorMessage, Loading, PageHeader } from '../components/ui.jsx';

const UNITS = { pcs: 'шт.', kg: 'кг', g: 'г', l: 'л', box: 'короб', pack: 'упак.' };

function Products({ search }) {
  const { data, error, loading } = useLoad(() => api.products({ search, limit: 100 }), [search]);
  if (loading && !data) return <Loading />;
  return (
    <>
      <ErrorMessage error={error} />
      {data?.data.length === 0 && <Empty>Товаров не найдено</Empty>}
      {data?.data.length > 0 && (
        <table className="table">
          <thead><tr><th>Артикул</th><th>Наименование</th><th>Ед.</th><th>Статус</th></tr></thead>
          <tbody>
            {data.data.map((item) => (
              <tr key={item.id}>
                <td><code>{item.sku}</code></td>
                <td>{item.name}{item.description && <div className="muted small">{item.description}</div>}</td>
                <td>{UNITS[item.unit] || item.unit}</td>
                <td>{item.isActive ? <span className="status status-delivered">в работе</span> : <span className="status status-cancelled">выведен</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function Locations({ search }) {
  const { data, error, loading } = useLoad(() => api.locations({ search, limit: 100 }), [search]);
  if (loading && !data) return <Loading />;
  return (
    <>
      <ErrorMessage error={error} />
      {data?.data.length === 0 && <Empty>Ячеек не найдено</Empty>}
      {data?.data.length > 0 && (
        <table className="table">
          <thead><tr><th>Код</th><th>Зона</th><th>Описание</th><th>Статус</th></tr></thead>
          <tbody>
            {data.data.map((item) => (
              <tr key={item.id}>
                <td><code>{item.code}</code></td>
                <td>{item.zone}</td>
                <td className="muted">{item.description || '—'}</td>
                <td>{item.isBlocked ? <span className="status status-cancelled">заблокирована</span> : <span className="status status-delivered">доступна</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default function CatalogPage() {
  const [tab, setTab] = useState('products');
  const [query, setQuery] = useState('');
  const search = useDebounced(query);

  return (
    <>
      <PageHeader title="Справочники" subtitle="Товары и ячейки хранения склада" />
      <div className="card">
        <div className="tabs">
          <button type="button" className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Товары</button>
          <button type="button" className={tab === 'locations' ? 'active' : ''} onClick={() => setTab('locations')}>Ячейки хранения</button>
          <input type="search" placeholder={tab === 'products' ? 'Артикул или название' : 'Код или зона'}
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {tab === 'products' ? <Products search={search} /> : <Locations search={search} />}
      </div>
    </>
  );
}

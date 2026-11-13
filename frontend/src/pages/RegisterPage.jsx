import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorMessage, fieldError } from '../components/ui.jsx';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.register(form);
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>Регистрация</h1>
        <p className="muted">Новая учётная запись получает роль «Кладовщик». Роль повышает администратор.</p>
        <ErrorMessage error={error} />
        <label>
          Имя
          <input required value={form.name} onChange={set('name')} />
          {fieldError(error, 'name')}
        </label>
        <label>
          Email
          <input type="email" autoComplete="username" required value={form.email} onChange={set('email')} />
          {fieldError(error, 'email')}
        </label>
        <label>
          Пароль
          <input type="password" autoComplete="new-password" required value={form.password} onChange={set('password')} />
          <span className="hint">Не короче 8 символов, с цифрой и спецсимволом</span>
          {fieldError(error, 'password')}
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Создаём…' : 'Зарегистрироваться'}
        </button>
        <p className="muted center"><Link to="/login">Уже есть учётная запись</Link></p>
      </form>
    </div>
  );
}

import './sentry.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Sentry } from './sentry.js';
import { AuthProvider } from './auth.jsx';
import App from './App.jsx';
import './styles.css';

function Fallback({ error, resetError }) {
  return (
    <div className="fatal">
      <h1>Что-то пошло не так</h1>
      <p>Ошибка отправлена разработчикам. Попробуйте обновить страницу.</p>
      <pre>{String(error?.message || error)}</pre>
      <button className="btn" type="button" onClick={resetError}>Попробовать снова</button>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={Fallback}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);

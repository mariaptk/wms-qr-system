import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, hasStoredSession, refreshSession, setSessionLostHandler } from './api.js';
import { setSentryUser } from './sentry.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!hasStoredSession());

  const applyUser = useCallback((value) => {
    setUser(value);
    setSentryUser(value);
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => applyUser(null));
    if (!hasStoredSession()) return;
    // После перезагрузки страницы access-токена в памяти нет: восстанавливаем сессию по refresh-cookie.
    refreshSession()
      .then(applyUser)
      .catch(() => applyUser(null))
      .finally(() => setReady(true));
  }, [applyUser]);

  const value = useMemo(() => ({
    user,
    ready,
    async login(email, password) {
      applyUser(await api.login(email, password));
    },
    async logout() {
      try {
        await api.logout();
      } finally {
        applyUser(null);
      }
    },
  }), [user, ready, applyUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

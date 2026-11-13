import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Загружает данные и перезагружает их при смене зависимостей.
 * Ответ устаревшего запроса отбрасывается, чтобы быстрый ввод в фильтре не показал старый список.
 */
export function useLoad(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const counter = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  const reload = useCallback(async () => {
    const id = ++counter.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await load();
      if (id === counter.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === counter.current) setState((prev) => ({ ...prev, error, loading: false }));
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload, setData: (data) => setState((prev) => ({ ...prev, data })) };
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

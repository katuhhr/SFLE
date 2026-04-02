/**
 * Базовый URL бэкенда.
 * В development без REACT_APP_API_ORIGIN — относительные пути (тот же origin, что у React),
 * запросы проксируются на Django через "proxy" в package.json — без CORS и без жёсткого 127.0.0.1.
 * Явно задать API: REACT_APP_API_ORIGIN=http://127.0.0.1:8000
 */
const explicit = process.env.REACT_APP_API_ORIGIN;
const origin =
    explicit != null && String(explicit).trim() !== ''
        ? String(explicit).replace(/\/$/, '')
        : process.env.NODE_ENV === 'development'
          ? ''
          : '';

export function apiUrl(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${origin}${p}`;
}

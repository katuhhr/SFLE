/**
 * Базовый URL бэкенда.
 * В разработке оставьте пустым: запросы идут на тот же хост, что и React (:3000),
 * а create-react-app проксирует их на Django (см. "proxy" в package.json).
 * Для сборки без proxy: REACT_APP_API_ORIGIN=http://127.0.0.1:8000
 */
const origin = (process.env.REACT_APP_API_ORIGIN ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${origin}${p}`;
}

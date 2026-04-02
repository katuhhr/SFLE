/**
 * Базовый URL бэкенда.
 * В development по умолчанию идём напрямую на Django (:8000): так надёжнее, чем
 * полагаться только на "proxy" в package.json (он не работает для preview/другого порта).
 * Переопределение: REACT_APP_API_ORIGIN=...
 */
const defaultDevOrigin =
    process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000' : '';

const origin = (process.env.REACT_APP_API_ORIGIN ?? defaultDevOrigin).replace(/\/$/, '');

export function apiUrl(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${origin}${p}`;
}

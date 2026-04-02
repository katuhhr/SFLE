import { apiUrl } from '../config';

/** Сброс сессии и переход на страницу входа */
export function logoutAndGoLogin(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    if (window.location.pathname !== '/' && !window.location.pathname.startsWith('/index')) {
        window.location.assign('/');
    }
}

const NETWORK_ERROR_HEADERS = {
    'Content-Type': 'application/json',
    'X-Client-Error': 'network',
} as const;

function networkErrorResponse(): Response {
    return new Response(
        JSON.stringify({
            detail:
                'Нет связи с сервером. Запустите бэкенд: из корня репозитория выполните python manage.py runserver 127.0.0.1:8000',
        }),
        { status: 503, headers: NETWORK_ERROR_HEADERS },
    );
}

/**
 * fetch с Bearer access; при 401 один раз обновляет access через refresh и повторяет запрос.
 * При обрыве сети не бросает исключение — возвращает 503 (чтобы не было «Uncaught» в React).
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const doFetch = (access: string | null) => {
        const h = new Headers(init.headers);
        h.set('Accept', 'application/json');
        if (access) {
            h.set('Authorization', `Bearer ${access}`);
        }
        return fetch(apiUrl(path), { ...init, headers: h });
    };

    try {
        let access = localStorage.getItem('access_token');
        let res = await doFetch(access);

        if (res.status !== 401) {
            return res;
        }

        const refresh = localStorage.getItem('refresh_token');
        if (!refresh) {
            logoutAndGoLogin();
            return res;
        }

        const tr = await fetch(apiUrl('/api/auth/token/refresh/'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ refresh }),
        });
        const data = (await tr.json().catch(() => ({}))) as { access?: string };
        if (!tr.ok || !data.access) {
            logoutAndGoLogin();
            return res;
        }

        localStorage.setItem('access_token', data.access);
        res = await doFetch(data.access);
        return res;
    } catch {
        return networkErrorResponse();
    }
}

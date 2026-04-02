const API_BASE = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

async function parseResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
}

export function apiGet<T>(path: string): Promise<T> {
    return fetch(`${API_BASE}${path}`, {
        method: 'GET',
        credentials: 'include',
    }).then(parseResponse<T>);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
    return fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    }).then(parseResponse<T>);
}

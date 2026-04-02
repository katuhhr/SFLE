import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../api/authFetch';

/**
 * Доступ только при JWT и role === admin (проверка через /api/auth/me/).
 */
const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const [ready, setReady] = useState(false);
    const [netError, setNetError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setNetError(null);
            if (!localStorage.getItem('access_token') && !localStorage.getItem('refresh_token')) {
                navigate('/', { replace: true });
                return;
            }
            const res = await authFetch('/api/auth/me/');
            const data = (await res.json().catch(() => ({}))) as { role?: string; detail?: string };
            if (cancelled) return;
            if (res.headers.get('X-Client-Error') === 'network') {
                setNetError(data.detail || 'Нет связи с сервером.');
                return;
            }
            if (!res.ok || data.role !== 'admin') {
                navigate('/', { replace: true });
                return;
            }
            setReady(true);
        })();
        return () => {
            cancelled = true;
        };
    }, [navigate]);

    if (netError) {
        return (
            <div style={{ padding: 40, maxWidth: 520, margin: '0 auto', color: '#334155' }}>
                <p style={{ color: '#b91c1c', marginBottom: 12 }}>{netError}</p>
                <p style={{ fontSize: 14, color: '#64748b' }}>
                    Фронт в режиме разработки проксирует запросы на{' '}
                    <code style={{ fontSize: 13 }}>http://127.0.0.1:8000</code> (см. package.json → proxy).
                </p>
            </div>
        );
    }

    if (!ready) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                Проверка доступа…
            </div>
        );
    }

    return <>{children}</>;
};

export default AdminGuard;

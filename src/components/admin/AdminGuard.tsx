import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../api/authFetch';

/**
 * Доступ только при JWT и role === admin (проверка через /api/auth/me/).
 */
const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!localStorage.getItem('access_token') && !localStorage.getItem('refresh_token')) {
                navigate('/', { replace: true });
                return;
            }
            const res = await authFetch('/api/auth/me/');
            const data = (await res.json().catch(() => ({}))) as { role?: string };
            if (cancelled) return;
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

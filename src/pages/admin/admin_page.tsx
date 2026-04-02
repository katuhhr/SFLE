import React, { FC, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../api/authFetch';
import { ITeacher } from '../../types/types';
import './admin_page.css';

interface ApiApplication {
    id: number;
    full_name: string;
    user_email?: string;
    type: string;
}

interface ApiTeacher {
    id: number;
    full_name: string;
    email?: string;
}

function typeLabel(t: string): string {
    if (t === 'student_registration_confirm') return 'Регистрация студента';
    return t || 'Заявка';
}

const AdminPage: FC = () => {
    const navigate = useNavigate();

    const [requests, setRequests] = useState<ApiApplication[]>([]);
    const [teachers, setTeachers] = useState<ITeacher[]>([]);
    const [adminName, setAdminName] = useState('Администратор');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actingId, setActingId] = useState<number | null>(null);

    const loadMe = useCallback(async () => {
        const res = await authFetch('/api/auth/me/');
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            const fn = (data as { full_name?: string; firstname?: string; lastname?: string }).full_name;
            const fn2 = `${(data as { firstname?: string }).firstname || ''} ${(data as { lastname?: string }).lastname || ''}`.trim();
            if (fn) setAdminName(fn);
            else if (fn2) setAdminName(fn2);
        }
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [appRes, teachRes] = await Promise.all([
                authFetch('/api/admin/applications/'),
                authFetch('/api/admin/teachers/'),
            ]);
            const appPayload = await appRes.json().catch(() => ({}));
            const teachPayload = await teachRes.json().catch(() => ({}));

            if (!appRes.ok) {
                setError((appPayload as { detail?: string }).detail || 'Не удалось загрузить заявки');
                setRequests([]);
            } else {
                setRequests(((appPayload as { data?: ApiApplication[] }).data || []).filter(Boolean));
            }

            if (!teachRes.ok) {
                if (!appRes.ok) {
                    /* already set error */
                } else {
                    setError((teachPayload as { detail?: string }).detail || 'Не удалось загрузить преподавателей');
                }
                setTeachers([]);
            } else {
                const rows = (teachPayload as { data?: ApiTeacher[] }).data || [];
                setTeachers(
                    rows.map((t) => ({
                        id: t.id,
                        fullName: (t.full_name || '').trim() || t.email || `Пользователь ${t.id}`,
                        role: 'Преподаватель',
                    })),
                );
            }
        } catch {
            setError('Нет связи с сервером.');
            setRequests([]);
            setTeachers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadMe();
    }, [loadMe]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleApprove = async (req: ApiApplication) => {
        setActingId(req.id);
        setError(null);
        try {
            const res = await authFetch(`/api/admin/applications/${req.id}/approve/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((payload as { detail?: string }).detail || 'Не удалось принять заявку');
                return;
            }
            await loadData();
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setActingId(null);
        }
    };

    const handleReject = async (req: ApiApplication) => {
        if (!window.confirm(`Отклонить заявку №${req.id} (${req.full_name})?`)) return;
        setActingId(req.id);
        setError(null);
        try {
            const res = await authFetch(`/api/admin/applications/${req.id}/reject/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'Отклонено администратором' }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((payload as { detail?: string }).detail || 'Не удалось отклонить заявку');
                return;
            }
            await loadData();
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setActingId(null);
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/', { replace: true });
    };

    return (
        <div className="admin-page-container">
            <aside className="admin-sidebar">
                <div className="avatar-placeholder" aria-hidden />
                <div className="admin-profile-meta">
                    <p className="meta-name">{adminName}</p>
                    <p className="meta-role">Администратор</p>
                    <button type="button" className="admin-logout-btn" onClick={logout}>
                        Выйти
                    </button>
                </div>
            </aside>

            <main className="admin-content-area">
                {loading && <p className="admin-status">Загрузка…</p>}
                {error && (
                    <div className="admin-error" role="alert">
                        {error}
                    </div>
                )}

                <section className="white-card requests-card">
                    <div className="card-header">
                        <h3 className="card-title">Таблица заявок</h3>
                    </div>
                    <table className="admin-table-styled">
                        <thead>
                            <tr>
                                <th>№</th>
                                <th>ФИО</th>
                                <th>Тип</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>
                                        Нет активных заявок
                                    </td>
                                </tr>
                            )}
                            {requests.map((req) => (
                                <tr key={req.id}>
                                    <td>№{req.id}</td>
                                    <td>{req.full_name}</td>
                                    <td>{typeLabel(req.type)}</td>
                                    <td className="btns-cell">
                                        <button
                                            type="button"
                                            className="outline-btn"
                                            disabled={actingId === req.id}
                                            onClick={() => void handleApprove(req)}
                                        >
                                            Принять
                                        </button>
                                        <button
                                            type="button"
                                            className="outline-btn"
                                            disabled={actingId === req.id}
                                            onClick={() => void handleReject(req)}
                                        >
                                            Отклонить
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                {teachers.length > 0 && (
                    <section className="white-card teachers-card">
                        <h3 className="card-title">Преподаватели</h3>
                        <div className="teachers-name-grid">
                            {teachers.map((t, idx) => (
                                <div
                                    key={`${t.id}-${idx}`}
                                    className="teacher-grid-item"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => navigate(`/admin/teacher/${t.id}`)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            navigate(`/admin/teacher/${t.id}`);
                                        }
                                    }}
                                >
                                    {t.fullName}
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};

export default AdminPage;

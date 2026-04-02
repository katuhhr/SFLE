import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../../config';
import './login.css';

type RegisterGroupOption = { id: number; name: string; label: string };

function formatApiError(data: unknown, fallback: string): string {
    if (data == null || typeof data !== 'object') return fallback;
    const d = data as Record<string, unknown>;
    const detail = d.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
        const s = detail.map(String).filter(Boolean).join(' ');
        if (s) return s;
    }
    if (detail && typeof detail === 'object') {
        const parts = Object.values(detail).flatMap((v) =>
            Array.isArray(v) ? v.map(String) : [String(v)],
        );
        const s = parts.filter(Boolean).join(' ');
        if (s) return s;
    }
    for (const [, v] of Object.entries(d)) {
        if (Array.isArray(v)) {
            const s = v.map(String).filter(Boolean).join(' ');
            if (s) return s;
        }
        if (typeof v === 'string' && v.trim()) return v;
    }
    return fallback;
}

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [view, setView] = useState<'main' | 'signup' | 'login'>('main');
    const [role, setRole] = useState<'student' | 'teacher'>('student');

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [groupId, setGroupId] = useState('');
    const [groups, setGroups] = useState<RegisterGroupOption[]>([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [groupsError, setGroupsError] = useState<string | null>(null);

    const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const resetFormMessage = () => setMessage(null);

    useEffect(() => {
        if (view !== 'signup') return;
        let cancelled = false;
        setGroupsLoading(true);
        setGroupsError(null);
        (async () => {
            try {
                const res = await fetch(apiUrl('/api/auth/register/groups/'), {
                    headers: { Accept: 'application/json' },
                });
                const data = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (!res.ok) {
                    setGroupsError(formatApiError(data, 'Не удалось загрузить список групп.'));
                    setGroups([]);
                    return;
                }
                const raw = (data as { data?: unknown }).data;
                setGroups(Array.isArray(raw) ? (raw as RegisterGroupOption[]) : []);
            } catch {
                if (!cancelled) {
                    setGroupsError('Нет связи с сервером при загрузке групп.');
                    setGroups([]);
                }
            } finally {
                if (!cancelled) setGroupsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [view]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        resetFormMessage();
        setLoading(true);
        try {
            const res = await fetch(apiUrl('/api/auth/register/'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    email,
                    password,
                    role,
                    ...(role === 'student' && groupId ? { group_id: Number(groupId) } : {}),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMessage({
                    type: 'err',
                    text: formatApiError(data, 'Ошибка регистрации'),
                });
                return;
            }
            const pending = (data as { pending?: boolean }).pending;
            const r = (data as { role?: string }).role;

            setMessage({
                type: 'ok',
                text: pending
                    ? r === 'teacher'
                        ? 'Регистрация прошла успешно. Ожидайте подтверждения администратором.'
                        : 'Регистрация прошла успешно. Ожидайте подтверждения преподавателем.'
                    : (data as { message?: string }).message || 'Успешно',
            });

            setTimeout(() => {
                if (pending) {
                    setView('login');
                    return;
                }
                navigate(r === 'teacher' ? '/teacher/schedule' : '/student/debts');
            }, 600);
        } catch {
            setMessage({ type: 'err', text: 'Нет связи с сервером. Запущен ли бэкенд (порт 8000)?' });
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        resetFormMessage();
        setLoading(true);

        try {
            const res = await fetch(apiUrl('/api/auth/token/'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMessage({ type: 'err', text: formatApiError(data, 'Ошибка входа') });
                return;
            }

            const access = (data as { access?: string }).access || '';
            const refresh = (data as { refresh?: string }).refresh || '';
            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);

            const meRes = await fetch(apiUrl('/api/auth/me/'), {
                headers: { Authorization: `Bearer ${access}`, Accept: 'application/json' },
            });
            const me = await meRes.json().catch(() => ({}));
            if (!meRes.ok) {
                setMessage({ type: 'err', text: 'Не удалось получить данные пользователя.' });
                return;
            }

            const role = (me as { role?: string }).role;
            if (role === 'admin') {
                navigate('/admin');
            } else if (role === 'teacher') {
                navigate('/teacher/schedule');
            } else {
                navigate('/student/debts');
            }
        } catch {
            setMessage({ type: 'err', text: 'Нет связи с сервером. Запущен ли бэкенд (порт 8000)?' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="auth-full-page"
            style={{ backgroundImage: "url('/college.png')" }}
        >
            <div className="auth-card">
                <div className="auth-header">
                    <img className="auth-logo" src="/logo.png" alt="Logo" />
                    <div className="auth-nav-btns">
                        <button
                            type="button"
                            className={`nav-btn reg-btn ${view === 'signup' ? 'active-nav' : ''}`}
                            onClick={() => {
                                setView('signup');
                                resetFormMessage();
                            }}
                        >
                            Регистрация
                        </button>
                        <button
                            type="button"
                            className={`nav-btn login-nav-btn ${view === 'login' ? 'active-nav' : ''}`}
                            onClick={() => {
                                setView('login');
                                resetFormMessage();
                            }}
                        >
                            Войти
                        </button>
                    </div>
                </div>

                <div className="auth-body">
                    {view === 'main' ? (
                        <div className="main-welcome">
                            <h1 className="auth-title">OWLISH</h1>
                            <p className="auth-desc">
                                Специализированная платформа для английского языка.
                                Платформа создана для того, чтобы сделать изучение и
                                преподавание английского языка в колледже структурированным
                                и комфортным для всех.
                            </p>
                        </div>
                    ) : (
                        <div className="auth-form-container">
                            <button type="button" className="form-back" onClick={() => setView('main')}>
                                ← Назад
                            </button>
                            <h2 className="form-title">{view === 'signup' ? 'Создать аккаунт' : 'Войти в аккаунт'}</h2>

                            {message && (
                                <div className={message.type === 'ok' ? 'auth-flash auth-flash-ok' : 'auth-flash auth-flash-err'}>
                                    {message.text}
                                </div>
                            )}

                            <form
                                className="auth-form"
                                onSubmit={view === 'signup' ? handleSignup : handleLogin}
                            >
                                {view === 'signup' && (
                                    <div className="field-wrap">
                                        <input
                                            type="text"
                                            placeholder="Ваше ФИО"
                                            required
                                            value={fullName}
                                            onChange={(ev) => setFullName(ev.target.value)}
                                            disabled={loading}
                                        />
                                    </div>
                                )}
                                <div className="field-wrap">
                                    <input
                                        type="text"
                                        inputMode="email"
                                        autoComplete="email"
                                        placeholder="example@mail.com"
                                        required
                                        value={email}
                                        onChange={(ev) => setEmail(ev.target.value)}
                                        disabled={loading}
                                    />
                                </div>
                                <div className="field-wrap">
                                    <input
                                        type="password"
                                        placeholder="Введите пароль"
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(ev) => setPassword(ev.target.value)}
                                        disabled={loading}
                                    />
                                </div>

                                {view === 'signup' && (
                                    <div className="role-selection-area">
                                        <div className="radio-group">
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    checked={role === 'student'}
                                                    onChange={() => {
                                                        setRole('student');
                                                    }}
                                                    disabled={loading}
                                                />{' '}
                                                Студент
                                            </label>
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    checked={role === 'teacher'}
                                                    onChange={() => {
                                                        setRole('teacher');
                                                        setGroupId('');
                                                    }}
                                                    disabled={loading}
                                                />{' '}
                                                Преподаватель
                                            </label>
                                        </div>
                                        {role === 'student' && (
                                            <>
                                                {groupsError ? (
                                                    <p className="groups-load-err">{groupsError}</p>
                                                ) : null}
                                                <select
                                                    className="group-select"
                                                    required
                                                    value={groupId}
                                                    onChange={(ev) => setGroupId(ev.target.value)}
                                                    disabled={loading || groupsLoading || groups.length === 0}
                                                >
                                                    <option value="">
                                                        {groupsLoading ? 'Загрузка групп…' : 'Выберите группу'}
                                                    </option>
                                                    {groups.map((g) => (
                                                        <option key={g.id} value={String(g.id)}>
                                                            {g.label || g.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {!groupsLoading && groups.length === 0 && !groupsError ? (
                                                    <p className="groups-load-err">
                                                        В системе пока нет групп. Обратитесь к администратору.
                                                    </p>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                )}

                                {view === 'login' && (
                                    <p className="forgot-text">
                                        <a href="#">Забыли пароль?</a>
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    className="auth-submit-btn"
                                    disabled={
                                        loading ||
                                        (view === 'signup' &&
                                            role === 'student' &&
                                            (groupsLoading || !!groupsError || groups.length === 0))
                                    }
                                >
                                    {loading
                                        ? 'Отправка…'
                                        : view === 'signup'
                                          ? 'Зарегистрироваться'
                                          : 'Войти'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;

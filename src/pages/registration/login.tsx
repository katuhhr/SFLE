import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../../config';
import './login.css';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [view, setView] = useState<'main' | 'signup' | 'login'>('main');
    const [role, setRole] = useState<'student' | 'teacher'>('student');

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [groupName, setGroupName] = useState('');

    const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const resetFormMessage = () => setMessage(null);

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
                    group_name: role === 'student' ? groupName : '',
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMessage({ type: 'err', text: (data as { detail?: string }).detail || 'Ошибка регистрации' });
                return;
            }
            const pending = (data as { pending?: boolean }).pending;
            const r = (data as { role?: string }).role;

            setMessage({
                type: 'ok',
                text:
                    pending
                        ? 'Регистрация прошла успешно. Ожидайте подтверждения преподавателем.'
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
                body: JSON.stringify({ username: email, password }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMessage({ type: 'err', text: (data as { detail?: string }).detail || 'Ошибка входа' });
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
                                        type="email"
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
                                                    onChange={() => setRole('student')}
                                                    disabled={loading}
                                                />{' '}
                                                Студент
                                            </label>
                                            <label className="radio-label">
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    checked={role === 'teacher'}
                                                    onChange={() => setRole('teacher')}
                                                    disabled={loading}
                                                />{' '}
                                                Преподаватель
                                            </label>
                                        </div>
                                        {role === 'student' && (
                                            <input
                                                type="text"
                                                placeholder="Номер группы"
                                                className="group-input"
                                                required
                                                value={groupName}
                                                onChange={(ev) => setGroupName(ev.target.value)}
                                                disabled={loading}
                                            />
                                        )}
                                    </div>
                                )}

                                {view === 'login' && (
                                    <p className="forgot-text">
                                        <a href="#">Забыли пароль?</a>
                                    </p>
                                )}

                                <button type="submit" className="auth-submit-btn" disabled={loading}>
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

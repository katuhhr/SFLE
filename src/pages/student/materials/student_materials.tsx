import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './student_materials.css';
import { authFetch } from '../../../api/authFetch';

interface MaterialRow {
    id: number;
    title: string;
    type: string;
    url: string | null;
    description: string | null;
    created_at?: string | null;
}

interface ThemeRow {
    id: number;
    name: string;
    materials: MaterialRow[];
    major_id?: number | null;
    course_id?: number | null;
    major_name?: string | null;
    course_number?: number | null;
    is_common?: boolean;
}

function formatApiError(payload: unknown, fallback: string): string {
    const p = payload as { detail?: unknown; message?: string };
    if (typeof p.message === 'string' && p.message) {
        return p.message;
    }
    const d = p.detail;
    if (typeof d === 'string') {
        return d;
    }
    if (Array.isArray(d) && d.length) {
        return d.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    }
    if (d && typeof d === 'object') {
        const o = d as Record<string, unknown>;
        const first = Object.values(o)[0];
        if (Array.isArray(first) && first.length && typeof first[0] === 'string') {
            return first.join(' ');
        }
    }
    return fallback;
}

const StudentMaterials: React.FC = () => {
    const [themes, setThemes] = useState<ThemeRow[]>([]);
    const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null);
    const [themeListOpen, setThemeListOpen] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!localStorage.getItem('access_token') && !localStorage.getItem('refresh_token')) {
            setLoading(false);
            setThemes([]);
            setSelectedThemeId(null);
            setError('Войдите в аккаунт, чтобы видеть материалы.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch('/api/student/learning-materials/');
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setThemes([]);
                setSelectedThemeId(null);
                setError(formatApiError(payload, 'Не удалось загрузить материалы'));
                return;
            }
            const data = (payload as { data?: ThemeRow[] }).data || [];
            const list = Array.isArray(data) ? data : [];
            setThemes(list);
            setSelectedThemeId(list.length ? list[0].id : null);
        } catch {
            setThemes([]);
            setSelectedThemeId(null);
            setError('Нет связи с сервером.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const selectedTheme = themes.find((t) => t.id === selectedThemeId) ?? null;
    const materials = selectedTheme?.materials ?? [];

    return (
        <div className="materials-page-container">
            <aside className="materials-sidebar">
                <button
                    type="button"
                    className="sidebar-theme-dropdown-trigger"
                    onClick={() => setThemeListOpen((o) => !o)}
                    aria-expanded={themeListOpen}
                >
                    <span>Тема</span>
                    <ChevronDown
                        size={20}
                        strokeWidth={2}
                        className={`sidebar-theme-chevron ${themeListOpen ? 'is-open' : ''}`}
                        aria-hidden
                    />
                </button>

                {themeListOpen && (
                    <nav className="topics-list" aria-label="Список тем">
                        {loading && <div className="sidebar-status">Загрузка…</div>}
                        {error && <div className="sidebar-status sidebar-status-err">{error}</div>}
                        {!loading && !error && themes.length === 0 && (
                            <div className="sidebar-status">
                                Для вашей специальности и курса пока нет тем в базе.
                            </div>
                        )}
                        {!loading &&
                            !error &&
                            themes.map((theme) => (
                                <button
                                    key={theme.id}
                                    type="button"
                                    className={`theme-topic-row ${selectedThemeId === theme.id ? 'active' : ''}`}
                                    onClick={() => setSelectedThemeId(theme.id)}
                                >
                                    <span className="theme-topic-name">{theme.name}</span>
                                </button>
                            ))}
                    </nav>
                )}
            </aside>

            <main className="materials-content">
                <div className="content-inner-card">
                    {loading && (
                        <div className="content-body-sheet">
                            <p className="lecturer-text muted">Загрузка материалов…</p>
                        </div>
                    )}
                    {!loading && error && (
                        <div className="content-body-sheet">
                            <p className="lecturer-text muted">Не удалось загрузить данные. Смотрите сообщение слева.</p>
                        </div>
                    )}
                    {!loading && !error && themes.length === 0 && (
                        <div className="content-body-sheet">
                            <p className="lecturer-text muted">
                                Для вашей группы в базе пока нет тем с материалами по выбранной специальности и курсу.
                            </p>
                        </div>
                    )}
                    {!loading && !error && themes.length > 0 && selectedTheme ? (
                        <>
                            <header className="content-topic-header">
                                <span className="content-topic-title">{selectedTheme.name}</span>
                            </header>

                            {materials.length === 0 ? (
                                <div className="content-body-sheet">
                                    <p className="lecturer-text muted">
                                        В этой теме пока нет прикреплённых материалов в базе.
                                    </p>
                                </div>
                            ) : (
                                <ul className="materials-article-list">
                                    {materials.map((m) => (
                                        <li key={m.id} className="material-article-card">
                                            <div className="material-article-head">
                                                <h3 className="material-article-title">{m.title}</h3>
                                                <span className="content-type-badge">{m.type}</span>
                                            </div>
                                            <div className="material-article-body">
                                                {m.url && (
                                                    <p className="material-link-row">
                                                        <a
                                                            href={m.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="material-external-link"
                                                        >
                                                            {m.url}
                                                        </a>
                                                    </p>
                                                )}
                                                {m.description ? (
                                                    <div className="lecturer-text material-description">
                                                        {m.description}
                                                    </div>
                                                ) : (
                                                    !m.url && (
                                                        <p className="lecturer-text muted">Без описания.</p>
                                                    )
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    ) : !loading && !error && themes.length > 0 && !selectedTheme ? (
                        <div className="content-body-sheet">
                            <p className="lecturer-text muted">Выберите тему слева.</p>
                        </div>
                    ) : null}
                </div>
            </main>
        </div>
    );
};

export default StudentMaterials;

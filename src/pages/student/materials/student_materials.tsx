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

interface TheoryBlock {
    id: number;
    title: string;
    content: string;
}

interface ThemeTask {
    id: number;
    text: string;
    deadline: string;
}

interface ThemeDetailPayload {
    id: number;
    name: string;
    major_id?: number | null;
    course_id?: number | null;
    theory: TheoryBlock | null;
    tasks: ThemeTask[];
    materials?: MaterialRow[];
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
    const [themeDetail, setThemeDetail] = useState<ThemeDetailPayload | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

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

    useEffect(() => {
        if (!selectedThemeId || loading || error) {
            setThemeDetail(null);
            setDetailError(null);
            setDetailLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setThemeDetail(null);
            setDetailLoading(true);
            setDetailError(null);
            try {
                const res = await authFetch(`/api/student/themes/${selectedThemeId}/`);
                const json = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (res.status === 404) {
                    const st = themes.find((t) => t.id === selectedThemeId);
                    setThemeDetail({
                        id: selectedThemeId,
                        name: st?.name ?? 'Тема',
                        theory: null,
                        tasks: [],
                    });
                    setDetailError(null);
                    return;
                }
                if (!res.ok) {
                    setThemeDetail(null);
                    setDetailError(formatApiError(json, 'Не удалось загрузить содержимое темы'));
                    return;
                }
                const data = (json as { data?: ThemeDetailPayload }).data;
                setThemeDetail(data ?? null);
            } catch {
                if (!cancelled) {
                    setThemeDetail(null);
                    setDetailError('Нет связи с сервером.');
                }
            } finally {
                if (!cancelled) setDetailLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedThemeId, loading, error, themes]);

    const selectedTheme = themes.find((t) => t.id === selectedThemeId) ?? null;
    const catalogMaterials = selectedTheme?.materials ?? [];
    /** После загрузки детали темы — материалы из material.theme_id (как в БД); до этого — из списка learning-materials. */
    const materialsRows =
        themeDetail && !detailLoading
            ? Array.isArray(themeDetail.materials)
                ? themeDetail.materials
                : catalogMaterials
            : catalogMaterials;

    const formatDeadline = (iso: string) => {
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return iso;
            return d.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return iso;
        }
    };
    const showTestsStub = () => {
        window.alert('Тесты в разработке.');
    };

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
                            <div className="mini-nav">
                                <button type="button" className="mini-link" onClick={showTestsStub}>
                                    Тесты
                                </button>
                            </div>

                            {detailLoading && (
                                <p className="lecturer-text muted materials-detail-loading">
                                    Загрузка теории, заданий и материалов…
                                </p>
                            )}
                            {detailError && (
                                <p className="lecturer-text materials-detail-err" role="alert">
                                    {detailError}
                                </p>
                            )}

                            {themeDetail && !detailLoading && !detailError && (
                                <>
                                    <section className="materials-detail-section" aria-labelledby="theory-heading">
                                        <h2 id="theory-heading" className="materials-detail-heading">
                                            Теория
                                        </h2>
                                        {!themeDetail.theory ? (
                                            <p className="lecturer-text muted materials-empty-msg">
                                                Теории по теме «{themeDetail.name}» нет.
                                            </p>
                                        ) : (
                                            <>
                                                {themeDetail.theory.title ? (
                                                    <h3 className="materials-theory-subtitle">
                                                        {themeDetail.theory.title}
                                                    </h3>
                                                ) : null}
                                                <div className="lecturer-text materials-theory-body">
                                                    {themeDetail.theory.content?.trim()
                                                        ? themeDetail.theory.content
                                                        : `Текста теории по теме «${themeDetail.name}» пока нет.`}
                                                </div>
                                            </>
                                        )}
                                    </section>

                                    <section className="materials-detail-section" aria-labelledby="tasks-heading">
                                        <h2 id="tasks-heading" className="materials-detail-heading">
                                            Задания
                                        </h2>
                                        {(themeDetail.tasks?.length ?? 0) === 0 ? (
                                            <p className="lecturer-text muted materials-empty-msg">
                                                Заданий по теме «{themeDetail.name}» нет.
                                            </p>
                                        ) : (
                                            <ul className="materials-task-list">
                                                {themeDetail.tasks.map((task) => (
                                                    <li key={task.id} className="materials-task-item">
                                                        <p className="materials-task-text">{task.text}</p>
                                                        <p className="materials-task-deadline">
                                                            Срок: {formatDeadline(task.deadline)}
                                                        </p>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </section>
                                </>
                            )}

                            <section className="materials-detail-section" aria-labelledby="materials-heading">
                                <h2 id="materials-heading" className="materials-detail-heading">
                                    Материалы темы
                                </h2>
                                {materialsRows.length === 0 ? (
                                    <div className="content-body-sheet">
                                        <p className="lecturer-text muted materials-empty-msg">
                                            Материалов по теме «{selectedTheme.name}» нет.
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="materials-article-list">
                                        {materialsRows.map((m) => (
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
                            </section>

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

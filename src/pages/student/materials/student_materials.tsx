import React, { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '../../../config';
import './student_materials.css';

interface MaterialRow {
    id: number;
    title: string;
    type: string;
    url: string | null;
    description: string | null;
    created_at: string;
}

interface ThemeRow {
    id: number;
    name: string;
    materials: MaterialRow[];
}

interface MaterialsContext {
    major_name: string | null;
    course_number: number | null;
}

const StudentMaterials: React.FC = () => {
    const [themes, setThemes] = useState<ThemeRow[]>([]);
    const [context, setContext] = useState<MaterialsContext | null>(null);
    const [selected, setSelected] = useState<MaterialRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const token = localStorage.getItem('access_token');
    const makeHeaders = (): HeadersInit => ({
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });

    const load = useCallback(async () => {
        if (!token) {
            setLoading(false);
            setError('Войдите в аккаунт, чтобы видеть материалы.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(apiUrl('/api/student/learning-materials/'), { headers: makeHeaders() });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((payload as { detail?: string }).detail || 'Не удалось загрузить материалы');
                return;
            }
            const data = (payload as { data?: ThemeRow[]; context?: MaterialsContext | null }).data || [];
            const ctx = (payload as { context?: MaterialsContext | null }).context ?? null;
            setThemes(data);
            setContext(ctx);
            const firstMat = data.flatMap((t) => t.materials)[0] ?? null;
            setSelected(firstMat);
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        load();
    }, [load]);

    const headerLabel =
        context?.major_name != null && context?.course_number != null
            ? `${context.course_number} ${context.major_name}`
            : 'Учебные материалы';

    const flatMaterials = themes.flatMap((t) =>
        t.materials.map((m) => ({ theme: t.name, material: m })),
    );

    return (
        <div className="materials-page-container">
            <aside className="materials-sidebar">
                <div className="sidebar-header">
                    <span>{headerLabel}</span>
                </div>
                <nav className="topics-list">
                    {loading && <div className="sidebar-status">Загрузка…</div>}
                    {error && <div className="sidebar-status sidebar-status-err">{error}</div>}
                    {!loading && !error && flatMaterials.length === 0 && (
                        <div className="sidebar-status">Для вашей группы пока нет материалов.</div>
                    )}
                    {themes.map((theme) => (
                        <div key={theme.id} className="sidebar-theme-block">
                            <div className="sidebar-theme-title">{theme.name}</div>
                            {theme.materials.map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    className={`topic-item ${selected?.id === m.id ? 'active' : ''}`}
                                    onClick={() => setSelected(m)}
                                >
                                    {m.title}
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>
            </aside>

            <main className="materials-content">
                <div className="content-inner-card">
                    {selected ? (
                        <>
                            <header className="content-topic-header">{selected.title}</header>
                            <div className="content-meta">
                                <span className="content-type-badge">{selected.type}</span>
                            </div>
                            <div className="content-body-sheet">
                                {selected.url && (
                                    <p className="material-link-row">
                                        <a
                                            href={selected.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="material-external-link"
                                        >
                                            {selected.url}
                                        </a>
                                    </p>
                                )}
                                {selected.description ? (
                                    <div className="lecturer-text material-description">{selected.description}</div>
                                ) : (
                                    !selected.url && <p className="lecturer-text muted">Нет текста.</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="content-body-sheet">
                            {!loading && <p className="lecturer-text muted">Выберите материал слева.</p>}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default StudentMaterials;

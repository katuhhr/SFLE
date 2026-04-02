import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Edit2, Check, ArrowLeft } from 'lucide-react';
import { apiUrl } from '../../../config';
import './teacher_materials.css';

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

interface CatalogCourse {
    id: number;
    number: number;
}

/** Учебная группа в сайдбаре: под ней — курсы; темы грузятся по major_id группы + course_id. */
interface CatalogGroup {
    id: number;
    name: string;
    major_id: number | null;
    major_label: string;
    courses: CatalogCourse[];
}

const MATERIAL_TYPES = [
    { value: 'text', label: 'Текст' },
    { value: 'link', label: 'Ссылка' },
    { value: 'video', label: 'Видео' },
    { value: 'file', label: 'Файл' },
];

const TeacherMaterials: React.FC = () => {
    const [catalog, setCatalog] = useState<CatalogGroup[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
    const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
    const [topics, setTopics] = useState<ThemeRow[]>([]);
    const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null);
    const [selectedMaterial, setSelectedMaterial] = useState<MaterialRow | null>(null);
    const [loadingCatalog, setLoadingCatalog] = useState(true);
    const [loadingTopics, setLoadingTopics] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [isEditingContent, setIsEditingContent] = useState(false);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftType, setDraftType] = useState('text');
    const [draftUrl, setDraftUrl] = useState('');
    const [draftDescription, setDraftDescription] = useState('');
    const [editingThemeId, setEditingThemeId] = useState<number | null>(null);
    const themeTitleInputRef = useRef<HTMLInputElement>(null);
    const catalogInitRef = useRef(false);

    const token = localStorage.getItem('access_token');
    const makeHeaders = (json = false): HeadersInit => ({
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(json ? { 'Content-Type': 'application/json' } : {}),
    });

    const fetchTopics = useCallback(
        async (majorId: number, courseId: number) => {
            if (!token) return;
            setLoadingTopics(true);
            setError(null);
            try {
                const res = await fetch(
                    apiUrl(`/api/admin/learning/topics/?major_id=${majorId}&course_id=${courseId}`),
                    { headers: makeHeaders() },
                );
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    setError((payload as { detail?: string }).detail || 'Не удалось загрузить темы');
                    setTopics([]);
                    return;
                }
                setTopics((payload as { data?: ThemeRow[] }).data || []);
            } catch {
                setError('Нет связи с сервером.');
                setTopics([]);
            } finally {
                setLoadingTopics(false);
            }
        },
        [token],
    );

    const loadCatalog = useCallback(async () => {
        if (!token) {
            setLoadingCatalog(false);
            setError('Войдите как преподаватель.');
            return;
        }
        setLoadingCatalog(true);
        setError(null);
        try {
            const res = await fetch(apiUrl('/api/admin/learning/catalog/'), { headers: makeHeaders() });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                const p = payload as { detail?: unknown; message?: string };
                const detail = p.detail;
                const msg =
                    (typeof detail === 'string' ? detail : undefined) ||
                    (typeof p.message === 'string' ? p.message : undefined) ||
                    `Ошибка ${res.status}: не удалось загрузить каталог`;
                setError(msg);
                setCatalog([]);
                return;
            }
            const data = (payload as { data?: CatalogGroup[] }).data || [];
            setCatalog(data);
            if (!catalogInitRef.current && data.length > 0) {
                catalogInitRef.current = true;
                const g0 = data[0];
                setExpandedGroups({ [g0.id]: true });
                setSelectedGroupId(g0.id);
                const c0 = g0.courses[0];
                setSelectedCourseId(c0?.id ?? null);
            }
        } catch {
            setError('Нет связи с сервером.');
            setCatalog([]);
        } finally {
            setLoadingCatalog(false);
        }
    }, [token]);

    useEffect(() => {
        loadCatalog();
    }, [loadCatalog]);

    const selectedGroup = catalog.find((g) => g.id === selectedGroupId);
    const selectedMajorId = selectedGroup?.major_id ?? null;

    useEffect(() => {
        if (selectedMajorId == null || selectedCourseId == null) {
            setTopics([]);
            return;
        }
        fetchTopics(selectedMajorId, selectedCourseId);
    }, [selectedMajorId, selectedCourseId, fetchTopics]);

    useEffect(() => {
        if (editingThemeId != null && themeTitleInputRef.current) {
            themeTitleInputRef.current.focus();
            themeTitleInputRef.current.select();
        }
    }, [editingThemeId]);

    const selectedCourse = selectedGroup?.courses.find((c) => c.id === selectedCourseId);
    const catalogTitle =
        selectedGroup && selectedCourse
            ? `${selectedCourse.number} курс · ${selectedGroup.name}`
            : 'Выберите группу и курс';

    const toggleGroup = (groupId: number) => {
        setExpandedGroups((e) => ({ ...e, [groupId]: !e[groupId] }));
    };

    const selectCourse = (groupId: number, courseId: number) => {
        setSelectedGroupId(groupId);
        setSelectedCourseId(courseId);
        setExpandedGroups((e) => ({ ...e, [groupId]: true }));
        setEditingThemeId(null);
        setSelectedThemeId(null);
        setSelectedMaterial(null);
    };

    const findTheme = (themeId: number): ThemeRow | undefined => topics.find((t) => t.id === themeId);

    const openTheme = (themeId: number) => {
        setEditingThemeId(null);
        setSelectedThemeId(themeId);
        setSelectedMaterial(null);
        setIsEditingContent(false);
    };

    const openMaterial = (m: MaterialRow, startInEditMode = false) => {
        setSelectedMaterial(m);
        setDraftTitle(m.title);
        setDraftType(m.type || 'text');
        setDraftUrl(m.url || '');
        setDraftDescription(m.description || '');
        setIsEditingContent(startInEditMode);
    };

    const backFromMaterial = () => {
        setSelectedMaterial(null);
        setIsEditingContent(false);
    };

    const refreshCurrentTopics = () => {
        const mid = selectedGroup?.major_id;
        if (mid != null && selectedCourseId != null) {
            fetchTopics(mid, selectedCourseId);
        }
    };

    const saveMaterialDraft = async () => {
        if (!selectedMaterial || !token) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(apiUrl(`/api/admin/learning/materials/${selectedMaterial.id}/`), {
                method: 'PATCH',
                headers: makeHeaders(true),
                body: JSON.stringify({
                    title: draftTitle,
                    type: draftType,
                    url: draftUrl || null,
                    description: draftDescription,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((payload as { detail?: string }).detail || 'Ошибка сохранения');
                return;
            }
            const row = (payload as { data?: MaterialRow }).data;
            if (row) setSelectedMaterial(row);
            setIsEditingContent(false);
            refreshCurrentTopics();
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const addTheme = async () => {
        if (!token || selectedMajorId == null || selectedCourseId == null) return;
        const themeName = window.prompt('Название темы', 'Новая тема');
        if (!themeName?.trim()) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(apiUrl('/api/admin/learning/themes/'), {
                method: 'POST',
                headers: makeHeaders(true),
                body: JSON.stringify({
                    major_id: selectedMajorId,
                    course_id: selectedCourseId,
                    name: themeName.trim(),
                }),
            });
            const p = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((p as { detail?: string }).detail || 'Не создана тема');
                return;
            }
            const newId = (p as { data?: { id?: number } }).data?.id;
            refreshCurrentTopics();
            if (newId) {
                setSelectedThemeId(newId);
                setEditingThemeId(null);
                const matRes = await fetch(apiUrl('/api/admin/learning/materials/'), {
                    method: 'POST',
                    headers: makeHeaders(true),
                    body: JSON.stringify({
                        theme_id: newId,
                        title: 'Новый материал',
                        type: 'text',
                        description: '',
                    }),
                });
                const mp = await matRes.json().catch(() => ({}));
                if (!matRes.ok) {
                    setError((mp as { detail?: string }).detail || 'Тема создана, но не удалось добавить материал');
                    refreshCurrentTopics();
                    return;
                }
                refreshCurrentTopics();
                const row = (mp as { data?: MaterialRow }).data;
                if (row) openMaterial(row, true);
            }
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const saveThemeTitle = async (themeId: number, name: string) => {
        setEditingThemeId(null);
        if (!token || !name.trim()) {
            return;
        }
        setSaving(true);
        try {
            await fetch(apiUrl(`/api/admin/learning/themes/${themeId}/`), {
                method: 'PATCH',
                headers: makeHeaders(true),
                body: JSON.stringify({ name: name.trim() }),
            });
            refreshCurrentTopics();
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const deleteTheme = async (e: React.MouseEvent, themeId: number, name: string) => {
        e.stopPropagation();
        if (!token || !window.confirm(`Удалить тему «${name}» и все материалы?`)) return;
        setSaving(true);
        try {
            await fetch(apiUrl(`/api/admin/learning/themes/${themeId}/`), {
                method: 'DELETE',
                headers: makeHeaders(),
            });
            if (selectedThemeId === themeId) {
                setSelectedThemeId(null);
                setSelectedMaterial(null);
            }
            if (editingThemeId === themeId) {
                setEditingThemeId(null);
            }
            refreshCurrentTopics();
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const addMaterial = async () => {
        if (!selectedThemeId || !token) return;
        setSaving(true);
        try {
            const res = await fetch(apiUrl('/api/admin/learning/materials/'), {
                method: 'POST',
                headers: makeHeaders(true),
                body: JSON.stringify({
                    theme_id: selectedThemeId,
                    title: 'Новый материал',
                    type: 'text',
                    description: '',
                }),
            });
            const p = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((p as { detail?: string }).detail || 'Не создан материал');
                return;
            }
            refreshCurrentTopics();
            const row = (p as { data?: MaterialRow }).data;
            if (row) openMaterial(row, true);
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const deleteMaterial = async (e: React.MouseEvent, m: MaterialRow) => {
        e.stopPropagation();
        if (!token || !window.confirm(`Удалить «${m.title}»?`)) return;
        setSaving(true);
        try {
            await fetch(apiUrl(`/api/admin/learning/materials/${m.id}/`), {
                method: 'DELETE',
                headers: makeHeaders(),
            });
            if (selectedMaterial?.id === m.id) backFromMaterial();
            refreshCurrentTopics();
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const onTopicRowKeyDown = (e: React.KeyboardEvent, themeId: number) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openTheme(themeId);
        }
    };

    const selectedTheme = selectedThemeId ? findTheme(selectedThemeId) : undefined;

    if (selectedMaterial) {
        return (
            <div className="materials-page-layout">
                <main className="materials-content-view">
                    <div className="materials-white-sheet">
                        <div className="materials-view-header">
                            <h2 className="materials-view-title">
                                {isEditingContent ? draftTitle.trim() || 'Новый материал' : selectedMaterial.title}
                            </h2>
                            <div className="materials-header-btns">
                                {isEditingContent ? (
                                    <button
                                        type="button"
                                        className="materials-action-btn save"
                                        disabled={saving}
                                        onClick={() => saveMaterialDraft()}
                                    >
                                        <Check size={18} /> Сохранить
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="materials-action-btn edit"
                                        onClick={() => setIsEditingContent(true)}
                                    >
                                        <Edit2 size={18} /> Редактировать
                                    </button>
                                )}
                                <button type="button" className="materials-action-btn back" onClick={backFromMaterial}>
                                    <ArrowLeft size={18} /> Вернуться
                                </button>
                            </div>
                        </div>
                        <div className="topic-content-area material-meta-block">
                            <label className="material-field-label">Заголовок</label>
                            <input
                                className="topic-editor material-single-line"
                                disabled={!isEditingContent}
                                value={draftTitle}
                                onChange={(e) => setDraftTitle(e.target.value)}
                            />
                            <label className="material-field-label">Тип</label>
                            <select
                                className="topic-editor material-select"
                                disabled={!isEditingContent}
                                value={draftType}
                                onChange={(e) => setDraftType(e.target.value)}
                            >
                                {MATERIAL_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                            <label className="material-field-label">URL (для ссылки, видео, файла)</label>
                            <input
                                className="topic-editor material-single-line"
                                disabled={!isEditingContent}
                                value={draftUrl}
                                onChange={(e) => setDraftUrl(e.target.value)}
                                placeholder="https://…"
                            />
                            <label className="material-field-label">Текст / описание</label>
                            <textarea
                                className="topic-editor"
                                disabled={!isEditingContent}
                                value={draftDescription}
                                onChange={(e) => setDraftDescription(e.target.value)}
                                placeholder="Содержание материала…"
                            />
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="materials-page-layout">
            <aside className="materials-nav-sidebar">
                {loadingCatalog && <div className="nav-loading">Загрузка…</div>}
                {error && <div className="nav-error">{error}</div>}
                <div className="nav-spec-container">
                    {!loadingCatalog && catalog.length === 0 && !error && (
                        <p className="materials-muted-status">Нет учебных групп в базе.</p>
                    )}
                    {catalog.map((g) => (
                        <div key={g.id} className="theory-block">
                            <div className={`nav-spec-item ${expandedGroups[g.id] ? 'is-active' : ''}`}>
                                <span
                                    className="nav-spec-title"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => toggleGroup(g.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && toggleGroup(g.id)}
                                >
                                    {g.name}
                                </span>
                                <span
                                    role="button"
                                    tabIndex={0}
                                    className="nav-spec-toggle"
                                    onClick={() => toggleGroup(g.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && toggleGroup(g.id)}
                                >
                                    {expandedGroups[g.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </span>
                            </div>
                            {expandedGroups[g.id] && (
                                <div className="nav-course-sub">
                                    {g.courses.map((course) => (
                                        <div
                                            key={course.id}
                                            role="button"
                                            tabIndex={0}
                                            className={`nav-course-item ${
                                                selectedGroupId === g.id && selectedCourseId === course.id
                                                    ? 'is-active'
                                                    : ''
                                            }`}
                                            onClick={() => selectCourse(g.id, course.id)}
                                            onKeyDown={(e) => e.key === 'Enter' && selectCourse(g.id, course.id)}
                                        >
                                            {course.number} курс
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </aside>

            <main className="materials-content-view">
                <div className="materials-white-sheet">
                    <div className="materials-view-header materials-catalog-title-row">
                        <h2 className="materials-view-title materials-catalog-title">{catalogTitle}</h2>
                        <button
                            type="button"
                            className="materials-add-btn"
                            onClick={addTheme}
                            disabled={
                                saving ||
                                selectedGroupId == null ||
                                selectedMajorId == null ||
                                selectedCourseId == null
                            }
                        >
                            <Plus size={18} /> Добавить тему
                        </button>
                    </div>

                    {loadingTopics && <p className="materials-muted-status">Загрузка тем…</p>}

                    <div className="materials-course-topics-block">
                        <h3 className="materials-subheading">Темы</h3>
                        {!loadingTopics &&
                            topics.length === 0 &&
                            selectedGroupId != null &&
                            selectedMajorId != null &&
                            selectedCourseId != null && (
                                <p className="materials-empty">Для этого курса пока нет тем — добавьте первую.</p>
                            )}
                        <div className="materials-topics-stack materials-topic-rows-mockup">
                            {topics.map((theme, idx) => (
                                <div key={theme.id} className="topic-pill-container">
                                    <div
                                        className={`topic-card-pill topic-row-mockup ${
                                            selectedThemeId === theme.id ? 'is-selected' : ''
                                        }`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openTheme(theme.id)}
                                        onKeyDown={(e) => onTopicRowKeyDown(e, theme.id)}
                                    >
                                        <span className="topic-row-mockup-label">
                                            Тема №{idx + 1} {theme.name}
                                        </span>
                                        <div className="nav-theme-actions topic-row-mockup-actions">
                                            <button
                                                type="button"
                                                className="nav-theme-icon-btn"
                                                title="Переименовать тему"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openTheme(theme.id);
                                                    setEditingThemeId(theme.id);
                                                }}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="nav-theme-icon-btn nav-theme-icon-danger"
                                                title="Удалить тему"
                                                onClick={(e) => deleteTheme(e, theme.id, theme.name)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {selectedTheme ? (
                        <>
                            <div className="materials-divider" />
                            <div className="materials-view-header materials-theme-header-row">
                                <div className="materials-theme-title-wrap">
                                    {editingThemeId === selectedTheme.id ? (
                                        <input
                                            ref={themeTitleInputRef}
                                            className="materials-view-title materials-title-inline-input"
                                            defaultValue={selectedTheme.name}
                                            onBlur={(e) => saveThemeTitle(selectedTheme.id, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    saveThemeTitle(selectedTheme.id, (e.target as HTMLInputElement).value);
                                                }
                                                if (e.key === 'Escape') {
                                                    setEditingThemeId(null);
                                                }
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <h2 className="materials-view-title">{selectedTheme.name}</h2>
                                            <button
                                                type="button"
                                                className="materials-theme-rename-btn"
                                                title="Переименовать тему"
                                                disabled={saving}
                                                onClick={() => setEditingThemeId(selectedTheme.id)}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>
                                <button type="button" className="materials-add-btn" onClick={addMaterial} disabled={saving}>
                                    <Plus size={18} /> Добавить материал
                                </button>
                            </div>
                            <div className="materials-topics-stack">
                                {selectedTheme.materials.length === 0 && (
                                    <p className="materials-empty">Материалов пока нет — добавьте первый.</p>
                                )}
                                {selectedTheme.materials.map((m) => (
                                    <div key={m.id} className="topic-pill-container">
                                        <div
                                            className="topic-card-pill"
                                            onClick={() => openMaterial(m)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === 'Enter' && openMaterial(m)}
                                        >
                                            <span>{m.title}</span>
                                            <span className="material-type-tag">{m.type}</span>
                                            <button type="button" className="topic-delete-btn" onClick={(e) => deleteMaterial(e, m)}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        !loadingTopics &&
                        topics.length > 0 && (
                            <p className="materials-placeholder hint-below-topics">Выберите тему выше, чтобы редактировать материалы.</p>
                        )
                    )}
                </div>
            </main>
        </div>
    );
};

export default TeacherMaterials;

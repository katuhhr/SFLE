import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronDown, Plus, Trash2, Edit2, Check, ArrowLeft } from 'lucide-react';
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

/** Учебная группа; темы грузятся по major_id + course_id группы. */
interface CatalogGroup {
    id: number;
    name: string;
    major_id: number | null;
    major_label: string;
    course_id?: number;
    course_number?: number | null;
    courses: CatalogCourse[];
}

type CatalogGroupValid = CatalogGroup & { major_id: number; course_id: number };

type MajorCatalogSection = {
    majorId: number;
    label: string;
    courses: Array<{ courseId: number; number: number }>;
};

const MATERIAL_TYPES = [
    { value: 'text', label: 'Текст' },
    { value: 'link', label: 'Ссылка' },
    { value: 'video', label: 'Видео' },
    { value: 'file', label: 'Файл' },
];

const TeacherMaterials: React.FC = () => {
    const [catalog, setCatalog] = useState<CatalogGroup[]>([]);
    const [expandedMajors, setExpandedMajors] = useState<Record<number, boolean>>({});
    const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null);
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

    const majorSections = useMemo((): MajorCatalogSection[] => {
        const valid: CatalogGroupValid[] = catalog.filter(
            (g): g is CatalogGroupValid =>
                g.major_id != null && g.course_id != null && typeof g.course_id === 'number',
        );
        const byMajor = new Map<number, CatalogGroupValid[]>();
        for (const g of valid) {
            const arr = byMajor.get(g.major_id) ?? [];
            arr.push(g);
            byMajor.set(g.major_id, arr);
        }
        const out: MajorCatalogSection[] = [];
        for (const [majorId, grps] of Array.from(byMajor.entries())) {
            const courseMap = new Map<number, { courseId: number; number: number }>();
            for (const g of grps) {
                if (!courseMap.has(g.course_id)) {
                    courseMap.set(g.course_id, {
                        courseId: g.course_id,
                        number: g.course_number ?? 0,
                    });
                }
            }
            const courses = Array.from(courseMap.values()).sort((a, b) => a.number - b.number);
            out.push({ majorId, label: (grps[0]?.major_label || '').trim() || `Специальность ${majorId}`, courses });
        }
        out.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
        return out;
    }, [catalog]);

    useEffect(() => {
        if (catalogInitRef.current || majorSections.length === 0) {
            return;
        }
        const sec0 = majorSections[0];
        const c0 = sec0?.courses[0];
        if (!sec0 || !c0) {
            return;
        }
        catalogInitRef.current = true;
        setExpandedMajors({ [sec0.majorId]: true });
        setSelectedMajorId(sec0.majorId);
        setSelectedCourseId(c0.courseId);
    }, [majorSections]);

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

    const catalogTitle = useMemo(() => {
        if (selectedMajorId == null || selectedCourseId == null) {
            return 'Выберите специальность и курс';
        }
        const sec = majorSections.find((s) => s.majorId === selectedMajorId);
        const c = sec?.courses.find((x) => x.courseId === selectedCourseId);
        if (!sec || !c) {
            return 'Выберите специальность и курс';
        }
        return `${sec.label} · ${c.number} курс`;
    }, [majorSections, selectedMajorId, selectedCourseId]);

    const toggleMajorExpand = (majorId: number) => {
        setExpandedMajors((e) => ({ ...e, [majorId]: !e[majorId] }));
    };

    const selectMajorAndCourse = (majorId: number, courseId: number) => {
        setSelectedMajorId(majorId);
        setSelectedCourseId(courseId);
        setExpandedMajors((e) => ({ ...e, [majorId]: true }));
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
        if (selectedMajorId != null && selectedCourseId != null) {
            fetchTopics(selectedMajorId, selectedCourseId);
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
            <aside className="materials-nav-sidebar teacher-catalog-sidebar">
                {loadingCatalog && <div className="nav-loading">Загрузка…</div>}
                {error && <div className="nav-error">{error}</div>}
                <div className="teacher-catalog-tree">
                    {!loadingCatalog && majorSections.length === 0 && !error && (
                        <p className="materials-muted-status">Нет учебных групп в базе.</p>
                    )}
                    {majorSections.map((section) => {
                        const majorOpen = !!expandedMajors[section.majorId];
                        const isMajorActive = selectedMajorId === section.majorId;
                        return (
                            <div key={section.majorId} className="cat-major-block">
                                <button
                                    type="button"
                                    className={`cat-major-row ${isMajorActive ? 'is-active' : ''} ${majorOpen ? 'is-open' : ''}`}
                                    onClick={() => toggleMajorExpand(section.majorId)}
                                >
                                    <span className="cat-major-label">{section.label}</span>
                                    <ChevronDown className="cat-major-chevron" size={18} strokeWidth={2} aria-hidden />
                                </button>
                                {majorOpen && (
                                    <div className="cat-courses-stack">
                                        {section.courses.map((course) => {
                                            const ck = `${section.majorId}-${course.courseId}`;
                                            const isCourseActive =
                                                selectedMajorId === section.majorId &&
                                                selectedCourseId === course.courseId;
                                            return (
                                                <div key={ck} className="cat-course-wrap">
                                                    <button
                                                        type="button"
                                                        className={`cat-course-row ${isCourseActive ? 'is-active' : ''}`}
                                                        onClick={() =>
                                                            selectMajorAndCourse(section.majorId, course.courseId)
                                                        }
                                                    >
                                                        {course.number} курс
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
                            disabled={saving || selectedMajorId == null || selectedCourseId == null}
                        >
                            <Plus size={18} /> Добавить тему
                        </button>
                    </div>

                    {loadingTopics && <p className="materials-muted-status">Загрузка тем…</p>}

                    <div className="materials-course-topics-block">
                        <h3 className="materials-subheading">Темы</h3>
                        {!loadingTopics &&
                            topics.length === 0 &&
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

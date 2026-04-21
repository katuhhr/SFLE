import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChevronDown, Plus, Trash2, Edit2, Check } from 'lucide-react';
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

interface TheoryBlock {
    id: number;
    name: string;
    text: string;
}

interface TaskRow {
    id: number;
    text: string;
    deadline: string | null;
}

interface ThemeDetail {
    id: number;
    name: string;
    major_id: number | null;
    course_id: number | null;
    theory: TheoryBlock;
    materials: MaterialRow[];
    tasks: TaskRow[];
}

function toDateTimeLocalValue(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocalValue(s: string): string {
    if (!s.trim()) return '';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function themeIdsEqual(
    a: number | string | null | undefined,
    b: number | string | null | undefined,
): boolean {
    return a != null && b != null && Number(a) === Number(b);
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
    const [themeDetail, setThemeDetail] = useState<ThemeDetail | null>(null);
    const [loadingThemeDetail, setLoadingThemeDetail] = useState(false);
    const [themeDetailError, setThemeDetailError] = useState<string | null>(null);
    const [loadingCatalog, setLoadingCatalog] = useState(true);
    const [loadingTopics, setLoadingTopics] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskDeadline, setNewTaskDeadline] = useState('');
    const [editingThemeId, setEditingThemeId] = useState<number | null>(null);
    const themeTitleInputRef = useRef<HTMLInputElement>(null);
    const catalogInitRef = useRef(false);
    const themeDetailAbortRef = useRef<AbortController | null>(null);
    const topicsAbortRef = useRef<AbortController | null>(null);

    const token = localStorage.getItem('access_token');
    const makeHeaders = (json = false): HeadersInit => ({
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(json ? { 'Content-Type': 'application/json' } : {}),
    });

    const fetchTopics = useCallback(
        async (majorId: number, courseId: number) => {
            if (!token) return;
            topicsAbortRef.current?.abort();
            const ac = new AbortController();
            topicsAbortRef.current = ac;
            setLoadingTopics(true);
            setError(null);
            try {
                const res = await fetch(
                    apiUrl(`/api/admin/learning/topics/?major_id=${majorId}&course_id=${courseId}`),
                    { headers: makeHeaders(), signal: ac.signal },
                );
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (!ac.signal.aborted) {
                        setError((payload as { detail?: string }).detail || 'Не удалось загрузить темы');
                        setTopics([]);
                    }
                    return;
                }
                if (!ac.signal.aborted) {
                    setTopics((payload as { data?: ThemeRow[] }).data || []);
                }
            } catch (e) {
                if ((e as Error).name === 'AbortError') return;
                if (!ac.signal.aborted) {
                    setError('Нет связи с сервером.');
                    setTopics([]);
                }
            } finally {
                if (!ac.signal.aborted) {
                    setLoadingTopics(false);
                }
            }
        },
        [token],
    );

    const fetchThemeDetail = useCallback(
        async (themeId: number) => {
            if (!token) return;
            themeDetailAbortRef.current?.abort();
            const ac = new AbortController();
            themeDetailAbortRef.current = ac;
            setLoadingThemeDetail(true);
            setError(null);
            setThemeDetailError(null);
            try {
                const res = await fetch(apiUrl(`/api/admin/learning/themes/${themeId}/`), {
                    headers: makeHeaders(),
                    signal: ac.signal,
                });
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const msg =
                        (payload as { detail?: string }).detail || 'Не удалось загрузить тему';
                    if (!ac.signal.aborted) {
                        setError(msg);
                        setThemeDetailError(msg);
                        setThemeDetail(null);
                    }
                    return;
                }
                const data = (payload as { data?: ThemeDetail }).data;
                if (!ac.signal.aborted) {
                    setThemeDetail(data ?? null);
                    if (data == null) {
                        const msg = 'Сервер вернул пустой ответ для темы';
                        setThemeDetailError(msg);
                        setError(msg);
                    }
                }
            } catch (e) {
                if ((e as Error).name === 'AbortError') return;
                if (!ac.signal.aborted) {
                    const msg = 'Нет связи с сервером.';
                    setError(msg);
                    setThemeDetailError(msg);
                    setThemeDetail(null);
                }
            } finally {
                if (!ac.signal.aborted) {
                    setLoadingThemeDetail(false);
                }
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
        setThemeDetail(null);
        setThemeDetailError(null);
    };

    const findTheme = (themeId: number | null): ThemeRow | undefined => {
        if (themeId == null) return undefined;
        return topics.find((t) => Number(t.id) === Number(themeId));
    };

    const openTheme = (rawId: number) => {
        const themeId = Number(rawId);
        if (!Number.isFinite(themeId)) return;
        setEditingThemeId(null);
        setSelectedThemeId(themeId);
        setThemeDetail(null);
        setThemeDetailError(null);
        setNewTaskText('');
        setNewTaskDeadline('');
        fetchThemeDetail(themeId);
    };

    const refreshCurrentTopics = () => {
        if (selectedMajorId != null && selectedCourseId != null) {
            fetchTopics(selectedMajorId, selectedCourseId);
        }
    };

    const patchTheoryFields = (patch: Partial<TheoryBlock>) => {
        setThemeDetail((d) => {
            if (!d?.theory) return d;
            return { ...d, theory: { ...d.theory, ...patch } };
        });
    };

    const patchMaterialFields = (materialId: number, patch: Partial<MaterialRow>) => {
        setThemeDetail((d) => {
            if (!d) return d;
            return {
                ...d,
                materials: d.materials.map((m) => (m.id === materialId ? { ...m, ...patch } : m)),
            };
        });
    };

    const patchTaskFields = (taskId: number, patch: Partial<TaskRow>) => {
        setThemeDetail((d) => {
            if (!d) return d;
            return {
                ...d,
                tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
            };
        });
    };

    const saveTheoryBlock = async () => {
        if (!selectedThemeId || !token || !themeDetail?.theory) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(apiUrl(`/api/admin/learning/themes/${selectedThemeId}/`), {
                method: 'PATCH',
                headers: makeHeaders(true),
                body: JSON.stringify({
                    theory_title: themeDetail.theory.name,
                    theory_text: themeDetail.theory.text,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((payload as { detail?: string }).detail || 'Не удалось сохранить теорию');
                return;
            }
            await fetchThemeDetail(selectedThemeId);
            refreshCurrentTopics();
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const saveMaterialRow = async (m: MaterialRow) => {
        if (!token) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(apiUrl(`/api/admin/learning/materials/${m.id}/`), {
                method: 'PATCH',
                headers: makeHeaders(true),
                body: JSON.stringify({
                    title: m.title,
                    type: m.type || 'text',
                    url: m.url || null,
                    description: m.description ?? '',
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((payload as { detail?: string }).detail || 'Ошибка сохранения материала');
                return;
            }
            const row = (payload as { data?: MaterialRow }).data;
            if (row && selectedThemeId) {
                patchMaterialFields(row.id, row);
            }
            refreshCurrentTopics();
            if (selectedThemeId) await fetchThemeDetail(selectedThemeId);
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
                setNewTaskText('');
                setNewTaskDeadline('');
                fetchThemeDetail(newId);
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
            if (themeIdsEqual(selectedThemeId, themeId)) {
                setThemeDetail((d) => (d ? { ...d, name: name.trim() } : d));
            }
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const deleteTheme = async (e: React.MouseEvent, themeId: number, name: string) => {
        e.stopPropagation();
        const tid = Number(themeId);
        if (!Number.isFinite(tid) || !token) return;
        if (!window.confirm(`Удалить тему «${name}» и все материалы?`)) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(apiUrl(`/api/admin/learning/themes/${tid}/`), {
                method: 'DELETE',
                headers: makeHeaders(),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg =
                    (payload as { detail?: string }).detail ||
                    `Не удалось удалить тему (код ${res.status})`;
                setError(msg);
                return;
            }
            if (themeIdsEqual(selectedThemeId, tid)) {
                setSelectedThemeId(null);
                setThemeDetail(null);
                setThemeDetailError(null);
            }
            if (themeIdsEqual(editingThemeId, tid)) {
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
            if (selectedThemeId) await fetchThemeDetail(selectedThemeId);
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
            refreshCurrentTopics();
            if (selectedThemeId) await fetchThemeDetail(selectedThemeId);
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const addTask = async () => {
        if (!selectedThemeId || !token) return;
        const iso = fromDateTimeLocalValue(newTaskDeadline);
        if (!newTaskText.trim() || !iso) {
            setError('Укажите текст задания и дату дедлайна');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(apiUrl('/api/admin/learning/tasks/'), {
                method: 'POST',
                headers: makeHeaders(true),
                body: JSON.stringify({
                    theme_id: selectedThemeId,
                    text: newTaskText.trim(),
                    deadline: iso,
                }),
            });
            const p = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((p as { detail?: string }).detail || 'Не удалось создать задание');
                return;
            }
            setNewTaskText('');
            setNewTaskDeadline('');
            await fetchThemeDetail(selectedThemeId);
            refreshCurrentTopics();
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const saveTaskRow = async (t: TaskRow) => {
        if (!token) return;
        if (!t.text.trim()) {
            setError('Текст задания не может быть пустым');
            return;
        }
        if (!t.deadline) {
            setError('Укажите дедлайн');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(apiUrl(`/api/admin/learning/tasks/${t.id}/`), {
                method: 'PATCH',
                headers: makeHeaders(true),
                body: JSON.stringify({ text: t.text.trim(), deadline: t.deadline }),
            });
            const p = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((p as { detail?: string }).detail || 'Не удалось сохранить задание');
                return;
            }
            const row = (p as { data?: TaskRow }).data;
            if (row) patchTaskFields(row.id, row);
            if (selectedThemeId) await fetchThemeDetail(selectedThemeId);
            refreshCurrentTopics();
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const deleteTask = async (e: React.MouseEvent, t: TaskRow) => {
        e.stopPropagation();
        if (!token || !window.confirm('Удалить это задание?')) return;
        setSaving(true);
        setError(null);
        try {
            await fetch(apiUrl(`/api/admin/learning/tasks/${t.id}/`), {
                method: 'DELETE',
                headers: makeHeaders(),
            });
            if (selectedThemeId) await fetchThemeDetail(selectedThemeId);
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
    const themeTitleShown = themeDetail?.name ?? selectedTheme?.name ?? '';
    const showTestsStub = () => {
        window.alert('Тесты в разработке.');
    };

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
                        <div className="materials-header-btns">
                            <button type="button" className="materials-add-btn" onClick={showTestsStub}>
                                Тесты
                            </button>
                            <button
                                type="button"
                                className="materials-add-btn"
                                onClick={addTheme}
                                disabled={saving || selectedMajorId == null || selectedCourseId == null}
                            >
                                <Plus size={18} /> Добавить тему
                            </button>
                        </div>
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
                                            themeIdsEqual(selectedThemeId, theme.id) ? 'is-selected' : ''
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
                                    {themeIdsEqual(editingThemeId, selectedTheme.id) ? (
                                        <input
                                            key={`title-edit-${selectedTheme.id}`}
                                            ref={themeTitleInputRef}
                                            className="materials-view-title materials-title-inline-input"
                                            defaultValue={themeTitleShown}
                                            onBlur={(e) => saveThemeTitle(selectedTheme.id, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    saveThemeTitle(
                                                        selectedTheme.id,
                                                        (e.target as HTMLInputElement).value,
                                                    );
                                                }
                                                if (e.key === 'Escape') {
                                                    setEditingThemeId(null);
                                                }
                                            }}
                                        />
                                    ) : (
                                        <>
                                            <h2 className="materials-view-title">{themeTitleShown}</h2>
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
                            </div>

                            {loadingThemeDetail && (
                                <p className="materials-muted-status">Загрузка содержимого темы…</p>
                            )}

                            {!loadingThemeDetail && themeDetailError && (
                                <p className="materials-detail-error" role="alert">
                                    {themeDetailError}
                                </p>
                            )}

                            {!loadingThemeDetail &&
                                themeDetail &&
                                themeIdsEqual(themeDetail.id, selectedThemeId) && (
                                <>
                                    <section className="teacher-theme-theory-block topic-content-area material-meta-block">
                                        <h3 className="materials-subheading">Теория (текст темы)</h3>
                                        <label className="material-field-label">Заголовок раздела теории</label>
                                        <input
                                            className="topic-editor material-single-line"
                                            value={themeDetail.theory.name}
                                            onChange={(e) => patchTheoryFields({ name: e.target.value })}
                                        />
                                        <label className="material-field-label">Текст</label>
                                        <textarea
                                            className="topic-editor teacher-theory-textarea"
                                            value={themeDetail.theory.text}
                                            onChange={(e) => patchTheoryFields({ text: e.target.value })}
                                            placeholder="Содержание теории по теме…"
                                            rows={8}
                                        />
                                        <button
                                            type="button"
                                            className="materials-action-btn save teacher-theory-save"
                                            disabled={saving}
                                            onClick={() => saveTheoryBlock()}
                                        >
                                            <Check size={18} /> Сохранить теорию
                                        </button>
                                    </section>

                                    <div className="materials-divider" />
                                    <div className="materials-view-header materials-theme-header-row">
                                        <h3 className="materials-subheading materials-inline-heading">Материалы и ссылки</h3>
                                        <button
                                            type="button"
                                            className="materials-add-btn"
                                            onClick={addMaterial}
                                            disabled={saving}
                                        >
                                            <Plus size={18} /> Добавить материал
                                        </button>
                                    </div>
                                    <div className="teacher-materials-inline-stack">
                                        {themeDetail.materials.length === 0 && (
                                            <p className="materials-empty">
                                                Материалов пока нет — добавьте ссылку, текст или файл.
                                            </p>
                                        )}
                                        {themeDetail.materials.map((m) => (
                                            <div key={m.id} className="teacher-material-inline-card topic-content-area material-meta-block">
                                                <div className="teacher-material-inline-card-head">
                                                    <span className="material-type-tag">{m.type}</span>
                                                    <button
                                                        type="button"
                                                        className="topic-delete-btn"
                                                        title="Удалить материал"
                                                        disabled={saving}
                                                        onClick={(e) => deleteMaterial(e, m)}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                                <label className="material-field-label">Заголовок</label>
                                                <input
                                                    className="topic-editor material-single-line"
                                                    value={m.title}
                                                    onChange={(e) =>
                                                        patchMaterialFields(m.id, { title: e.target.value })
                                                    }
                                                />
                                                <label className="material-field-label">Тип</label>
                                                <select
                                                    className="topic-editor material-select"
                                                    value={m.type || 'text'}
                                                    onChange={(e) =>
                                                        patchMaterialFields(m.id, { type: e.target.value })
                                                    }
                                                >
                                                    {MATERIAL_TYPES.map((t) => (
                                                        <option key={t.value} value={t.value}>
                                                            {t.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <label className="material-field-label">URL</label>
                                                <input
                                                    className="topic-editor material-single-line"
                                                    value={m.url ?? ''}
                                                    onChange={(e) =>
                                                        patchMaterialFields(m.id, {
                                                            url: e.target.value || null,
                                                        })
                                                    }
                                                    placeholder="https://…"
                                                />
                                                <label className="material-field-label">Текст / описание</label>
                                                <textarea
                                                    className="topic-editor teacher-material-description"
                                                    value={m.description ?? ''}
                                                    onChange={(e) =>
                                                        patchMaterialFields(m.id, {
                                                            description: e.target.value,
                                                        })
                                                    }
                                                    rows={3}
                                                />
                                                <button
                                                    type="button"
                                                    className="materials-action-btn save"
                                                    disabled={saving}
                                                    onClick={() => saveMaterialRow(m)}
                                                >
                                                    <Check size={18} /> Сохранить материал
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="materials-divider" />
                                    <h3 className="materials-subheading">Задания</h3>
                                    <div className="teacher-new-task-form topic-content-area material-meta-block">
                                        <label className="material-field-label">Новое задание</label>
                                        <textarea
                                            className="topic-editor"
                                            value={newTaskText}
                                            onChange={(e) => setNewTaskText(e.target.value)}
                                            placeholder="Текст задания…"
                                            rows={3}
                                        />
                                        <label className="material-field-label">Дедлайн</label>
                                        <input
                                            type="datetime-local"
                                            className="topic-editor material-single-line"
                                            value={newTaskDeadline}
                                            onChange={(e) => setNewTaskDeadline(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="materials-add-btn"
                                            disabled={saving}
                                            onClick={() => addTask()}
                                        >
                                            <Plus size={18} /> Добавить задание
                                        </button>
                                    </div>
                                    <div className="teacher-tasks-stack">
                                        {themeDetail.tasks.length === 0 && (
                                            <p className="materials-empty">Заданий пока нет.</p>
                                        )}
                                        {themeDetail.tasks.map((t) => (
                                            <div
                                                key={t.id}
                                                className="teacher-task-row topic-content-area material-meta-block"
                                            >
                                                <textarea
                                                    className="topic-editor"
                                                    value={t.text}
                                                    onChange={(e) =>
                                                        patchTaskFields(t.id, { text: e.target.value })
                                                    }
                                                    rows={3}
                                                />
                                                <label className="material-field-label">Дедлайн</label>
                                                <input
                                                    type="datetime-local"
                                                    className="topic-editor material-single-line"
                                                    value={toDateTimeLocalValue(t.deadline)}
                                                    onChange={(e) => {
                                                        const iso = fromDateTimeLocalValue(e.target.value);
                                                        if (iso) patchTaskFields(t.id, { deadline: iso });
                                                    }}
                                                />
                                                <div className="teacher-task-row-actions">
                                                    <button
                                                        type="button"
                                                        className="materials-action-btn save"
                                                        disabled={saving}
                                                        onClick={() => saveTaskRow(t)}
                                                    >
                                                        <Check size={18} /> Сохранить
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="topic-delete-btn"
                                                        title="Удалить задание"
                                                        disabled={saving}
                                                        onClick={(e) => deleteTask(e, t)}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        !loadingTopics &&
                        topics.length > 0 && (
                            <p className="materials-placeholder hint-below-topics">
                                Выберите тему выше, чтобы открыть теорию, материалы и задания.
                            </p>
                        )
                    )}
                </div>
            </main>
        </div>
    );
};

export default TeacherMaterials;

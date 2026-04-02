import React, { FC, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authFetch } from '../../api/authFetch';
import './teacher_profile_page_for_admin.css';

interface TeacherApi {
    id: number;
    username: string;
    email?: string;
    full_name: string;
    groups_taught?: { id: number; name: string }[];
}

interface GroupRow {
    id: number;
    name: string;
    major: number;
    course_number: number;
    major_name: string;
}

interface MajorCol {
    id: number;
    label: string;
}

interface CourseRow {
    id: number;
    number: number;
}

function messageFromApiPayload(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== 'object') {
        return fallback;
    }
    const p = payload as Record<string, unknown>;
    if (typeof p.detail === 'string' && p.detail.trim()) {
        return p.detail;
    }
    if (p.errors != null) {
        try {
            return `${fallback}: ${JSON.stringify(p.errors)}`;
        } catch {
            return fallback;
        }
    }
    if (typeof p.message === 'string' && p.message.trim()) {
        return p.message;
    }
    return fallback;
}

const TeacherProfilePageForAdmin: FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [teacher, setTeacher] = useState<TeacherApi | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [groupsCatalog, setGroupsCatalog] = useState<GroupRow[]>([]);
    const [majorOrder, setMajorOrder] = useState<MajorCol[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [saving, setSaving] = useState(false);
    const [assignOpen, setAssignOpen] = useState(false);

    const [courses, setCourses] = useState<CourseRow[]>([]);
    const [modalErr, setModalErr] = useState<string | null>(null);
    const [modalBusy, setModalBusy] = useState(false);
    const [majorSelect, setMajorSelect] = useState<string>('');
    const [newMajorName, setNewMajorName] = useState('');
    const [groupSelect, setGroupSelect] = useState<string>('');
    const [newGroupName, setNewGroupName] = useState('');
    const [newCourseId, setNewCourseId] = useState<string>('');

    const loadTeacher = useCallback(async () => {
        if (!id) return;
        const res = await authFetch(`/api/admin/teachers/${id}/`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error((payload as { detail?: string }).detail || 'Не удалось загрузить преподавателя');
        }
        const row = (payload as { data?: TeacherApi }).data;
        setTeacher(row || null);
        const taught = row?.groups_taught ?? [];
        setSelectedIds(taught.map((g) => g.id));
    }, [id]);

    const loadGroups = useCallback(async () => {
        const res = await authFetch('/api/admin/groups/');
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error((payload as { detail?: string }).detail || 'Не удалось загрузить группы');
        }
        const rows = (payload as { data?: GroupRow[] }).data ?? [];
        setGroupsCatalog(rows);
        const mo = (payload as { major_order?: MajorCol[] }).major_order;
        setMajorOrder(Array.isArray(mo) ? mo : []);
    }, []);

    const loadCourses = useCallback(async () => {
        const res = await authFetch('/api/admin/courses/');
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            setCourses([]);
            return;
        }
        const rows = (payload as { data?: CourseRow[] }).data ?? [];
        setCourses(rows);
    }, []);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                await Promise.all([loadTeacher(), loadGroups()]);
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Нет связи с сервером.');
                    setTeacher(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id, loadTeacher, loadGroups]);

    useEffect(() => {
        if (assignOpen) {
            setModalErr(null);
            setMajorSelect('');
            setNewMajorName('');
            setGroupSelect('');
            setNewGroupName('');
            setNewCourseId('');
            void loadCourses();
        }
    }, [assignOpen, loadCourses]);

    const majorsForTable = useMemo(() => {
        const fromApi = majorOrder.filter((m) => m.id != null);
        if (fromApi.length > 0) {
            return fromApi;
        }
        const seen = new Map<number, string>();
        for (const g of groupsCatalog) {
            if (!seen.has(g.major)) {
                seen.set(g.major, g.major_name || `Специальность ${g.major}`);
            }
        }
        return Array.from(seen.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([mid, label]) => ({ id: mid, label }));
    }, [majorOrder, groupsCatalog]);

    const catalogById = useMemo(() => {
        const m = new Map<number, GroupRow>();
        for (const g of groupsCatalog) {
            m.set(g.id, g);
        }
        return m;
    }, [groupsCatalog]);

    const assignedByMajor = useMemo(() => {
        const map = new Map<number, GroupRow[]>();
        for (const gid of selectedIds) {
            const g = catalogById.get(gid);
            if (!g) continue;
            const arr = map.get(g.major) ?? [];
            arr.push(g);
            map.set(g.major, arr);
        }
        for (const list of Array.from(map.values())) {
            list.sort((a: GroupRow, b: GroupRow) => a.name.localeCompare(b.name, 'ru'));
        }
        return map;
    }, [selectedIds, catalogById]);

    const matrixRows = useMemo(() => {
        if (majorsForTable.length === 0) {
            return [];
        }
        const cols = majorsForTable.map((m) => assignedByMajor.get(m.id) ?? []);
        const maxR = Math.max(1, ...cols.map((c) => c.length));
        const rows: (GroupRow | null)[][] = [];
        for (let r = 0; r < maxR; r += 1) {
            rows.push(cols.map((col) => col[r] ?? null));
        }
        return rows;
    }, [majorsForTable, assignedByMajor]);

    const removeGroup = (gid: number) => {
        setSelectedIds((prev) => prev.filter((x) => x !== gid));
    };

    const majorIdNum = majorSelect && majorSelect !== 'new' ? Number(majorSelect) : NaN;
    const groupsForMajor = useMemo(() => {
        if (!Number.isFinite(majorIdNum)) return [];
        return groupsCatalog.filter((g) => g.major === majorIdNum && !selectedIds.includes(g.id));
    }, [groupsCatalog, majorIdNum, selectedIds]);

    const saveGroups = async () => {
        if (!id) return;
        setSaving(true);
        setError(null);
        const groupIds = Array.from(
            new Set(
                selectedIds
                    .map((x) => Number(x))
                    .filter((n) => Number.isInteger(n) && n > 0),
            ),
        );
        try {
            const res = await authFetch(`/api/admin/teachers/${id}/groups/`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group_ids: groupIds }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(messageFromApiPayload(payload, `Не удалось сохранить (код ${res.status})`));
                return;
            }
            await loadTeacher();
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const createMajor = async () => {
        const name = newMajorName.trim();
        if (!name) {
            setModalErr('Введите название специальности');
            return;
        }
        setModalBusy(true);
        setModalErr(null);
        try {
            const res = await authFetch('/api/admin/majors/create/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setModalErr((payload as { detail?: string }).detail || 'Не удалось создать специальность');
                return;
            }
            const mid = (payload as { data?: { id?: number } }).data?.id;
            await loadGroups();
            if (mid != null) {
                setMajorSelect(String(mid));
                setNewMajorName('');
            }
        } catch {
            setModalErr('Нет связи с сервером.');
        } finally {
            setModalBusy(false);
        }
    };

    const createGroupAndAssign = async () => {
        const name = newGroupName.trim();
        if (!name) {
            setModalErr('Введите название группы');
            return;
        }
        if (!Number.isFinite(majorIdNum)) {
            setModalErr('Выберите специальность');
            return;
        }
        const cid = Number(newCourseId);
        if (!Number.isFinite(cid)) {
            setModalErr('Выберите курс');
            return;
        }
        setModalBusy(true);
        setModalErr(null);
        try {
            const res = await authFetch('/api/admin/groups/create/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, major: majorIdNum, course: cid }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setModalErr(
                    (payload as { detail?: string; errors?: unknown }).detail ||
                        'Не удалось создать группу',
                );
                return;
            }
            const gid = (payload as { data?: { id?: number } }).data?.id;
            await loadGroups();
            if (gid != null) {
                setSelectedIds((p) => [...p, gid]);
            }
            setAssignOpen(false);
        } catch {
            setModalErr('Нет связи с сервером.');
        } finally {
            setModalBusy(false);
        }
    };

    const addExistingGroup = () => {
        const gid = parseInt(groupSelect, 10);
        if (!Number.isInteger(gid) || gid < 1) {
            setModalErr('Выберите группу из списка');
            return;
        }
        setSelectedIds((p) => (p.includes(gid) ? p : [...p, gid]));
        setAssignOpen(false);
    };

    const openAssignModal = () => {
        setAssignOpen(true);
    };

    return (
        <div className="admin-page-bg">
            <div className="teacher-profile-card">
                <button type="button" className="back-link" onClick={() => navigate('/admin')}>
                    ← Назад
                </button>

                {loading && <p className="teacher-admin-muted">Загрузка…</p>}
                {error && <p className="teacher-admin-err">{error}</p>}

                {teacher && (
                    <div className="card-content teacher-admin-editor">
                        <div className="left-side">
                            <div className="avatar-circle" aria-hidden />
                            <div className="name-info">
                                <div className="teacher-name">{teacher.full_name || teacher.username}</div>
                                <div className="teacher-role">Преподаватель</div>
                            </div>
                            <div className="inputs-block">
                                <div className="input-row">
                                    <span>Логин:</span>
                                    <span className="teacher-admin-value">{teacher.username}</span>
                                </div>
                                <div className="input-row">
                                    <span>Email:</span>
                                    <span className="teacher-admin-value">{teacher.email || '—'}</span>
                                </div>
                            </div>
                            <div className="left-actions">
                                <button type="button" className="action-btn" disabled title="В разработке">
                                    Удалить
                                </button>
                                <button type="button" className="action-btn" disabled title="В разработке">
                                    Редактировать
                                </button>
                            </div>
                        </div>
                        <div className="right-side">
                            <div className="table-container">
                                <div className="table-title">Группы закреплённые за преподавателем</div>
                                {majorsForTable.length === 0 ? (
                                    <p className="teacher-admin-muted">
                                        В системе нет специальностей. Создайте специальность через «Назначить группу».
                                    </p>
                                ) : (
                                    <div className="groups-matrix-wrap">
                                        <table className="groups-table">
                                            <thead>
                                                <tr>
                                                    {majorsForTable.map((m) => (
                                                        <th key={m.id}>{m.label}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {matrixRows.map((row, ri) => (
                                                    <tr key={row.map((c) => c?.id ?? 'e').join('-') + ri}>
                                                        {row.map((cell, ci) => {
                                                            if (!cell) {
                                                                return <td key={`e-${ri}-${ci}`} />;
                                                            }
                                                            return (
                                                                <td key={cell.id}>
                                                                    <button
                                                                        type="button"
                                                                        className="group-cell group-cell--on"
                                                                        onClick={() => removeGroup(cell.id)}
                                                                        title="Снять закрепление (сохраните изменения)"
                                                                    >
                                                                        {cell.name}
                                                                    </button>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <p className="teacher-admin-hint">
                                    Таблица показывает только закреплённые группы. Добавьте группу через «Назначить группу»
                                    (специальность → группа или создание), затем нажмите «Сохранить».
                                </p>
                            </div>
                            <div className="right-actions">
                                <button type="button" className="action-btn" onClick={openAssignModal}>
                                    Назначить группу
                                </button>
                                <button
                                    type="button"
                                    className="action-btn action-btn--primary"
                                    disabled={saving}
                                    onClick={() => void saveGroups()}
                                >
                                    {saving ? 'Сохранение…' : 'Сохранить'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {assignOpen && (
                <div
                    className="modal-overlay"
                    role="presentation"
                    onClick={() => !modalBusy && setAssignOpen(false)}
                    onKeyDown={(e) => e.key === 'Escape' && !modalBusy && setAssignOpen(false)}
                >
                    <div
                        className="modal-box modal-box--wide assign-wizard"
                        role="dialog"
                        aria-labelledby="assign-group-title"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                    >
                        <h3 id="assign-group-title">Назначить группу</h3>
                        {modalErr && <p className="teacher-admin-err">{modalErr}</p>}

                        <label className="assign-field-label" htmlFor="assign-major">
                            1. Специальность
                        </label>
                        <select
                            id="assign-major"
                            className="assign-select"
                            value={majorSelect}
                            disabled={modalBusy}
                            onChange={(e) => {
                                setMajorSelect(e.target.value);
                                setGroupSelect('');
                                setModalErr(null);
                            }}
                        >
                            <option value="">Выберите специальность</option>
                            {majorsForTable.map((m) => (
                                <option key={m.id} value={String(m.id)}>
                                    {m.label}
                                </option>
                            ))}
                            <option value="new">+ Создать специальность…</option>
                        </select>

                        {majorSelect === 'new' && (
                            <div className="assign-inline-block">
                                <input
                                    type="text"
                                    className="assign-input"
                                    placeholder="Название специальности"
                                    value={newMajorName}
                                    onChange={(e) => setNewMajorName(e.target.value)}
                                    disabled={modalBusy}
                                />
                                <button
                                    type="button"
                                    className="action-btn"
                                    disabled={modalBusy}
                                    onClick={() => void createMajor()}
                                >
                                    Создать специальность
                                </button>
                            </div>
                        )}

                        {majorSelect !== '' && majorSelect !== 'new' && (
                            <>
                                <label className="assign-field-label" htmlFor="assign-group">
                                    2. Группа
                                </label>
                                <select
                                    id="assign-group"
                                    className="assign-select"
                                    value={groupSelect}
                                    disabled={modalBusy}
                                    onChange={(e) => {
                                        setGroupSelect(e.target.value);
                                        setModalErr(null);
                                    }}
                                >
                                    <option value="">Выберите группу</option>
                                    {groupsForMajor.map((g) => (
                                        <option key={g.id} value={String(g.id)}>
                                            {g.name} ({g.course_number} курс)
                                        </option>
                                    ))}
                                    <option value="new">+ Создать новую группу…</option>
                                </select>

                                {groupSelect === 'new' && (
                                    <div className="assign-inline-block assign-stack">
                                        <input
                                            type="text"
                                            className="assign-input"
                                            placeholder="Название группы (например 104)"
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                            disabled={modalBusy}
                                        />
                                        <select
                                            className="assign-select"
                                            value={newCourseId}
                                            disabled={modalBusy}
                                            onChange={(e) => setNewCourseId(e.target.value)}
                                        >
                                            <option value="">Курс</option>
                                            {courses.map((c) => (
                                                <option key={c.id} value={String(c.id)}>
                                                    {c.number} курс
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="modal-btns assign-wizard-actions">
                            <button
                                type="button"
                                className="action-btn"
                                disabled={modalBusy}
                                onClick={() => setAssignOpen(false)}
                            >
                                Отмена
                            </button>
                            {majorSelect !== '' &&
                                majorSelect !== 'new' &&
                                groupSelect !== '' &&
                                groupSelect !== 'new' && (
                                    <button
                                        type="button"
                                        className="action-btn action-btn--primary"
                                        disabled={modalBusy}
                                        onClick={addExistingGroup}
                                    >
                                        Добавить в таблицу
                                    </button>
                                )}
                            {majorSelect !== '' &&
                                majorSelect !== 'new' &&
                                groupSelect === 'new' &&
                                newGroupName.trim() &&
                                newCourseId && (
                                    <button
                                        type="button"
                                        className="action-btn action-btn--primary"
                                        disabled={modalBusy}
                                        onClick={() => void createGroupAndAssign()}
                                    >
                                        Создать и закрепить
                                    </button>
                                )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherProfilePageForAdmin;

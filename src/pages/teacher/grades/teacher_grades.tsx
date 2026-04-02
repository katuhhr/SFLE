import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Check, Edit2 } from 'lucide-react';
import { authFetch } from '../../../api/authFetch';
import './teacher_grades.css';

interface GroupRow {
    id: number;
    name: string;
}

interface SheetStudent {
    id: number;
    name: string;
    values: string[];
}

function formatApiDetail(detail: unknown, fallback: string): string {
    if (typeof detail === 'string') {
        return detail;
    }
    if (Array.isArray(detail)) {
        const parts = detail.map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
        return parts.join(' ').trim() || fallback;
    }
    if (detail && typeof detail === 'object') {
        try {
            return JSON.stringify(detail);
        } catch {
            return fallback;
        }
    }
    return fallback;
}

const TeacherGrades: React.FC = () => {
    const [groupsList, setGroupsList] = useState<GroupRow[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
    const [groupTitle, setGroupTitle] = useState<string>('');

    const [columns, setColumns] = useState<string[]>(['Урок №1', 'Диалог', 'Урок №2', '', '']);
    const [students, setStudents] = useState<{ id: number; name: string }[]>([]);
    const [grades, setGrades] = useState<Record<string, string>>({});

    const [isEditing, setIsEditing] = useState(false);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [loadingSheet, setLoadingSheet] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const groupsInitRef = useRef(false);

    const hasAnyToken = () =>
        !!(localStorage.getItem('access_token') || localStorage.getItem('refresh_token'));

    const gradesFromStudents = (list: SheetStudent[], colCount: number) => {
        const g: Record<string, string> = {};
        list.forEach((s, sIdx) => {
            for (let cIdx = 0; cIdx < colCount; cIdx += 1) {
                g[`${sIdx}-${cIdx}`] = s.values[cIdx] ?? '';
            }
        });
        return g;
    };

    const loadGroups = useCallback(async () => {
        if (!hasAnyToken()) {
            setLoadingGroups(false);
            setError('Войдите как преподаватель.');
            setGroupsList([]);
            return;
        }
        setLoadingGroups(true);
        setError(null);
        try {
            const res = await authFetch('/api/admin/teacher/gradebook/groups/');
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                const p = payload as { detail?: unknown };
                const d = p.detail;
                let msg =
                    typeof d === 'string'
                        ? d
                        : res.status === 401
                          ? 'Сессия истекла. Войдите снова.'
                          : 'Не удалось загрузить группы';
                if (
                    res.status === 401 &&
                    typeof d === 'string' &&
                    (d.toLowerCase().includes('токен') || d.toLowerCase().includes('token'))
                ) {
                    msg = 'Сессия истекла или токен недействителен. Войдите снова.';
                }
                setError(msg);
                setGroupsList([]);
                return;
            }
            const data = (payload as { data?: GroupRow[] }).data || [];
            setGroupsList(data);
            if (data.length && !groupsInitRef.current) {
                groupsInitRef.current = true;
                setSelectedGroupId(data[0].id);
            }
        } catch {
            setError('Нет связи с сервером.');
            setGroupsList([]);
        } finally {
            setLoadingGroups(false);
        }
    }, []);

    const loadSheet = useCallback(async (groupId: number) => {
        if (!hasAnyToken()) return;
        setLoadingSheet(true);
        setError(null);
        try {
            const res = await authFetch(`/api/admin/teacher/gradebook/?group_id=${groupId}`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                const p = payload as { detail?: unknown };
                const d = p.detail;
                let msg =
                    typeof d === 'string'
                        ? d
                        : res.status === 401
                          ? 'Сессия истекла. Войдите снова.'
                          : 'Не удалось загрузить ведомость';
                if (
                    res.status === 401 &&
                    typeof d === 'string' &&
                    (d.toLowerCase().includes('токен') || d.toLowerCase().includes('token'))
                ) {
                    msg = 'Сессия истекла или токен недействителен. Войдите снова.';
                }
                setError(msg);
                return;
            }
            const d = (payload as { data?: { group_name?: string; column_titles?: string[]; students?: SheetStudent[] } })
                .data;
            if (!d) return;
            setGroupTitle(d.group_name || '');
            const rawCols = Array.isArray(d.column_titles) ? d.column_titles : [];
            const finalCols =
                rawCols.length > 0
                    ? rawCols.map((x) => (x == null ? '' : String(x)))
                    : ['Урок №1', 'Диалог', 'Урок №2', '', ''];
            setColumns(finalCols);
            const studs = Array.isArray(d.students) ? d.students : [];
            setStudents(studs.map((s) => ({ id: s.id, name: s.name })));
            setGrades(gradesFromStudents(studs, finalCols.length));
        } catch {
            const g = groupsList.find((x) => x.id === groupId);
            if (g) setGroupTitle(g.name);
            setStudents([]);
            setGrades({});
            setError('Нет связи с сервером.');
        } finally {
            setLoadingSheet(false);
        }
    }, [groupsList]);

    useEffect(() => {
        loadGroups();
    }, [loadGroups]);

    useEffect(() => {
        setIsEditing(false);
    }, [selectedGroupId]);

    useEffect(() => {
        if (selectedGroupId != null) {
            loadSheet(selectedGroupId);
        }
    }, [selectedGroupId, loadSheet]);

    const saveSheet = async (): Promise<boolean> => {
        if (!hasAnyToken() || selectedGroupId == null) return false;
        setSaving(true);
        setError(null);
        try {
            const cells: Record<string, string[]> = {};
            students.forEach((s, sIdx) => {
                cells[String(s.id)] = columns.map((_, cIdx) => grades[`${sIdx}-${cIdx}`] ?? '');
            });
            const res = await authFetch('/api/admin/teacher/gradebook/', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: selectedGroupId,
                    column_titles: columns,
                    cells,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                const p = payload as { detail?: unknown };
                setError(formatApiDetail(p.detail, 'Не удалось сохранить'));
                return false;
            }
            await loadSheet(selectedGroupId);
            return true;
        } catch {
            setError('Нет связи с сервером.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const toggleEdit = async () => {
        if (isEditing) {
            const ok = await saveSheet();
            if (ok) setIsEditing(false);
        } else {
            setIsEditing(true);
        }
    };

    const addColumn = () => {
        const newIdx = columns.length;
        setColumns([...columns, '']);
        setGrades((prev) => {
            const next = { ...prev };
            students.forEach((_, sIdx) => {
                next[`${sIdx}-${newIdx}`] = '';
            });
            return next;
        });
    };

    const updateColumnName = (index: number, value: string) => {
        const newCols = [...columns];
        newCols[index] = value;
        setColumns(newCols);
    };

    return (
        <div className="grades-page-layout">
            <aside className="grades-nav-sidebar">
                {loadingGroups && <div className="nav-spec-static">Загрузка…</div>}
                {error && (
                    <div className="nav-spec-static" style={{ color: '#b91c1c', fontSize: 13, marginBottom: 8 }}>
                        {error}
                    </div>
                )}
                <div className="nav-spec-container">
                    <div className="nav-course-sub">
                        {groupsList.length === 0 && !loadingGroups && !error && (
                            <div className="nav-group-link" style={{ cursor: 'default' }}>
                                Нет групп
                            </div>
                        )}
                        {groupsList.map((g) => (
                            <div
                                key={g.id}
                                className={`nav-group-link ${selectedGroupId === g.id ? 'selected' : ''}`}
                                onClick={() => setSelectedGroupId(g.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && setSelectedGroupId(g.id)}
                            >
                                {g.name}
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            <main className="grades-content-view">
                <div className="grades-white-sheet">
                    <div className="grades-view-header">
                        <h2 className="grades-view-title">
                            {loadingSheet ? '…' : groupTitle || 'Выберите группу'}
                        </h2>
                        <div className="grades-header-btns">
                            {isEditing && (
                                <button
                                    type="button"
                                    className="grades-action-btn add"
                                    onClick={addColumn}
                                    disabled={saving || selectedGroupId == null}
                                >
                                    <Plus size={18} /> Добавить колонку
                                </button>
                            )}
                            <button
                                type="button"
                                className={`grades-action-btn ${isEditing ? 'save-blue' : 'edit'}`}
                                onClick={() => void toggleEdit()}
                                disabled={saving || loadingSheet || selectedGroupId == null}
                            >
                                {isEditing ? (
                                    <>
                                        <Check size={18} /> {saving ? 'Сохранение…' : 'Сохранить'}
                                    </>
                                ) : (
                                    <>
                                        <Edit2 size={18} /> Редактировать
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="table-container-styled">
                        <table className="custom-vedomost-table">
                            <thead>
                                <tr>
                                    <th className="th-fio">ФИО</th>
                                    {columns.map((col, i) => (
                                        <th key={i}>
                                            <input
                                                className="header-edit-input"
                                                value={col}
                                                disabled={!isEditing}
                                                onChange={(e) => updateColumnName(i, e.target.value)}
                                                placeholder="..."
                                            />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student, sIdx) => (
                                    <tr key={student.id}>
                                        <td className="td-student-name">{student.name}</td>
                                        {columns.map((_, cIdx) => (
                                            <td key={cIdx}>
                                                <input
                                                    className="cell-grade-input"
                                                    value={grades[`${sIdx}-${cIdx}`] || ''}
                                                    disabled={!isEditing}
                                                    onChange={(e) =>
                                                        setGrades({ ...grades, [`${sIdx}-${cIdx}`]: e.target.value })
                                                    }
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TeacherGrades;

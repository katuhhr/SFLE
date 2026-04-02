import React, { FC, useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, isSameDay, parse, differenceInCalendarDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X } from 'lucide-react';
import { apiUrl } from '../../../config';
import './teacher_schedule.css';

interface ILesson {
    id?: number;
    time: string;
    group: string;
    room: string;
}

interface ApiScheduleRow {
    id: number;
    group_name: string;
    day_of_week: string;
    lesson_date: string;
    lesson_time: string;
    room: string;
}

interface GroupOption {
    id: number;
    name: string;
}

const TeacherSchedule: FC = () => {
    const today = new Date();
    const initialMonday = startOfWeek(today, { weekStartsOn: 1 });
    const [monday] = useState(initialMonday);

    const [days, setDays] = useState<{ date: Date; lessons: ILesson[] }[]>(() =>
        [...Array(6)].map((_, i) => ({
            date: addDays(initialMonday, i),
            lessons: [],
        })),
    );
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [defaultGroupName, setDefaultGroupName] = useState('');
    const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);

    const token = localStorage.getItem('access_token');
    const makeHeaders = (json = false): HeadersInit => ({
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(json ? { 'Content-Type': 'application/json' } : {}),
    });

    const buildDaysFromApi = useCallback((entries: ApiScheduleRow[], weekMonday: Date) => {
        const d = [...Array(6)].map((_, i) => ({
            date: addDays(weekMonday, i),
            lessons: [] as ILesson[],
        }));
        for (const row of entries || []) {
            const ld = parse(row.lesson_date, 'yyyy-MM-dd', new Date());
            const dayIdx = differenceInCalendarDays(ld, weekMonday);
            if (dayIdx < 0 || dayIdx > 5) continue;
            let t = row.lesson_time || '';
            if (typeof t === 'string' && t.length > 5) t = t.slice(0, 5);
            d[dayIdx].lessons.push({
                id: row.id,
                time: t,
                group: row.group_name || '',
                room: row.room || '',
            });
        }
        for (const day of d) {
            day.lessons.sort((a, b) => a.time.localeCompare(b.time));
        }
        return d;
    }, []);

    const loadSchedule = useCallback(async () => {
        if (!token) {
            setLoading(false);
            setError('Войдите в аккаунт.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const meRes = await fetch(apiUrl('/api/auth/me/'), { headers: makeHeaders() });
            const me = await meRes.json().catch(() => ({}));
            if (meRes.ok && typeof (me as { group?: string }).group === 'string') {
                setDefaultGroupName((me as { group: string }).group);
            }

            const gRes = await fetch(apiUrl('/api/admin/teacher/groups/'), { headers: makeHeaders() });
            const gPayload = await gRes.json().catch(() => ({}));
            if (gRes.ok && Array.isArray((gPayload as { data?: GroupOption[] }).data)) {
                setGroupOptions((gPayload as { data: GroupOption[] }).data);
            }

            const ws = format(monday, 'yyyy-MM-dd');
            const res = await fetch(apiUrl(`/api/admin/teacher/schedule/?week_start=${encodeURIComponent(ws)}`), {
                headers: makeHeaders(),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((payload as { detail?: string }).detail || 'Не удалось загрузить расписание');
                return;
            }
            const entries = (payload as { data?: ApiScheduleRow[] }).data || [];
            setDays(buildDaysFromApi(entries, monday));
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setLoading(false);
        }
    }, [token, monday, buildDaysFromApi]);

    useEffect(() => {
        loadSchedule();
    }, [loadSchedule]);

    const saveSchedule = async () => {
        if (!token) return;
        setSaving(true);
        setError(null);
        const lessons: Array<{
            id?: number;
            lesson_date: string;
            lesson_time: string;
            group_name: string;
            room: string;
        }> = [];
        for (const day of days) {
            const lessonDate = format(day.date, 'yyyy-MM-dd');
            for (const le of day.lessons) {
                if (!le.time.trim()) continue;
                const g = (le.group || defaultGroupName).trim();
                if (!g) continue;
                const r = (le.room || '-').trim() || '-';
                const row: { id?: number; lesson_date: string; lesson_time: string; group_name: string; room: string } = {
                    lesson_date: lessonDate,
                    lesson_time: le.time.trim(),
                    group_name: g,
                    room: r,
                };
                if (le.id != null) row.id = le.id;
                lessons.push(row);
            }
        }
        try {
            const res = await fetch(apiUrl('/api/admin/teacher/schedule/'), {
                method: 'PUT',
                headers: makeHeaders(true),
                body: JSON.stringify({
                    week_start: format(monday, 'yyyy-MM-dd'),
                    lessons,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((payload as { detail?: string }).detail || 'Ошибка сохранения');
                return;
            }
            const entries = (payload as { data?: ApiScheduleRow[] }).data || [];
            setDays(buildDaysFromApi(entries, monday));
        } catch {
            setError('Нет связи с сервером.');
        } finally {
            setSaving(false);
        }
    };

    const handleInputChange = (dayIdx: number, lessonIdx: number, field: keyof ILesson, value: string) => {
        const newDays = [...days];
        newDays[dayIdx].lessons[lessonIdx] = {
            ...newDays[dayIdx].lessons[lessonIdx],
            [field]: value,
        };
        setDays(newDays);
    };

    const addLesson = (dayIdx: number) => {
        const newDays = [...days];
        newDays[dayIdx].lessons.push({ time: '', group: defaultGroupName, room: '' });
        setDays(newDays);
    };

    const removeLesson = (dayIdx: number, lessonIdx: number) => {
        const newDays = [...days];
        newDays[dayIdx].lessons.splice(lessonIdx, 1);
        setDays(newDays);
    };

    return (
        <div className="schedule-page">
            <div className="schedule-header">
                <h2 className="schedule-title">Мое расписание</h2>
                <button
                    type="button"
                    className="edit-pill-btn"
                    disabled={saving || loading}
                    onClick={async () => {
                        if (isEditing) {
                            await saveSchedule();
                            setIsEditing(false);
                        } else {
                            setIsEditing(true);
                        }
                    }}
                >
                    {saving ? 'Сохранение…' : isEditing ? 'Сохранить' : 'Редактировать'}
                </button>
            </div>
            {loading && <p className="schedule-status">Загрузка…</p>}
            {error && <p className="schedule-status schedule-status-err">{error}</p>}
            {!loading && !token && (
                <p className="schedule-status schedule-status-err">Нужна авторизация преподавателя.</p>
            )}

            <div className="schedule-grid-layout">
                {days.map((day, idx) => {
                    const isToday = isSameDay(day.date, today);
                    return (
                        <div key={idx} className={`schedule-day-card ${isToday ? 'is-today' : ''}`}>
                            <div className="day-card-header">
                                <div className="day-date-badge">
                                    {format(day.date, 'EEEEEE', { locale: ru }).toUpperCase()}{' '}
                                    {format(day.date, 'dd.MM')}
                                </div>
                            </div>
                            <div className="day-lessons-list">
                                {day.lessons.map((lesson, lIdx) => {
                                    const groupKnown = groupOptions.some((g) => g.name === lesson.group);
                                    return (
                                    <div key={lesson.id != null ? `id-${lesson.id}` : `new-${lIdx}`} className="lesson-entry-wrapper">
                                        <div className="lesson-entry lesson-entry-row">
                                            <input
                                                placeholder="00:00"
                                                disabled={!isEditing}
                                                className="lesson-input time-field"
                                                value={lesson.time}
                                                onChange={(e) => handleInputChange(idx, lIdx, 'time', e.target.value)}
                                            />
                                            <select
                                                disabled={!isEditing}
                                                className="lesson-input lesson-select"
                                                value={lesson.group}
                                                onChange={(e) =>
                                                    handleInputChange(idx, lIdx, 'group', e.target.value)
                                                }
                                            >
                                                <option value="">— выберите группу —</option>
                                                {groupOptions.map((g) => (
                                                    <option key={g.id} value={g.name}>
                                                        {g.name}
                                                    </option>
                                                ))}
                                                {lesson.group && !groupKnown ? (
                                                    <option value={lesson.group}>
                                                        {lesson.group} (нет в справочнике)
                                                    </option>
                                                ) : null}
                                            </select>
                                            <input
                                                placeholder="Ауд."
                                                disabled={!isEditing}
                                                className="lesson-input room-field"
                                                value={lesson.room}
                                                onChange={(e) =>
                                                    handleInputChange(idx, lIdx, 'room', e.target.value)
                                                }
                                            />
                                        </div>
                                        {isEditing && (
                                            <button
                                                type="button"
                                                className="remove-lesson-btn"
                                                onClick={() => removeLesson(idx, lIdx)}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                    );
                                })}
                                {isEditing && (
                                    <button type="button" className="inner-add-btn" onClick={() => addLesson(idx)}>
                                        +
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TeacherSchedule;

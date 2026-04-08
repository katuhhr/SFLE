import React, { useCallback, useEffect, useState } from 'react';
import './student_grades.css';
import { authFetch } from '../../../api/authFetch';

type GradebookPayload = {
    group_name: string;
    column_titles: string[];
    values: string[];
};

type ProgressResponse = {
    attendance: Array<{ date_str: string; is_came: boolean; is_completed: boolean }>;
    test_results: Array<{ test_name: string; date: string; score: number; max_score: number; percentage: number }>;
    tasks: Array<{ task_name: string; deadline: string; status: string; grade: number | null }>;
    gradebook?: GradebookPayload | null;
};

type ActivityRow = {
    date: string;
    dialog: string;
    test: string;
    work1: string;
    work2: string;
    work3: string;
    work4: string;
    work5: string;
};

const StudentGrades: React.FC = () => {
    const [gradebook, setGradebook] = useState<GradebookPayload | null>(null);
    const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (!localStorage.getItem('access_token') && !localStorage.getItem('refresh_token')) {
                setError('Войдите в аккаунт.');
                setGradebook(null);
                setActivityRows([]);
                return;
            }
            const res = await authFetch('/api/student/progress/');
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error((json as { message?: string }).message || 'Ошибка загрузки успеваемости');
            }
            const data = (json as { data?: ProgressResponse }).data;
            if (!data) {
                setGradebook(null);
                setActivityRows([]);
                return;
            }

            setGradebook(data.gradebook ?? null);

            const rows: ActivityRow[] = [];

            data.attendance.forEach((a) => {
                rows.push({
                    date: a.date_str || '',
                    dialog: a.is_came ? '+' : '-',
                    test: '',
                    work1: a.is_completed ? 'сдано' : 'не сдано',
                    work2: '',
                    work3: '',
                    work4: '',
                    work5: '',
                });
            });

            data.test_results.forEach((t) => {
                rows.push({
                    date: t.date || '',
                    dialog: '',
                    test: `${t.score}/${t.max_score} (${t.percentage}%)`,
                    work1: t.test_name || '',
                    work2: '',
                    work3: '',
                    work4: '',
                    work5: '',
                });
            });

            data.tasks.forEach((t) => {
                rows.push({
                    date: t.deadline ? new Date(t.deadline).toLocaleDateString('ru-RU') : '',
                    dialog: '',
                    test: '',
                    work1: t.task_name || '',
                    work2: t.status || '',
                    work3: t.grade === null ? '' : String(t.grade),
                    work4: '',
                    work5: '',
                });
            });

            rows.sort((a, b) => {
                const da = Date.parse(a.date.split('.').reverse().join('-')) || Date.parse(a.date) || 0;
                const db = Date.parse(b.date.split('.').reverse().join('-')) || Date.parse(b.date) || 0;
                return db - da;
            });

            setActivityRows(rows);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Ошибка загрузки успеваемости';
            setError(msg);
            setGradebook(null);
            setActivityRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const hasGradebookCols = gradebook && gradebook.column_titles.length > 0;

    return (
        <div className="student-grades-container">
            <div className="grades-card">
                <h1 className="grades-title">Успеваемость</h1>

                <section className="grades-section" aria-label="Ведомость преподавателя">
                    <h2 className="grades-subtitle">Оценки из ведомости</h2>
                    {loading && <p className="grades-muted">Загрузка…</p>}
                    {!loading && !error && !hasGradebookCols && (
                        <p className="grades-muted">
                            {gradebook === null
                                ? 'У вас не указана группа.'
                                : 'Преподаватель ещё не заполнил ведомость для вашей группы или колонки пусты.'}
                        </p>
                    )}
                    {!loading && !error && hasGradebookCols && gradebook && (
                        <>
                            <p className="grades-group-label">Группа: {gradebook.group_name}</p>
                            <div className="grades-table-wrapper gradebook-table-wrap">
                                <table className="grades-table gradebook-table">
                                    <thead>
                                        <tr>
                                            {gradebook.column_titles.map((title, i) => (
                                                <th key={i}>{title.trim() ? title : '—'}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            {gradebook.values.map((v, i) => (
                                                <td key={i}>{v.trim() ? v : '—'}</td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </section>

                <section className="grades-section grades-section-activity" aria-label="Посещаемость и тесты">
                    <h2 className="grades-subtitle">Посещаемость, тесты и задания</h2>
                    <div className="grades-table-wrapper">
                        <table className="grades-table">
                            <thead>
                                <tr>
                                    <th className="sticky-col">Дата</th>
                                    <th>Диалог</th>
                                    <th>Тест</th>
                                    <th></th>
                                    <th></th>
                                    <th></th>
                                    <th></th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td className="sticky-col" colSpan={8}>
                                            Загрузка…
                                        </td>
                                    </tr>
                                )}
                                {error && !loading && (
                                    <tr>
                                        <td className="sticky-col" colSpan={8}>
                                            {error}
                                        </td>
                                    </tr>
                                )}
                                {!loading && !error && activityRows.length === 0 && (
                                    <tr>
                                        <td className="sticky-col" colSpan={8}>
                                            Нет записей.
                                        </td>
                                    </tr>
                                )}
                                {!loading &&
                                    !error &&
                                    activityRows.map((row, index) => (
                                        <tr key={index}>
                                            <td className="date-cell sticky-col">{row.date}</td>
                                            <td>{row.dialog}</td>
                                            <td>{row.test}</td>
                                            <td>{row.work1}</td>
                                            <td>{row.work2}</td>
                                            <td>{row.work3}</td>
                                            <td>{row.work4}</td>
                                            <td>{row.work5}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default StudentGrades;

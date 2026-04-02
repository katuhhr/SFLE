import React, { useCallback, useEffect, useState } from 'react';
import './student_debts.css';
import { authFetch } from '../../../api/authFetch';

type DashboardTask = {
    task_id: number;
    title: string;
    theme: string;
    deadline?: string;
    date?: string;
};

function formatLoadError(payload: unknown, fallback: string): string {
    const p = payload as { message?: string; detail?: unknown };
    if (typeof p.message === 'string' && p.message) {
        return p.message;
    }
    const d = p.detail;
    if (typeof d === 'string') {
        return d;
    }
    if (Array.isArray(d) && d.length) {
        return d.map((x) => (typeof x === 'string' ? x : String(x))).join(' ');
    }
    return fallback;
}

const StudentDebts: React.FC = () => {
    const [currentTasks, setCurrentTasks] = useState<DashboardTask[]>([]);
    const [debtTasks, setDebtTasks] = useState<DashboardTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!localStorage.getItem('access_token') && !localStorage.getItem('refresh_token')) {
            setLoading(false);
            setCurrentTasks([]);
            setDebtTasks([]);
            setError('Войдите в аккаунт, чтобы видеть задания.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch('/api/student/dashboard/');
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(formatLoadError(json, 'Ошибка загрузки'));
            }
            const data = (json as { data?: { current_tasks?: DashboardTask[]; debts?: DashboardTask[] } }).data;
            setCurrentTasks(Array.isArray(data?.current_tasks) ? data!.current_tasks! : []);
            const rawDebts = Array.isArray(data?.debts) ? data!.debts! : [];
            setDebtTasks(
                rawDebts.filter(
                    (item) => (item as { type?: string }).type === 'task' || !(item as { type?: string }).type,
                ) as DashboardTask[],
            );
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Ошибка загрузки долгов';
            setError(msg);
            setCurrentTasks([]);
            setDebtTasks([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const fmtDeadline = (value?: string) => {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleString('ru-RU');
    };

    return (
        <div className="student-debts-view">
            <div className="debts-stack">

                <div className="debt-section-card">
                    <div className="debt-badge">Текущие задания</div>
                    <div className="debt-blue-box">
                        {loading && <p className="debt-text">Загрузка...</p>}
                        {error && <p className="debt-text">{error}</p>}
                        {!loading && !error && currentTasks.length === 0 && (
                            <p className="debt-text">Текущих заданий нет.</p>
                        )}
                        {!loading &&
                            !error &&
                            currentTasks.map((task) => (
                                <div className="debt-item-row" key={`current-${task.task_id}`}>
                                    <p className="debt-text">
                                        {task.title}
                                        {task.theme ? ` (${task.theme})` : ''}
                                        {task.deadline ? ` — до ${fmtDeadline(task.deadline)}` : ''}
                                    </p>
                                </div>
                            ))}
                    </div>
                </div>

                <div className="debt-section-card">
                    <div className="debt-badge">Долги</div>
                    <div className="debt-blue-box">
                        {loading && <p className="debt-text">Загрузка...</p>}
                        {error && <p className="debt-text">{error}</p>}
                        {!loading && !error && debtTasks.length === 0 && (
                            <p className="debt-text">Просроченных заданий нет.</p>
                        )}
                        {!loading &&
                            !error &&
                            debtTasks.map((task) => (
                                <div className="debt-item-row" key={`debt-${task.task_id}`}>
                                    <span className="red-dot"></span>
                                    <p className="debt-text">
                                        {task.title}
                                        {task.theme ? ` (${task.theme})` : ''}
                                        {task.deadline ? ` — дедлайн ${fmtDeadline(task.deadline)}` : ''}
                                    </p>
                                </div>
                            ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StudentDebts;
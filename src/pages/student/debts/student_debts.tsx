import React, { useEffect, useState } from 'react';
import './student_debts.css';
import { apiGet } from '../../../api/client';

type CurrentTask = { task_id: number; title: string; deadline: string; theme: string };
type DebtItem = { type: string; date: string; title: string; theme: string };
type DashboardData = { current_tasks: CurrentTask[]; debts: DebtItem[] };
type ApiWrap<T> = { status: 'success' | 'error'; data: T };

const StudentDebts: React.FC = () => {
    const [data, setData] = useState<DashboardData | null>(null);

    useEffect(() => {
        apiGet<ApiWrap<DashboardData>>('/api/student/dashboard/')
            .then((resp) => setData(resp.data))
            .catch((err) => console.error('Ошибка загрузки долгов:', err));
    }, []);

    const currentTask = data?.current_tasks?.[0];

    return (
        <div className="student-debts-view">
            <div className="debts-stack">

                <div className="debt-section-card">
                    <div className="debt-badge">Текущее задание</div>
                    <div className="debt-blue-box">
                        {currentTask ? (
                            <>
                                <p className="debt-text">{currentTask.title}</p>
                                <p className="debt-text">Тема: {currentTask.theme || '-'}</p>
                            </>
                        ) : (
                            <p className="debt-text">Нет текущих заданий</p>
                        )}
                    </div>
                </div>

                <div className="debt-section-card">
                    <div className="debt-badge">Долги</div>
                    <div className="debt-blue-box">
                        {data?.debts?.length ? (
                            data.debts.map((debt, idx) => (
                                <div className="debt-item-row" key={`${debt.type}-${idx}`}>
                                    <span className="red-dot"></span>
                                    <p className="debt-text">{debt.title}</p>
                                </div>
                            ))
                        ) : (
                            <p className="debt-text">Долгов нет</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StudentDebts;
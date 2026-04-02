import React, { useEffect, useMemo, useState } from 'react';
import './student_grades.css';
import { apiGet } from '../../../api/client';

type Attendance = { date_str: string; is_came: boolean; is_completed: boolean };
type TestResult = { test_name: string; date: string; score: number; max_score: number; percentage: number };
type ProgressData = { attendance: Attendance[]; test_results: TestResult[]; tasks: unknown[] };
type ApiWrap<T> = { status: 'success' | 'error'; data: T };

const StudentGrades: React.FC = () => {
    const [progress, setProgress] = useState<ProgressData | null>(null);

    useEffect(() => {
        apiGet<ApiWrap<ProgressData>>('/api/student/progress/')
            .then((resp) => setProgress(resp.data))
            .catch((err) => console.error('Ошибка загрузки успеваемости:', err));
    }, []);

    const gradesData = useMemo(() => {
        const attendanceRows = (progress?.attendance || []).map((a) => ({
            date: a.date_str,
            dialog: a.is_came ? '+' : '-',
            test: '',
            work1: a.is_completed ? '+' : '-',
            work2: '',
            work3: '',
            work4: '',
            work5: '',
        }));

        const testRows = (progress?.test_results || []).map((t) => ({
            date: t.date,
            dialog: '',
            test: `${t.score}/${t.max_score}`,
            work1: `${t.percentage}%`,
            work2: '',
            work3: '',
            work4: '',
            work5: '',
        }));

        return [...testRows, ...attendanceRows];
    }, [progress]);

    return (
        <div className="student-grades-container">
            <div className="grades-card">
                <h1 className="grades-title">Успеваемость</h1>

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
                        {gradesData.map((row, index) => (
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
                        {[...Array(5)].map((_, i) => (
                            <tr key={`empty-${i}`}>
                                <td className="sticky-col"></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StudentGrades;
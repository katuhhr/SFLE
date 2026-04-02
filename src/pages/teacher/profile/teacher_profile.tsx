import React, { useEffect, useState } from 'react';
import { User, Edit2, Check, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../../../config';
import './teacher_profile.css';

interface RequestItem {
    id: number;
    studentName: string;
    date: string;
}

const TeacherProfile: React.FC = () => {
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [teacherData, setTeacherData] = useState({
        name: '',
        role: 'Преподаватель',
    });

    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [loading, setLoading] = useState(false);

    const token = localStorage.getItem('access_token');
    const makeHeaders = () => ({
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });

    const loadRequests = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch(apiUrl('/api/admin/teacher/requests/'), {
                headers: makeHeaders(),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return;
            setRequests((data.data || []) as RequestItem[]);
        } finally {
            setLoading(false);
        }
    };

    const loadMe = async () => {
        if (!token) return;
        const res = await fetch(apiUrl('/api/auth/me/'), {
            headers: makeHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        setTeacherData((prev) => ({
            ...prev,
            name: data.full_name || prev.name,
        }));
    };

    useEffect(() => {
        loadMe();
        loadRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAction = async (id: number, action: 'approve' | 'reject') => {
        if (!token) return;
        const endpoint =
            action === 'approve'
                ? apiUrl(`/api/admin/teacher/requests/${id}/approve/`)
                : apiUrl(`/api/admin/teacher/requests/${id}/reject/`);

        await fetch(endpoint, {
            method: 'POST',
            headers: { ...makeHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        await loadRequests();
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/');
    };

    return (
        <div className="teacher-profile-view">
            <div className="profile-white-card">
                {/* Левая сторона: Инфо и действия */}
                <div className="profile-left-side">
                    <div className="avatar-placeholder">
                        <User size={60} color="#1E3A8A" />
                    </div>

                    <div className="teacher-meta">
                        {isEditing ? (
                            <input
                                className="name-edit-field"
                                value={teacherData.name}
                                onChange={(e) => setTeacherData({...teacherData, name: e.target.value})}
                                autoFocus
                            />
                        ) : (
                            <h2 className="display-name">{teacherData.name}</h2>
                        )}
                        <p className="display-role">{teacherData.role}</p>
                    </div>

                    <div className="profile-actions-group">
                        <button
                            className={`profile-toggle-btn ${isEditing ? 'mode-save' : 'mode-edit'}`}
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            {isEditing ? <><Check size={18}/> Сохранить</> : <><Edit2 size={14}/> Изменить</>}
                        </button>

                        <button className="teacher-logout-btn" onClick={handleLogout}>
                            <LogOut size={16} /> Выйти
                        </button>
                    </div>
                </div>

                {/* Правая сторона: Заявки */}
                <div className="profile-right-side">
                    <h3 className="requests-table-title">Таблица заявок</h3>
                    <div className="requests-scroll-area">
                        <table className="requests-ui-table">
                            <thead>
                            <tr>
                                <th>№ заявки</th>
                                <th>ФИО</th>
                                <th>Дата заявки</th>
                                <th className="th-center">Действие</th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="empty-requests">Загрузка...</td>
                                </tr>
                            ) : requests.length > 0 ? (
                                requests.map((req, index) => (
                                    <tr key={req.id}>
                                        <td className="cell-muted">Заявка №{index + 1}</td>
                                        <td className="cell-fio">{req.studentName}</td>
                                        <td className="cell-muted">{req.date}</td>
                                        <td>
                                            <div className="request-actions-wrap">
                                                <button className="req-btn-outline" onClick={() => handleAction(req.id, 'approve')}>Принять</button>
                                                <button className="req-btn-outline grey" onClick={() => handleAction(req.id, 'reject')}>Отклонить</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="empty-requests">Новых заявок нет</td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherProfile;
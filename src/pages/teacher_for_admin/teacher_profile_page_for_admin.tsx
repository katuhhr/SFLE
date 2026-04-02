import React, { FC, useState, useEffect } from 'react';
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

const TeacherProfilePageForAdmin: FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [teacher, setTeacher] = useState<TeacherApi | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await authFetch(`/api/admin/teachers/${id}/`);
                const payload = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (!res.ok) {
                    setError((payload as { detail?: string }).detail || 'Не удалось загрузить преподавателя');
                    setTeacher(null);
                    return;
                }
                const row = (payload as { data?: TeacherApi }).data;
                setTeacher(row || null);
            } catch {
                if (!cancelled) {
                    setError('Нет связи с сервером.');
                    setTeacher(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    return (
        <div className="admin-page-bg">
            <div className="teacher-profile-card">
                <button type="button" className="back-link" onClick={() => navigate('/admin')}>
                    ← Назад
                </button>

                {loading && <p className="teacher-admin-muted">Загрузка…</p>}
                {error && <p className="teacher-admin-err">{error}</p>}

                {teacher && (
                    <div className="card-content teacher-admin-simple">
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
                        </div>
                        <div className="right-side">
                            <div className="table-container">
                                <div className="table-title">Группы (закрепление в системе)</div>
                                {!teacher.groups_taught?.length && (
                                    <p className="teacher-admin-muted">Группа не назначена.</p>
                                )}
                                {!!teacher.groups_taught?.length && (
                                    <ul className="teacher-admin-group-list">
                                        {teacher.groups_taught.map((g) => (
                                            <li key={g.id}>{g.name}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeacherProfilePageForAdmin;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import './student_profile.css';
import { authFetch } from '../../../api/authFetch';

type StudentProfileData = {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    full_name: string;
    email: string;
    role: string;
    group_name: string | null;
    major_name: string | null;
    course_number: number | null;
    is_active: boolean;
};

const StudentProfile: React.FC = () => {
    const navigate = useNavigate();
    const [studentData, setStudentData] = useState<StudentProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                if (!localStorage.getItem('access_token') && !localStorage.getItem('refresh_token')) {
                    setStudentData(null);
                    setError('Войдите в аккаунт, чтобы открыть профиль.');
                    return;
                }
                const res = await authFetch('/api/student/profile/');
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const j = json as { message?: string; detail?: string };
                    throw new Error(
                        j.message || (typeof j.detail === 'string' ? j.detail : '') || 'Ошибка загрузки профиля',
                    );
                }
                const data = (json as { data?: StudentProfileData }).data;
                if (!data) {
                    throw new Error('Профиль не найден');
                }
                setStudentData(data);
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Ошибка загрузки профиля';
                setError(msg);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/');
    };

    const profileName =
        studentData?.full_name ||
        [studentData?.lastname, studentData?.firstname].filter(Boolean).join(' ') ||
        '—';
    const profileGroup = studentData?.group_name ?? '—';
    const roleLabels: Record<string, string> = {
        student: 'Студент',
        teacher: 'Преподаватель',
        admin: 'Администратор',
        predpolagatel: 'Предполагатель',
    };
    const profileRole =
        studentData?.role != null ? roleLabels[studentData.role] ?? studentData.role : '—';

    return (
        <div className="student-profile-view">
            <div className="profile-white-card compact">
                <div className="profile-main-info">
                    <div className="avatar-placeholder" aria-hidden>
                        <User size={60} color="#1E3A8A" strokeWidth={1.25} />
                    </div>

                    <div className="info-rows">
                        <div className="info-block">
                            <span className="label">ФИО</span>
                            {loading ? (
                                <h2 className="display-name profile-skeleton">Загрузка…</h2>
                            ) : error ? (
                                <p className="profile-error-text">{error}</p>
                            ) : (
                                <h2 className="display-name">{profileName}</h2>
                            )}
                        </div>

                        <div className="info-block">
                            <span className="label">Группа</span>
                            {loading ? (
                                <p className="display-value profile-skeleton">Загрузка…</p>
                            ) : error ? (
                                <p className="display-value profile-skeleton">—</p>
                            ) : (
                                <p className="display-value">{profileGroup}</p>
                            )}
                        </div>

                        <div className="info-block">
                            <span className="label">Роль</span>
                            {loading ? (
                                <p className="display-value profile-skeleton">Загрузка…</p>
                            ) : error ? (
                                <p className="display-value profile-skeleton">—</p>
                            ) : (
                                <p className="display-value">{profileRole}</p>
                            )}
                        </div>

                        {!loading && !error && studentData && !studentData.is_active && (
                            <p className="profile-pending-note">
                                Аккаунт ожидает подтверждения преподавателем
                            </p>
                        )}
                    </div>

                    <button type="button" className="logout-btn" onClick={handleLogout}>
                        <LogOut size={18} aria-hidden />
                        Выйти
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentProfile;
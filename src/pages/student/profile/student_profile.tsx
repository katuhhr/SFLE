import React, { useEffect, useState } from 'react';
import { User, LogOut } from 'lucide-react';
import './student_profile.css';
import { apiGet } from '../../../api/client';

type StudentProfileData = {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    full_name: string;
    email: string;
    group_name: string | null;
};
type ApiWrap<T> = { status: 'success' | 'error'; data: T };

const StudentProfile: React.FC = () => {
    const [studentData, setStudentData] = useState<StudentProfileData | null>(null);

    useEffect(() => {
        apiGet<ApiWrap<StudentProfileData>>('/api/student/profile/')
            .then((resp) => setStudentData(resp.data))
            .catch((err) => console.error('Ошибка загрузки профиля:', err));
    }, []);

    const handleLogout = () => {
        console.log("Выход из системы...");
    };

    return (
        <div className="student-profile-view">
            <div className="profile-white-card compact">
                <div className="profile-main-info">
                    <div className="avatar-placeholder">
                        <User size={60} color="#1E3A8A" />
                    </div>

                    <div className="info-rows">
                        <div className="info-block">
                            <span className="label">ФИО</span>
                            <h2 className="display-name">{studentData?.full_name || 'Загрузка...'}</h2>
                        </div>

                        <div className="info-block">
                            <span className="label">Группа</span>
                            <p className="display-group">{studentData?.group_name || '-'}</p>
                        </div>

                        <div className="info-block">
                            <span className="label">Роль</span>
                            <p className="display-role">{studentData.role}</p>
                        </div>
                    </div>

                    <button className="logout-btn" onClick={handleLogout}>
                        <LogOut size={18} />
                        Выйти
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentProfile;
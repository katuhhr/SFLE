import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import Login from "./pages/registration/login";
import AdminPage from "./pages/admin/admin_page";
import TeacherProfileForAdmin from "./pages/teacher_for_admin/teacher_profile_page_for_admin";
import AdminGuard from "./components/admin/AdminGuard";

import TeacherLayout from "./components/teacher/teacher_layout";
import TeacherProfilePage from "./pages/teacher/profile/teacher_profile";
import TeacherSchedule from "./pages/teacher/schedule/teacher_schedule";
import TeacherGrades from "./pages/teacher/grades/teacher_grades";
import TeacherSelfStudy from "./pages/teacher/self_study/teacher_self_study";
import TeacherMaterials from "./pages/teacher/materials/teacher_materials";

import StudentLayout from "./components/student/student_layout";
import StudentDebts from "./pages/student/debts/student_debts";
import StudentSelfStudy from "./pages/student/self_study/student_self_study";
import StudentGrades from "./pages/student/grades/student_grades";
import StudentMaterials from "./pages/student/materials/student_materials";
import StudentProfile from "./pages/student/profile/student_profile";

const App = () => {
    return (
        <BrowserRouter>
            <div className="app-container">
                <Routes>
                    <Route path="/" element={<Login />} />

                    {/* Панель администратора (только role=admin) */}
                    <Route
                        path="/admin"
                        element={
                            <AdminGuard>
                                <AdminPage />
                            </AdminGuard>
                        }
                    />
                    <Route
                        path="/admin/teacher/:id"
                        element={
                            <AdminGuard>
                                <TeacherProfileForAdmin />
                            </AdminGuard>
                        }
                    />

                    {/* Личный кабинет преподавателя */}
                    <Route path="/teacher" element={<TeacherLayout />}>
                        <Route index element={<Navigate to="schedule" />} />
                        <Route path="profile" element={<TeacherProfilePage />} />
                        <Route path="schedule" element={<TeacherSchedule />} />
                        <Route path="materials" element={<TeacherMaterials />} />
                        <Route path="grades" element={<TeacherGrades />} />
                        <Route path="selfstudy" element={<TeacherSelfStudy />} />
                    </Route>

                    {/* Личный кабинет студента */}
                    <Route path="/student" element={<StudentLayout />}>
                        <Route index element={<Navigate to="debts" />} />
                        <Route path="debts" element={<StudentDebts />} />
                        <Route path="materials" element={<StudentMaterials />} />
                        <Route path="selfstudy" element={<StudentSelfStudy />} />
                        <Route path="grades" element={<StudentGrades />} />
                        <Route path="profile" element={<StudentProfile />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
};

export default App;
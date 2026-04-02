import React, { useEffect, useState } from 'react';
import './student_materials.css';
import { apiGet } from '../../../api/client';

type Theme = { id: number; name: string };
type ThemeDetail = {
    id: number;
    name: string;
    theory: { id: number; title: string; content: string } | null;
    links: { theory: string; tasks: string; test: string };
};
type ThemeTask = { id: number; text: string; deadline: string };
type ApiWrap<T> = { status: 'success' | 'error'; data: T };
type ThemeTasksResponse = { status: 'success'; data: { theme: Theme; tasks: ThemeTask[] } };

const StudentMaterials: React.FC = () => {
    const [topics, setTopics] = useState<Theme[]>([]);
    const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
    const [topicDetail, setTopicDetail] = useState<ThemeDetail | null>(null);
    const [tasks, setTasks] = useState<ThemeTask[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        apiGet<ApiWrap<Theme[]>>('/api/student/themes/')
            .then((resp) => {
                setTopics(resp.data);
                if (resp.data.length > 0) {
                    setSelectedTopicId(resp.data[0].id);
                }
            })
            .catch((err) => {
                console.error('Ошибка загрузки тем:', err);
            });
    }, []);

    useEffect(() => {
        if (!selectedTopicId) {
            setTopicDetail(null);
            setTasks([]);
            return;
        }

        setLoading(true);
        Promise.all([
            apiGet<ApiWrap<ThemeDetail>>(`/api/student/themes/${selectedTopicId}/`),
            apiGet<ThemeTasksResponse>(`/api/student/themes/${selectedTopicId}/tasks/`),
        ])
            .then(([detailResp, tasksResp]) => {
                setTopicDetail(detailResp.data);
                setTasks(tasksResp.data.tasks);
            })
            .catch((err) => {
                console.error('Ошибка загрузки темы:', err);
                setTopicDetail(null);
                setTasks([]);
            })
            .finally(() => setLoading(false));
    }, [selectedTopicId]);

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="materials-page-container">
            <aside className="materials-sidebar">
                <div className="sidebar-header">
                    <span>Тема</span>
                    <span className="arrow-icon">▼</span>
                </div>
                <nav className="topics-list">
                    {topics.map((topic) => (
                        <button
                            key={topic.id}
                            className={`topic-item ${selectedTopicId === topic.id ? 'active' : ''}`}
                            onClick={() => setSelectedTopicId(topic.id)}
                        >
                            {topic.name}
                        </button>
                    ))}
                </nav>
            </aside>

            <main className="materials-content">
                <div className="content-inner-card">
                    <header className="content-topic-header">{topicDetail?.name || 'Тема'}</header>

                    <div style={{ marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button onClick={() => scrollTo('section-theory')}>Теория</button>
                        <button onClick={() => scrollTo('section-links')}>Ссылки</button>
                        <button onClick={() => scrollTo('section-tasks')}>Задания</button>
                        <button onClick={() => scrollTo('section-test')}>Тест</button>
                    </div>

                    <div className="content-body-sheet">
                        {loading && <p className="lecturer-text">Загрузка...</p>}

                        {!loading && !topicDetail && (
                            <p className="lecturer-text">Темы пока не найдены.</p>
                        )}

                        {!loading && topicDetail && (
                            <>
                                <section id="section-theory" style={{ marginBottom: 20 }}>
                                    <h3>{topicDetail.theory?.title || 'Теория'}</h3>
                                    {topicDetail.theory?.content ? (
                                        <div dangerouslySetInnerHTML={{ __html: topicDetail.theory.content }} />
                                    ) : (
                                        <p className="lecturer-text">Теория пока не добавлена.</p>
                                    )}
                                </section>

                                <section id="section-links" style={{ marginBottom: 20 }}>
                                    <h3>Ссылки по теме</h3>
                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        <a href="#section-theory" onClick={(e) => { e.preventDefault(); scrollTo('section-theory'); }}>К теории</a>
                                        <a href="#section-tasks" onClick={(e) => { e.preventDefault(); scrollTo('section-tasks'); }}>К заданиям</a>
                                        <a href="#section-test" onClick={(e) => { e.preventDefault(); scrollTo('section-test'); }}>К тесту</a>
                                    </div>
                                </section>

                                <section id="section-tasks" style={{ marginBottom: 20 }}>
                                    <h3>Задания</h3>
                                    {tasks.length === 0 ? (
                                        <p className="lecturer-text">По этой теме пока нет заданий.</p>
                                    ) : (
                                        <ol>
                                            {tasks.map((task) => (
                                                <li key={task.id}>
                                                    <div>{task.text}</div>
                                                    <small>Дедлайн: {new Date(task.deadline).toLocaleString()}</small>
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </section>

                                <section id="section-test">
                                    <h3>Тест</h3>
                                    <p className="lecturer-text">Откройте раздел теста по этой теме.</p>
                                </section>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StudentMaterials;
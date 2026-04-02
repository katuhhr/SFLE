import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Folder } from 'lucide-react';
import './student_self_study.css';
import { apiUrl } from '../../../config';

type SelfStudyTopic = {
    id: number;
    title: string;
    content: string;
    kind?: 'self_study' | 'common_theme';
};

const StudentSelfStudy: React.FC = () => {
    const [topics, setTopics] = useState<SelfStudyTopic[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<SelfStudyTopic | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const authHeaders = useMemo(() => {
        const token = localStorage.getItem('access_token');
        return {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }, []);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    setTopics([]);
                    setError('Войдите в аккаунт, чтобы видеть материалы самоподготовки.');
                    return;
                }
                const res = await fetch(apiUrl('/api/student/self-study/'), {
                    headers: authHeaders,
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const j = json as { message?: string; detail?: string };
                    throw new Error(
                        j.message || (typeof j.detail === 'string' ? j.detail : '') || 'Ошибка загрузки самоподготовки',
                    );
                }
                const payload = json as { data?: SelfStudyTopic[] };
                setTopics(Array.isArray(payload.data) ? payload.data : []);
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Ошибка загрузки самоподготовки';
                setError(msg);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [authHeaders]);

    if (selectedTopic) {
        return (
            <div className="student-self-study-view">
                <main className="topic-full-sheet">
                    <header className="topic-sheet-header">
                        <button
                            type="button"
                            className="back-arrow-btn"
                            onClick={() => setSelectedTopic(null)}
                            aria-label="Назад к списку"
                        >
                            <ArrowLeft size={22} color="#111827" />
                        </button>
                        <div className="topic-title-badge">{selectedTopic.title}</div>
                    </header>

                    <div className="topic-sheet-content">
                        {selectedTopic.content ? (
                            <div className="material-text-content">{selectedTopic.content}</div>
                        ) : (
                            <p className="study-self-empty">Для этой темы пока нет описания.</p>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="student-self-study-view">
            <div className="study-main-card">
                <h1 className="study-page-title">Самоподготовка</h1>

                {loading && <p className="study-self-status">Загрузка…</p>}
                {error && <p className="study-self-error">{error}</p>}
                {!loading && !error && topics.length === 0 && (
                    <p className="study-self-status">Тем для самоподготовки пока нет.</p>
                )}

                <div className="study-topics-grid">
                    {!loading &&
                        !error &&
                        topics.map((topic) => (
                            <div
                                key={`${topic.kind ?? 'item'}-${topic.id}`}
                                role="button"
                                tabIndex={0}
                                className="study-topic-pill"
                                onClick={() => setSelectedTopic(topic)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelectedTopic(topic);
                                    }
                                }}
                            >
                                <Folder size={20} color="#1E3A8A" strokeWidth={1.5} />
                                <span className="topic-pill-text">{topic.title}</span>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};

export default StudentSelfStudy;

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Folder } from 'lucide-react';
import { apiUrl } from '../../../config';
import './student_self_study.css';

interface SelfStudyRow {
    id: number;
    title: string;
    content: string;
}

const StudentSelfStudy: React.FC = () => {
    const [topics, setTopics] = useState<SelfStudyRow[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<SelfStudyRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(apiUrl('/api/student/self-study/'), {
                headers: { Accept: 'application/json' },
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((payload as { detail?: string }).detail || 'Не удалось загрузить темы');
                setTopics([]);
                return;
            }
            setTopics((payload as { data?: SelfStudyRow[] }).data || []);
        } catch {
            setError('Нет связи с сервером.');
            setTopics([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

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
                            <p className="study-self-empty">Текст темы в базе не задан.</p>
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
                <p className="study-page-subtitle">Общие темы из учебного каталога</p>

                {loading && <p className="study-self-status">Загрузка…</p>}
                {error && <p className="study-self-error">{error}</p>}
                {!loading && !error && topics.length === 0 && (
                    <p className="study-self-status">Общих тем пока нет.</p>
                )}

                <div className="study-topics-grid">
                    {topics.map((topic) => (
                        <div
                            key={topic.id}
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

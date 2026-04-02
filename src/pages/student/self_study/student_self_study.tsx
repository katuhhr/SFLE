import React, { useState } from 'react';
import { ArrowLeft, Folder } from 'lucide-react';
import './student_self_study.css';
import { apiGet } from '../../../api/client';
import { useEffect } from 'react';

type SelfStudyItem = { id: number; title: string; content: string };
type ApiWrap<T> = { status: 'success' | 'error'; data: T };

const StudentSelfStudy: React.FC = () => {
    const [topics, setTopics] = useState<SelfStudyItem[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<SelfStudyItem | null>(null);

    useEffect(() => {
        apiGet<ApiWrap<SelfStudyItem[]>>('/api/student/self-study/')
            .then((resp) => setTopics(resp.data))
            .catch((err) => console.error('Ошибка загрузки самоподготовки:', err));
    }, []);

    if (selectedTopic) {
        return (
            <div className="student-self-study-view">
                <main className="topic-full-sheet">
                    <header className="topic-sheet-header">
                        <button className="back-arrow-btn" onClick={() => setSelectedTopic(null)}>
                            <ArrowLeft size={22} color="#111827" />
                        </button>
                        <div className="topic-title-badge">
                            {selectedTopic.title}
                        </div>
                    </header>

                    <div className="topic-sheet-content">
                        {selectedTopic.content ? (
                            <div className="material-text-content">{selectedTopic.content}</div>
                        ) : (
                            <div className="material-text-content">Материал пока пуст.</div>
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

                <div className="study-topics-grid">
                    {topics.map((topic, index) => (
                        <div
                            key={index}
                            className="study-topic-pill"
                            onClick={() => setSelectedTopic(topic)}
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
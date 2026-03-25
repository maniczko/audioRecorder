import React, { useState } from 'react';
import { createMediaService } from './services/mediaService';
import { Input } from './ui/Input';

export default function RagSearchTab({ currentWorkspace }) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !currentWorkspace?.id) return;
    setLoading(true);
    setAnswer('');
    try {
      const ms = await createMediaService();
      const res = await ms.askRAG(currentWorkspace.id, query);
      setAnswer(res?.answer || 'Brak odpowiedzi');
    } catch (err) {
      setAnswer('Wystąpił błąd podczas przeszukiwania archiwalnych nagrań.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modern-content-wrapper p-8" style={{ maxWidth: 800, margin: '0 auto' }}>
      <section className="panel recordings-rag-panel" style={{ marginTop: '15vh' }}>
        <div className="panel-header compact recordings-panel-header-flat">
          <div>
            <div className="eyebrow recordings-rag-eyebrow" style={{ color: 'var(--accent)' }}>AI RAG Memory</div>
            <h2>Zapytaj o Archiwum</h2>
            <p className="soft-copy recordings-copy-tight">
              Przeszukuj archiwalne spotkania, by przypomnieć sobie szczegóły lub dawne merytoryczne ustalenia.
            </p>
          </div>
        </div>
        <div className="panel-body">
          <form onSubmit={handleSearch} className="recordings-rag-form">
            <Input
              className="recordings-rag-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj kontekstu z każdego spotkania z twojej bazy danych..."
              style={{ fontSize: '1.1rem', padding: '16px 20px' }}
            />
            <button
              type="submit"
              className="primary-button recordings-rag-submit"
              disabled={loading || !query.trim()}
              style={{ marginTop: 16, width: '100%', padding: '14px', fontSize: '1.05rem' }}
            >
              {loading ? 'Szukam w wektorach...' : 'Wyciągnij informację'}
            </button>
          </form>
          {answer && (
            <div className="recordings-rag-answer" style={{ marginTop: 24, padding: 20, background: 'rgba(116, 208, 191, 0.08)', borderRadius: 12, border: '1px solid rgba(116, 208, 191, 0.2)', fontSize: '1.05rem', lineHeight: 1.6 }}>
              {answer}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

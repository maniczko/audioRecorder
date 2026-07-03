import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, X } from 'lucide-react';
import { VoiceBobrAssistant } from '../components/brand/VoiceBobrBrand';
import { createMediaService } from '../services/mediaService';
import { Input } from '../ui/Input';

export default function AskAIPopover({ currentWorkspace, onClose }) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [onClose]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !currentWorkspace?.id) return;
    setLoading(true);
    setAnswer('');
    try {
      const ms = await createMediaService();
      const res = await ms.askRAG(currentWorkspace.id, query);
      setAnswer(typeof res === 'string' ? res : res?.answer || 'Brak odpowiedzi');
    } catch (err) {
      setAnswer('Wystąpił błąd podczas przeszukiwania archiwalnych nagrań.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={popoverRef} className="ask-ai-comic-bubble" onClick={(e) => e.stopPropagation()}>
      <div className="comic-bubble-header">
        <VoiceBobrAssistant eyebrow="VoiceBóbr summary" title="Zapytaj o archiwum" />
        <button type="button" onClick={onClose} className="comic-close-btn">
          <X size={16} />
        </button>
      </div>
      <p
        style={{
          fontSize: '0.95rem',
          color: 'var(--modern-muted)',
          marginBottom: 20,
          lineHeight: 1.5,
        }}
      >
        Przeszukuj archiwalne spotkania, by przypomnieć sobie szczegóły lub dawne merytoryczne
        ustalenia.
      </p>

      <form onSubmit={handleSearch} style={{ position: 'relative', marginTop: 14 }}>
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            !currentWorkspace?.id
              ? 'Brak wybranej przestrzeni roboczej'
              : 'Szukaj kontekstu z każdego spotkania z twojej bazy danych...'
          }
          disabled={!currentWorkspace?.id}
          style={{
            fontSize: '0.95rem',
            padding: '16px 56px 16px 16px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.05)',
            border: '2px solid rgba(255,255,255,0.1)',
            color: '#fff',
            width: '100%',
            opacity: !currentWorkspace?.id ? 0.5 : 1,
            cursor: !currentWorkspace?.id ? 'not-allowed' : 'text',
          }}
          autoFocus={!!currentWorkspace?.id}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            bottom: 8,
            background: 'var(--accent)',
            color: '#03222a',
            border: 'none',
            borderRadius: 8,
            width: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !query.trim() ? 0.6 : 1,
            transition: 'transform 0.1s',
          }}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <ArrowRight size={18} strokeWidth={3} />
          )}
        </button>
      </form>

      {answer && (
        <div className="comic-answer-box" style={{ whiteSpace: 'pre-wrap' }}>
          {answer}
        </div>
      )}
    </div>
  );
}

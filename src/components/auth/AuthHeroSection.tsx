import { BrainCircuit, CalendarDays, Sparkles } from 'lucide-react';

function AuthLogoMark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 64 64" fill="none">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <g strokeWidth="3.8">
          <path d="M18 18c-3.5 0-6 2.8-6 6.2 0 3.1 2.2 5.7 5.2 6.1" />
          <path d="M46 18c3.5 0 6 2.8 6 6.2 0 3.1-2.2 5.7-5.2 6.1" />
          <path d="M20 45V35.5c0-8 5.8-14.5 12-14.5s12 6.5 12 14.5V45" />
          <path d="M22 29.5c1.9-4.6 5.8-8.6 10-8.6s8.1 4 10 8.6" />
          <path d="M27.3 35.8c1.3 2.5 3.1 3.8 4.7 3.8 1.6 0 3.4-1.3 4.7-3.8" />
          <path d="M32 29.8v7.7" />
          <path d="M28.7 40.2v4.9c0 1.4 1.1 2.5 2.5 2.5h1.6c1.4 0 2.5-1.1 2.5-2.5v-4.9" />
          <path d="M44.6 40.5c2.9.1 5.2-.9 7-2.7 2.4-2.4 3.4-5.8 3.4-9.6-4 1.3-6.6 3.4-8.3 6.1" />
          <path d="M22.2 43.8c-2.4-1.1-4.4-2.8-5.8-4.8" />
          <path d="M41.8 43.8c1.2-.6 2.3-1.3 3.3-2.1" />
          <path d="M23.4 17.5c2.5-2.3 5.4-4 8.6-4.9 3.3.9 6.2 2.6 8.7 4.9" />
          <path d="M29 16.5l3 2.1 3-2.1" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="24.5" cy="28.3" r="2.1" />
          <circle cx="39.5" cy="28.3" r="2.1" />
          <path d="M29 31.8c1.1-1.5 2-2.2 3-2.2s1.9.7 3 2.2c-.8 1.3-1.8 2-3 2s-2.2-.7-3-2Z" />
          <rect x="29.2" y="40.4" width="2.1" height="6.1" rx="1" />
          <rect x="32.7" y="40.4" width="2.1" height="6.1" rx="1" />
        </g>
        <g transform="rotate(24 21 49)" fill="none" stroke="currentColor">
          <path
            d="M18.4 44.6c0-2.1 1.7-3.8 3.8-3.8 2.1 0 3.8 1.7 3.8 3.8v5.8h-7.6v-5.8Z"
            strokeWidth="2.8"
          />
          <rect x="21" y="50.4" width="2.4" height="6.1" rx="1.2" strokeWidth="1.8" />
          <path d="M16.4 44.1c0-3.2 2.6-5.8 5.8-5.8s5.8 2.6 5.8 5.8" strokeWidth="2.8" />
          <path d="M17.8 43.2h8.8" strokeWidth="2.1" />
          <path d="M18.8 46.1h6.8" strokeWidth="2.1" />
        </g>
      </g>
    </svg>
  );
}

export default function AuthHeroSection() {
  return (
    <section className="auth-hero-section">
      <div className="auth-hero-content">
        <div className="auth-hero-branding">
          <AuthLogoMark />
          VoiceBĂłbr
        </div>
        <h1>WiÄ™cej niĹĽ bĂłbr.</h1>
        <p className="auth-hero-copy">
          Pracuj szybciej i inteligentniej. VoiceBĂłbr automatycznie grupuje wypowiedzi i dostarcza
          potrzebnych Ci kontekstĂłw ze spotkaĹ„ w czasie rzeczywistym.
        </p>

        <div className="auth-features-grid">
          <article className="auth-feature">
            <div className="auth-feature-icon">
              <Sparkles size={24} />
            </div>
            <div>
              <h3>Precyzyjna Diaryzacja</h3>
              <p>
                Nigdy wiÄ™cej pomyĹ‚ek. Segmenty grupujemy precyzyjnie po sygnaturze gĹ‚osu, a nie
                po samej ciszy w tle.
              </p>
            </div>
          </article>
          <article className="auth-feature">
            <div className="auth-feature-icon">
              <CalendarDays size={24} />
            </div>
            <div>
              <h3>Centrum SpotkaĹ„</h3>
              <p>
                MiesiÄ™czny widok zdarzeĹ„ wprost poĹ‚Ä…czony ze spotkaniami Google. Bez
                przeĹ‚Ä…czania miÄ™dzy systemami.
              </p>
            </div>
          </article>
          <article className="auth-feature">
            <div className="auth-feature-icon">
              <BrainCircuit size={24} />
            </div>
            <div>
              <h3>Insight Driven Analytics</h3>
              <p>
                Ustalasz cel przed wejĹ›ciem, a silnik LLM samodzielnie wyciÄ…gnie z rozmowy to,
                czego naprawdÄ™ szukaĹ‚eĹ›.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

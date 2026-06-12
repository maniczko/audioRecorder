import { CalendarDays, Sparkles } from 'lucide-react';
import { MascotAvatar, VoiceBobrLogo } from '../brand/VoiceBobrBrand';

export default function AuthHeroSection() {
  return (
    <section className="auth-hero-section">
      <div className="auth-hero-content">
        <div className="auth-hero-branding">
          <VoiceBobrLogo className="auth-voicebobr-lockup" />
        </div>
        <p className="auth-hero-guide">
          Hi, I&apos;m VoiceBóbr. I&apos;ll help organize your meetings.
        </p>
        <h1>Więcej niż transkrypcja.</h1>
        <p className="auth-hero-copy">
          VoiceBóbr automatycznie grupuje wypowiedzi, porządkuje kontekst i dostarcza wnioski ze
          spotkań wtedy, gdy są naprawdę potrzebne.
        </p>

        <div className="auth-features-grid">
          <article className="auth-feature">
            <div className="auth-feature-icon">
              <Sparkles size={24} />
            </div>
            <div>
              <h2>Precyzyjna diaryzacja</h2>
              <p>
                Segmenty rozmowy łączymy z właściwymi osobami, aby podsumowania i zadania miały
                prawdziwy kontekst.
              </p>
            </div>
          </article>
          <article className="auth-feature">
            <div className="auth-feature-icon">
              <CalendarDays size={24} />
            </div>
            <div>
              <h2>Centrum spotkań</h2>
              <p>
                Nagrania, kalendarz i zadania żyją w jednym przepływie, bez przełączania między
                narzędziami.
              </p>
            </div>
          </article>
          <article className="auth-feature">
            <div className="auth-feature-icon auth-feature-icon--mascot">
              <MascotAvatar size="xs" label="VoiceBóbr assistant" />
            </div>
            <div>
              <h2>Wnioski AI</h2>
              <p>
                VoiceBóbr wyciąga decyzje, ryzyka i follow-upy z rozmowy, zachowując ton przyjaznego
                asystenta.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

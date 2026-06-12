import type React from 'react';
import mascotSrc from '../../assets/brand/voicebobr-mascot.png';

type LogoVariant = 'full' | 'compact' | 'app-icon';
type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type EmptyContext = 'default' | 'meetings' | 'recordings' | 'tasks' | 'notes' | 'people';

interface VoiceBobrLogoProps {
  className?: string;
  variant?: LogoVariant;
  wordmark?: string;
}

interface MascotAvatarProps {
  className?: string;
  label?: string;
  muted?: boolean;
  size?: AvatarSize;
}

interface VoiceBobrEmptyStateProps {
  action?: React.ReactNode;
  className?: string;
  context?: EmptyContext;
  message?: string;
  title?: string;
}

interface VoiceBobrAssistantProps {
  children?: React.ReactNode;
  className?: string;
  eyebrow?: string;
  title?: string;
}

export const VOICEBOBR_BRAND_COLORS = {
  deepTeal: '#004640',
  mintTeal: '#70a0a0',
  softCyan: '#dff7f4',
  ink: '#102522',
} as const;

const emptyContextCopy: Record<EmptyContext, { title: string; message: string }> = {
  default: {
    title: 'Brak danych',
    message: 'VoiceBóbr pokaże tutaj wyniki, gdy pojawią się nowe informacje.',
  },
  meetings: {
    title: 'Brak aktywnego spotkania',
    message: 'Wybierz nagranie lub rozpocznij nowe spotkanie, a VoiceBóbr uporządkuje kontekst.',
  },
  recordings: {
    title: 'Brak nagrań',
    message: 'Nagraj rozmowę albo dodaj plik audio, aby rozpocząć transkrypcję.',
  },
  tasks: {
    title: 'Brak zadań na dziś',
    message: 'Dodaj zadanie ręcznie albo pozwól VoiceBóbr wyciągnąć je z nagrania.',
  },
  notes: {
    title: 'Brak notatek',
    message: 'Notatki i podsumowania AI pojawią się tutaj po analizie spotkania.',
  },
  people: {
    title: 'Brak osób',
    message: 'Dodaj uczestników, aby VoiceBóbr mógł budować kontekst rozmów.',
  },
};

export function MascotAvatar({
  className = '',
  label = 'VoiceBóbr',
  muted = false,
  size = 'md',
}: MascotAvatarProps) {
  return (
    <span
      className={`voicebobr-avatar voicebobr-avatar--${size}${muted ? ' voicebobr-avatar--muted' : ''} ${className}`.trim()}
      aria-label={label}
      role="img"
    >
      <img src={mascotSrc} alt="" aria-hidden="true" loading="eager" />
    </span>
  );
}

export function VoiceBobrLogo({
  className = '',
  variant = 'full',
  wordmark = 'VoiceBóbr',
}: VoiceBobrLogoProps) {
  const isCompact = variant === 'compact';
  const isIcon = variant === 'app-icon';

  return (
    <span
      className={`voicebobr-logo voicebobr-logo--${variant} ${className}`.trim()}
      aria-label={isCompact || isIcon ? wordmark : undefined}
    >
      <MascotAvatar size={isIcon ? 'lg' : 'sm'} label={wordmark} />
      {!isCompact && !isIcon ? <span className="voicebobr-wordmark">{wordmark}</span> : null}
    </span>
  );
}

export function VoiceBobrEmptyState({
  action,
  className = '',
  context = 'default',
  message,
  title,
}: VoiceBobrEmptyStateProps) {
  const copy = emptyContextCopy[context] || emptyContextCopy.default;

  return (
    <div className={`voicebobr-empty-state ${className}`.trim()}>
      <MascotAvatar size="xl" muted label="VoiceBóbr assistant" />
      <div className="voicebobr-empty-state__copy">
        <strong>{title || copy.title}</strong>
        {message || copy.message ? <p>{message || copy.message}</p> : null}
      </div>
      {action ? <div className="voicebobr-empty-state__action">{action}</div> : null}
    </div>
  );
}

export function VoiceBobrAssistant({
  children,
  className = '',
  eyebrow = 'VoiceBóbr suggests',
  title,
}: VoiceBobrAssistantProps) {
  return (
    <div className={`voicebobr-assistant ${className}`.trim()}>
      <MascotAvatar size="xs" label="VoiceBóbr assistant" />
      <div className="voicebobr-assistant__copy">
        <span>{eyebrow}</span>
        {title ? <strong>{title}</strong> : null}
        {children ? <div className="voicebobr-assistant__body">{children}</div> : null}
      </div>
    </div>
  );
}

export { mascotSrc as voiceBobrMascotSrc };

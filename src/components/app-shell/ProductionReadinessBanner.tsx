import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  fetchProductionCapabilities,
  fetchWorkspaceCapabilities,
  type CapabilityFlag,
  type ProductionCapabilities,
} from '../../services/capabilitiesService';
import { useWorkspaceSelectors } from '../../store/workspaceStore';

function reasonLabel(capability: CapabilityFlag) {
  switch (capability.id) {
    case 'meetingAnalysis':
      return 'Analiza AI wymaga konfiguracji albo dziala w trybie lokalnym.';
    case 'stt':
      return 'Transkrypcja moze wymagac konfiguracji providera mowy.';
    case 'diarization':
      return 'Wykrywanie mowcow moze dzialac w ograniczonym zakresie.';
    case 'supabaseStorage':
      return 'Magazyn audio wymaga konfiguracji zapisu produkcyjnego.';
    case 'liveTranscription':
      return 'Transkrypcja live zalezy od ustawien przegladarki i workspace.';
    case 'embeddings':
      return 'Wyszukiwanie semantyczne moze byc czasowo ograniczone.';
    case 'imageGeneration':
      return 'Generowanie obrazow wymaga konfiguracji providera.';
    default:
      return capability.fallbackMode
        ? 'Funkcja dziala w trybie ograniczonym.'
        : 'Funkcja wymaga konfiguracji produkcyjnej.';
  }
}

function capabilityToneLabel(capability: CapabilityFlag) {
  if (capability.fallbackMode) return 'Tryb fallback';
  if (capability.status === 'unavailable') return 'Wymaga konfiguracji';
  return 'Ograniczone';
}

export default function ProductionReadinessBanner() {
  const { currentWorkspaceId } = useWorkspaceSelectors();
  const [capabilities, setCapabilities] = useState<ProductionCapabilities | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const capabilityRequest = currentWorkspaceId
      ? fetchWorkspaceCapabilities(currentWorkspaceId)
      : fetchProductionCapabilities();

    capabilityRequest
      .then((payload) => {
        if (mounted) setCapabilities(payload);
      })
      .catch((error) => {
        console.warn('[capabilities] Failed to load production capability status.', error);
        if (mounted) setCapabilities(null);
      });

    return () => {
      mounted = false;
    };
  }, [currentWorkspaceId]);

  if (!capabilities || capabilities.ok || capabilities.degradedCapabilities.length === 0) {
    return null;
  }

  const visibleCapabilities = capabilities.degradedCapabilities.slice(0, 3);
  const hiddenCount = capabilities.degradedCapabilities.length - visibleCapabilities.length;
  const detailsId = 'production-readiness-banner-details';

  return (
    <section className="production-readiness-banner" role="status" aria-live="polite">
      <AlertTriangle size={18} aria-hidden="true" />
      <div className="production-readiness-banner-copy">
        <strong>Tryb ograniczony</strong>
        <span>
          Czesc funkcji dziala w trybie awaryjnym. Mozesz dalej pracowac, ale wyniki warto
          zweryfikowac.
        </span>
      </div>
      <div className="production-readiness-banner-summary" aria-label="Ograniczone funkcje">
        {visibleCapabilities.map((capability) => (
          <span key={capability.id}>{capability.label}</span>
        ))}
        {hiddenCount > 0 ? <span>+{hiddenCount}</span> : null}
      </div>
      <button
        type="button"
        className="production-readiness-banner-action"
        aria-expanded={detailsOpen}
        aria-controls={detailsId}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        {detailsOpen ? 'Ukryj' : 'Szczegoly'}
      </button>
      {detailsOpen ? (
        <ul
          id={detailsId}
          className="production-readiness-banner-list"
          aria-label="Szczegoly ograniczonych funkcji"
        >
          {capabilities.degradedCapabilities.map((capability) => (
            <li key={capability.id}>
              <span>{capability.label}</span>
              <small>
                {capabilityToneLabel(capability)}. {reasonLabel(capability)}
              </small>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

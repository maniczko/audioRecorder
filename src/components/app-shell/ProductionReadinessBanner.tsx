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
  return capability.reason || `${capability.label}: ${capability.status}`;
}

export default function ProductionReadinessBanner() {
  const { currentWorkspaceId } = useWorkspaceSelectors();
  const [capabilities, setCapabilities] = useState<ProductionCapabilities | null>(null);

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

  return (
    <section className="production-readiness-banner" role="status" aria-live="polite">
      <AlertTriangle size={18} aria-hidden="true" />
      <div className="production-readiness-banner-copy">
        <strong>Tryb ograniczony</strong>
        <span>
          Czesc funkcji produkcyjnych dziala w fallbacku albo wymaga konfiguracji providera.
        </span>
      </div>
      <ul className="production-readiness-banner-list" aria-label="Ograniczone funkcje">
        {visibleCapabilities.map((capability) => (
          <li key={capability.id}>
            <span>{capability.label}</span>
            <small>{reasonLabel(capability)}</small>
          </li>
        ))}
        {hiddenCount > 0 ? (
          <li>
            <span>Jeszcze {hiddenCount}</span>
            <small>Sprawdz /api/capabilities po pelny status.</small>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

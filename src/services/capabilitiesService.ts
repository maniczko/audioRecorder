import { apiRequest } from './httpClient';

export type CapabilityStatus = 'available' | 'degraded' | 'unavailable';
export type ProductionStatus = 'ready' | 'degraded';

export interface CapabilityFlag {
  id: string;
  label: string;
  enabled: boolean;
  status: CapabilityStatus;
  provider: string;
  reason?: string;
  fallbackMode?: boolean;
}

export interface ProductionCapabilities {
  ok: boolean;
  status: ProductionStatus;
  generatedAt?: string;
  capabilities: Record<string, CapabilityFlag>;
  degradedCapabilities: CapabilityFlag[];
  telemetry: {
    fallbackModeUsed: boolean;
    fallbackModeCapabilities: string[];
  };
}

export function fetchProductionCapabilities(): Promise<ProductionCapabilities> {
  return apiRequest('/api/capabilities', {
    method: 'GET',
    retries: 1,
  });
}

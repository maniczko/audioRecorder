import { apiRequest } from './httpClient';
import type { WorkspaceFeatureFlags } from '../shared/types';

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
  workspaceFeatureFlags?: WorkspaceFeatureFlags;
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

export function fetchWorkspaceCapabilities(workspaceId: string): Promise<ProductionCapabilities> {
  return apiRequest(`/workspaces/${encodeURIComponent(workspaceId)}/capabilities`, {
    method: 'GET',
    retries: 1,
  });
}

export function fetchWorkspaceFeatureFlags(
  workspaceId: string
): Promise<{ workspaceId: string; featureFlags: WorkspaceFeatureFlags }> {
  return apiRequest(`/workspaces/${encodeURIComponent(workspaceId)}/feature-flags`, {
    method: 'GET',
    retries: 1,
  });
}

export function updateWorkspaceFeatureFlags(
  workspaceId: string,
  featureFlags: Partial<WorkspaceFeatureFlags>
): Promise<{ featureFlags: WorkspaceFeatureFlags; state: unknown }> {
  return apiRequest(`/workspaces/${encodeURIComponent(workspaceId)}/feature-flags`, {
    method: 'PUT',
    body: { featureFlags },
  });
}

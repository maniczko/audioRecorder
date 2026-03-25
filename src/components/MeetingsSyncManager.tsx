import { ReactNode } from 'react';
import useWorkspaceData from '../hooks/useWorkspaceData';

export default function MeetingsSyncManager({ children }: { children?: ReactNode }) {
  useWorkspaceData();
  return <>{children}</>;
}

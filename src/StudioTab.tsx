import { Suspense, useEffect, useRef, useState } from 'react';
import StudioMeetingView from './studio/StudioMeetingView';
import { PageShell, SplitPane } from './ui/LayoutPrimitives';
import { StudioSkeleton } from './components/Skeleton';

export default function StudioTab(props) {
  const { defaultToNewStudio = false, startNewMeetingDraft } = props;

  const [briefOpen, setBriefOpen] = useState(false);
  const initializedDefaultStudioRef = useRef(false);

  useEffect(() => {
    if (!defaultToNewStudio || initializedDefaultStudioRef.current) return;
    initializedDefaultStudioRef.current = true;
    startNewMeetingDraft();
  }, [defaultToNewStudio, startNewMeetingDraft]);

  return (
    <PageShell className="studio-page-shell">
      <SplitPane
        className="studio-layout"
        sidebarWidth="wide"
        main={
          <main className="studio-tab-main">
            <Suspense fallback={<StudioSkeleton />}>
              <StudioMeetingView {...props} briefOpen={briefOpen} setBriefOpen={setBriefOpen} />
            </Suspense>
          </main>
        }
      />
    </PageShell>
  );
}

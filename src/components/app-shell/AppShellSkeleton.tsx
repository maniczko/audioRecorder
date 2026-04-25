import { SkeletonBanner, SkeletonList } from '../Skeleton';

export default function AppShellSkeleton() {
  return (
    <div className="app-shell-modern">
      <div className="modern-sidebar">
        <SkeletonBanner height={64} className="mb-5" />
        <SkeletonList items={5} lines={1} />
      </div>
      <div className="modern-main">
        <div className="modern-header">
          <SkeletonBanner height={32} className="w-30" />
          <SkeletonBanner height={32} className="w-50" />
        </div>
        <div className="modern-content-wrapper p-8">
          <SkeletonList items={3} lines={3} />
        </div>
      </div>
    </div>
  );
}

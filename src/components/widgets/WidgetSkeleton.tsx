interface WidgetSkeletonProps {
  className?: string;
}

export const WidgetSkeleton = ({ className = '' }: WidgetSkeletonProps) => (
  <div className={`surface-card p-6 ${className}`}>
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
      </div>
    </div>
  </div>
);



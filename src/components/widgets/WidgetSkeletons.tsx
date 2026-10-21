// Skeletons específicos para cada tipo de widget

export const TrendsForecastSkeleton = () => (
  <div className="surface-card p-6">
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
      <div className="h-[250px] sm:h-[300px] bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  </div>
);

export const CreditCardsSkeleton = () => (
  <>
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4 animate-pulse"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="surface-card p-5 border-l-4 border-line">
          <div className="animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div className="ml-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </>
);

export const SavingsGoalsSkeleton = () => (
  <>
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border border-line rounded-lg p-4 bg-surface-elevated">
          <div className="animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-1"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
          </div>
        </div>
      ))}
    </div>
  </>
);

export const ChartSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
    <div className="h-[300px] bg-gray-200 dark:bg-gray-700 rounded"></div>
  </div>
);

export const ProjectedBalanceSkeleton = () => (
  <div className="surface-card p-6 border-2 border-line">
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4"></div>
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-3"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
    </div>
  </div>
);

export const CategoryChartSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
    <div className="h-[250px] sm:h-[300px] bg-gray-200 dark:bg-gray-700 rounded"></div>
  </div>
);


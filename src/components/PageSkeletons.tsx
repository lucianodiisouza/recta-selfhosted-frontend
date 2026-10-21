// Skeletons específicos para cada página

export const TransactionsSkeleton = () => (
  <div className="px-4 sm:px-6 lg:px-8">
    <div className="mb-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
    </div>
    
    {/* Filtros skeleton */}
    <div className="surface-card p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>
    </div>

    {/* Lista de transações skeleton */}
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="surface-card overflow-hidden">
          <div className="px-4 sm:px-6 py-3 bg-surface-sunken">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
          </div>
          <ul className="divide-y divide-line-subtle">
            {[1, 2].map((j) => (
              <li key={j} className="px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
);

export const BudgetsSkeleton = () => (
  <div className="px-4 sm:px-6 lg:px-8">
    <div className="mb-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
    </div>

    {/* Lista de orçamentos skeleton */}
    <div className="bg-surface-elevated shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-line-subtle">
        {[1, 2, 3].map((i) => (
          <li key={i} className="px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full w-full"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export const AccountsSkeleton = () => (
  <div className="px-4 sm:px-6 lg:px-8 space-y-6 animate-pulse">
    {/* Header skeleton */}
    <div className="mb-6">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
    </div>

    {/* Seletor de contas skeleton */}
    <div className="flex overflow-x-auto pb-2 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex-shrink-0 w-[200px] bg-surface-elevated border-2 border-line rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg mr-3"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-1"></div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Resumo consolidado skeleton */}
    <div className="surface-card p-6">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
    </div>

    {/* Grid com card lateral e lista de transações skeleton */}
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Card lateral skeleton */}
      <div className="space-y-6 order-1 xl:order-2">
        <div className="bg-surface-elevated rounded-lg shadow border border-line p-6">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-6"></div>
          <div className="space-y-6">
            <div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-line-subtle">
              <div className="p-4 rounded-lg bg-surface-sunken">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              </div>
              <div className="p-4 rounded-lg bg-surface-sunken">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de transações skeleton */}
      <div className="xl:col-span-2 space-y-6 order-2 xl:order-1">
        <div className="bg-surface-elevated rounded-lg shadow border border-line overflow-hidden">
          <div className="p-6 border-b border-line">
            <div className="flex items-center gap-4">
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const SavingsGoalsSkeleton = () => (
  <div className="px-4 sm:px-6 lg:px-8">
    <div className="mb-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
    </div>

    {/* Grid de metas skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="surface-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded mr-2"></div>
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const RecurringTransactionsSkeleton = () => (
  <div className="px-4 sm:px-6 lg:px-8">
    <div className="mb-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
    </div>

    {/* Lista de transações recorrentes skeleton */}
    <div className="bg-surface-elevated shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-line-subtle">
        {[1, 2, 3, 4].map((i) => (
          <li key={i} className="px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export const ReportsSkeleton = () => (
  <div className="px-4 sm:px-6 lg:px-8">
    <div className="mb-6 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
    </div>

    {/* Filtros skeleton */}
    <div className="surface-card p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>
    </div>

    {/* Resumo skeleton */}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-surface-elevated overflow-hidden shadow rounded-lg p-5">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      ))}
    </div>

    {/* Gráficos skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
      {[1, 2].map((i) => (
        <div key={i} className="surface-card p-6">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-[300px] bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      ))}
    </div>

    {/* Tabela skeleton */}
    <div className="surface-card overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line-subtle">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {[1, 2, 3, 4].map((i) => (
                <th key={i} className="px-6 py-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface-elevated divide-y divide-line-subtle">
            {[1, 2, 3].map((i) => (
              <tr key={i}>
                {[1, 2, 3, 4].map((j) => (
                  <td key={j} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);









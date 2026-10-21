import { useI18n } from '../../context/I18nContext';
import { AlertCircle } from 'lucide-react';
import { BudgetAlert } from '../../hooks/useBudgetAlerts';

interface BudgetAlertsProps {
  budgetAlerts: BudgetAlert[];
  blurNumbers?: boolean;
}

export const BudgetAlerts = ({ budgetAlerts, blurNumbers = false }: BudgetAlertsProps) => {
  const { t } = useI18n();

  if (budgetAlerts.length === 0) {
    return null;
  }

  const exceededCount = budgetAlerts.filter(a => a.status === 'exceeded').length;

  return (
    <div className={`mb-4 sm:mb-6 border-l-4 p-3 sm:p-4 rounded-lg ${
      exceededCount > 0 
        ? 'bg-negative-soft border-red-400 dark:border-red-600' 
        : 'bg-warning/10 border-yellow-400 dark:border-yellow-600'
    }`}>
      <div className="flex items-start gap-2 sm:gap-3">
        <AlertCircle className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 mt-0.5 ${
          exceededCount > 0 
            ? 'text-negative' 
            : 'text-warning'
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className={`text-xs sm:text-sm font-rounded font-semibold tabular-nums ${
              exceededCount > 0 
                ? 'text-red-800 dark:text-red-300' 
                : 'text-yellow-800 dark:text-yellow-300'
            }`}>
              {t.budgetAlerts}
            </h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              exceededCount > 0
                ? 'bg-negative-soft text-red-800 dark:text-red-300'
                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
            }`}>
              {budgetAlerts.length} {budgetAlerts.length === 1 ? t.alert : t.alerts}
            </span>
          </div>
          <div className={`space-y-2 ${
            exceededCount > 0 
              ? 'text-red-700 dark:text-red-300' 
              : 'text-yellow-700 dark:text-yellow-300'
          } ${blurNumbers ? 'demo-blur' : ''}`}>
            {budgetAlerts.map((alert, idx) => (
              <div key={idx} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-2 rounded ${
                alert.status === 'exceeded' 
                  ? 'bg-red-100/50 dark:bg-red-900/20' 
                  : 'bg-yellow-100/50 dark:bg-yellow-900/20'
              }`}>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs sm:text-sm ${alert.status === 'exceeded' ? 'font-medium' : 'font-light'} break-words`}>
                    {alert.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:ml-3 flex-shrink-0">
                  <span className="text-xs sm:text-sm font-light whitespace-nowrap">
                    {alert.percentage.toFixed(1)}% {t.used}
                  </span>
                  {alert.status === 'exceeded' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-600 text-white whitespace-nowrap">
                      {t.budgetExceeded}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};



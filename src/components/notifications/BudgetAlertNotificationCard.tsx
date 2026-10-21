import { AlertCircle, TrendingUp } from 'lucide-react';
import type { Notification } from '../../hooks/api/useNotifications';

interface BudgetAlertNotificationCardProps {
  notification: Notification;
  percentage: number | undefined;
  isOverBudget: boolean;
  isClickable: boolean;
  onNotificationClick: (e: React.MouseEvent) => void;
}

export const BudgetAlertNotificationCard = ({
  notification,
  percentage,
  isOverBudget,
  isClickable,
  onNotificationClick,
}: BudgetAlertNotificationCardProps) => {
  return (
    <div
      onClick={isClickable ? onNotificationClick : undefined}
      className={`p-3 rounded-lg border mb-2 transition-colors ${isClickable ? 'cursor-pointer' : 'cursor-default opacity-75'} ${
        isOverBudget
          ? 'bg-negative-soft border-negative/25 hover:bg-red-100 dark:hover:bg-red-900/30'
          : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30'
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          isOverBudget
            ? 'bg-negative-soft'
            : 'bg-orange-100 dark:bg-orange-900/30'
        }`}>
          {isOverBudget ? (
            <AlertCircle className="h-5 w-5 text-negative" />
          ) : (
            <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-content truncate">
            {notification.title}
          </p>
          <p className="text-xs text-content-tertiary mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          {percentage !== undefined && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-content-secondary">Progresso</span>
                <span className={`font-medium ${
                  isOverBudget
                    ? 'text-negative'
                    : percentage >= 75
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-content-secondary'
                }`}>
                  {percentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    isOverBudget
                      ? 'bg-red-500'
                      : percentage >= 75
                      ? 'bg-orange-500'
                      : 'bg-primary-500'
                  }`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

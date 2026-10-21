import type React from 'react';
import { CalendarClock, type LucideIcon } from 'lucide-react';
import type { RecurringProjection } from '../../hooks/api/useRecurringTransactions';
import { getCategoryColor, getCategoryDisplayName, type CustomCategoryInfo } from '../../lib/enums';
import { Badge, IconBadge, MoneyText } from '../ui';

interface ProjectedTransactionItemProps {
  projection: RecurringProjection;
  accounts: Array<{ id?: string; name: string; type?: string }>;
  baseCurrency: string;
  customCategories?: Array<{ id: string; name: string; icon?: string | null }>;
  getCategoryIcon: (categoryName: string | undefined, customCategories?: Array<{ id: string; name: string; icon?: string | null }>) => React.ComponentType<any>;
  onOpen: (projection: RecurringProjection) => void;
  t: Record<string, string>;
}

/**
 * A projected occurrence of a recurring transaction (fdbk #116): same layout as TransactionItem,
 * but faded, tagged "Projected", amount in the secondary color and no selection or actions menu.
 * It never counts in any total.
 */
export const ProjectedTransactionItem = ({
  projection,
  accounts,
  baseCurrency,
  customCategories,
  getCategoryIcon,
  onOpen,
  t,
}: ProjectedTransactionItemProps) => {
  const IconComponent = getCategoryIcon(projection.categoryName, customCategories);
  const color = getCategoryColor(projection.categoryName || '', customCategories as CustomCategoryInfo[] | undefined);
  const categoryDisplay = getCategoryDisplayName(projection.categoryName, t, customCategories);
  const accountName = projection.account?.name ?? accounts.find((a) => a.id === projection.accountId)?.name;
  const title = projection.description || t.noDescription || '';
  const signedAmount = projection.type === 'INCOME' ? projection.amount : -projection.amount;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(projection)}
        className="flex w-full items-center gap-3 px-4 py-3 min-h-[64px] text-start transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:bg-surface-sunken"
      >
        <IconBadge icon={IconComponent as LucideIcon} color={color} className="opacity-50" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="truncate text-[15px] font-medium text-content-secondary">{title}</p>
            <Badge tone="info" icon={CalendarClock}>{t.projected}</Badge>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-content-tertiary">
            {[accountName, categoryDisplay].filter(Boolean).join(' · ')}
          </p>
        </div>
        <MoneyText value={signedAmount} currency={baseCurrency} sign="always" tone="neutral" className="shrink-0 text-content-secondary" />
      </button>
    </li>
  );
};

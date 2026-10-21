import { Transaction } from '../../types';
import { formatDate, parseDateFromAPI } from '../../utils/format';
import { TransactionItem } from './TransactionItem';
import { ProjectedTransactionItem } from './ProjectedTransactionItem';
import type { RecurringProjection } from '../../hooks/api/useRecurringTransactions';
import { useEffect, useRef } from 'react';
import type React from 'react';
import { Inbox } from 'lucide-react';
import { TransactionType } from '../../lib/enums';
import { EmptyState, MoneyText } from '../ui';

interface TransactionListProps {
  groupedTransactions: Array<{
    dateKey: string;
    date: Date;
    transactions: Transaction[];
    /** Projected recurring occurrences of the day (fdbk #116); display only, never in totals. */
    projections?: RecurringProjection[];
  }>;
  onOpenProjection?: (projection: RecurringProjection) => void;
  accounts: Array<{ id?: string; name: string; type?: string }>;
  baseCurrency: string;
  customCategories?: Array<{ id: string; name: string; icon?: string | null }>;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string, paid: boolean) => Promise<void>;
  onView: (transaction: Transaction) => void;
  formatTransactionDescription: (transaction: Transaction) => string;
  getCategoryIcon: (categoryName: string | undefined, customCategories?: Array<{ id: string; name: string; icon?: string | null }>) => React.ComponentType<any>;
  isTransactionSharedAndUserParticipated: (transaction: Transaction) => boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  totalCount?: number;
  currentCount: number;
  onLoadMore: () => Promise<void>;
  t: Record<string, string>;
}

const formatDateHeader = (date: Date | string): string => {
  const d = date instanceof Date ? date : (typeof date === 'string' ? parseDateFromAPI(date) : new Date());
  
  if (isNaN(d.getTime())) {
    return '';
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateToCompare = new Date(d);
  dateToCompare.setHours(0, 0, 0, 0);

  if (dateToCompare.getTime() === today.getTime()) {
    return 'Hoje';
  } else if (dateToCompare.getTime() === yesterday.getTime()) {
    return 'Ontem';
  } else {
    return formatDate(d);
  }
};

/** Income minus expenses of a day; transfers and allocations don't count. */
const dayNet = (transactions: Transaction[]): number =>
  transactions.reduce((sum, tx) => {
    if (tx.type === TransactionType.INCOME) return sum + Math.abs(tx.amount || 0);
    if (tx.type === TransactionType.EXPENSE) return sum - Math.abs(tx.amount || 0);
    return sum;
  }, 0);

export const TransactionList = ({
  groupedTransactions,
  accounts,
  baseCurrency,
  customCategories,
  onEdit,
  onDelete,
  onMarkAsPaid,
  onView,
  formatTransactionDescription,
  getCategoryIcon,
  isTransactionSharedAndUserParticipated,
  hasMore,
  isLoadingMore,
  totalCount,
  currentCount,
  onLoadMore,
  onOpenProjection,
  t,
}: TransactionListProps) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite scroll com Intersection Observer
  useEffect(() => {
    // Não criar observer se não há mais dados ou se já está carregando
    if (!hasMore || isLoadingMore) {
      return;
    }

    const currentRef = loadMoreRef.current;
    if (!currentRef) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        // Só carregar mais se estiver visível e não estiver já carregando
        if (entry.isIntersecting && !isLoadingMore && hasMore) {
          onLoadMore();
        }
      },
      {
        rootMargin: '200px', // Carrega quando está a 200px do fim
        threshold: 0.1,
      }
    );

    observer.observe(currentRef);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (groupedTransactions.length === 0) {
    return (
      <div className="surface-card">
        <EmptyState icon={Inbox} title={t.noResults || `${t.transactions} ${t.none}`} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groupedTransactions.map((group) => (
        <section key={group.dateKey} aria-label={formatDateHeader(group.date)}>
          {/* Cabeçalho da data com o saldo do dia, como no app */}
          <div className="flex items-baseline justify-between px-1 mb-2">
            <h3 className="text-[13px] font-semibold text-content-secondary">
              {formatDateHeader(group.date)}
            </h3>
            {/* Day net of real rows only; a day with just projections shows no total */}
            {group.transactions.length > 0 && (
              <MoneyText value={dayNet(group.transactions)} currency={baseCurrency} sign="always" tone="semantic" size="sm" className="!text-[13px]" />
            )}
          </div>
          {/* Lista de transações do dia */}
          <ul className="surface-card overflow-hidden divide-y divide-line-subtle">
            {group.transactions.map((transaction) => (
              <TransactionItem
                key={transaction.id}
                transaction={transaction}
                accounts={accounts}
                baseCurrency={baseCurrency}
                customCategories={customCategories}
                onEdit={onEdit}
                onDelete={onDelete}
                onMarkAsPaid={onMarkAsPaid}
                onView={onView}
                formatTransactionDescription={formatTransactionDescription}
                getCategoryIcon={getCategoryIcon}
                readOnly={isTransactionSharedAndUserParticipated(transaction)}
                t={t}
              />
            ))}
            {group.projections?.map((projection) => (
              <ProjectedTransactionItem
                key={projection.id}
                projection={projection}
                accounts={accounts}
                baseCurrency={baseCurrency}
                customCategories={customCategories}
                getCategoryIcon={getCategoryIcon}
                onOpen={(p) => onOpenProjection?.(p)}
                t={t}
              />
            ))}
          </ul>
        </section>
      ))}
      
      {/* Sentinel para infinite scroll */}
      {hasMore && (
        <div 
          ref={loadMoreRef} 
          className="py-8 text-center"
          data-testid="load-more-sentinel"
        >
          {isLoadingMore && (
            <div className="text-sm text-content-tertiary">
              {t.loading || 'Carregando...'}
            </div>
          )}
          {totalCount && (
            <p className="mt-2 text-sm text-content-tertiary">
              Mostrando {currentCount} de {totalCount} transações
            </p>
          )}
          {!isLoadingMore && (
            <p className="mt-2 text-xs text-content-tertiary">
              Scroll para carregar mais...
            </p>
          )}
        </div>
      )}
      
      {/* Mensagem quando não há mais transações */}
      {!hasMore && totalCount && currentCount > 0 && (
        <div className="py-6 text-center">
          <p className="text-sm text-content-tertiary">
            Todas as {totalCount} transações foram carregadas
          </p>
        </div>
      )}
    </div>
  );
};

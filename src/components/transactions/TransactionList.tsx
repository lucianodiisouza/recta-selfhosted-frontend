import { Transaction } from '../../types';
import { formatDate, parseDateFromAPI } from '../../utils/format';
import { TransactionItem } from './TransactionItem';
import { useEffect, useRef } from 'react';
import type React from 'react';

interface TransactionListProps {
  groupedTransactions: Array<{
    dateKey: string;
    date: Date;
    transactions: Transaction[];
  }>;
  accounts: Array<{ id?: string; name: string; type?: string }>;
  baseCurrency: string;
  customCategories?: Array<{ id: string; name: string; icon?: string | null }>;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string, paid: boolean) => Promise<void>;
  onView: (transaction: Transaction) => void;
  onSplitShares?: (transaction: Transaction) => void;
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

export const TransactionList = ({
  groupedTransactions,
  accounts,
  baseCurrency,
  customCategories,
  onEdit,
  onDelete,
  onMarkAsPaid,
  onView,
  onSplitShares,
  formatTransactionDescription,
  getCategoryIcon,
  isTransactionSharedAndUserParticipated,
  hasMore,
  isLoadingMore,
  totalCount,
  currentCount,
  onLoadMore,
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
      <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md">
        {t.noResults || `${t.transactions} ${t.none}`}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedTransactions.map((group) => (
        <div key={group.dateKey} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md overflow-hidden mb-4">
          {/* Cabeçalho da data */}
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 bg-white dark:bg-gray-900">
            <h3 className="text-sm font-light tracking-tight text-gray-500 dark:text-gray-400">
              {formatDateHeader(group.date)}
            </h3>
          </div>
          {/* Lista de transações do dia */}
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
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
                onSplitShares={onSplitShares}
                formatTransactionDescription={formatTransactionDescription}
                getCategoryIcon={getCategoryIcon}
                readOnly={isTransactionSharedAndUserParticipated(transaction)}
                t={t}
              />
            ))}
          </ul>
        </div>
      ))}
      
      {/* Sentinel para infinite scroll */}
      {hasMore && (
        <div 
          ref={loadMoreRef} 
          className="py-8 text-center"
          data-testid="load-more-sentinel"
        >
          {isLoadingMore && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t.loading || 'Carregando...'}
            </div>
          )}
          {totalCount && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Mostrando {currentCount} de {totalCount} transações
            </p>
          )}
          {!isLoadingMore && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Scroll para carregar mais...
            </p>
          )}
        </div>
      )}
      
      {/* Mensagem quando não há mais transações */}
      {!hasMore && totalCount && currentCount > 0 && (
        <div className="py-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Todas as {totalCount} transações foram carregadas
          </p>
        </div>
      )}
    </div>
  );
};

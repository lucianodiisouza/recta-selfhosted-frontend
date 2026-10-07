import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransactions } from '../context/TransactionsContext';
import { useToastContext } from '../context/ToastContext';
import { useCommandMenu } from '../context/CommandMenuContext';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import { formatCurrency, formatDate } from '../utils/format';
import { parseCurrencyValue } from '../utils/currency';
import { Plus, Info, X, Repeat } from 'lucide-react';
import DetectRecurringDialog from '../components/DetectRecurringDialog';
import ConfirmModal from '../components/ConfirmModal';
import { RecurringTransactionsActionsMenu } from '../components/RecurringTransactionsActionsMenu';
import { RecurringTransaction } from '../types';
import { createSchemas, RecurringTransactionFormData } from '../schemas';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import CategoryCombobox from '../components/CategoryCombobox';
import SelectCombobox from '../components/SelectCombobox';
import { PageHeader } from '../components/PageHeader';
import { PageButton } from '../components/PageButton';
import { RecurringTransactionsSkeleton } from '../components/PageSkeletons';
import { CategoryType, getCategoriesByType, getCategoryNameFromDisplay, AccountType, TransactionType, CategoryName, RecurrenceFrequency } from '../lib/enums';
import { DatePicker } from '../components/DatePicker';

const RecurringTransactions = () => {
  const { householdId, household } = useDefaultHousehold();
  // Creating recurrences needs EDITOR or more; a viewer only reads. A household that is not known yet counts as no.
  const canWrite = !!household && household.role !== 'VIEWER';
  const [isDetectOpen, setIsDetectOpen] = useState<boolean>(false);
  // Set when the server answers that it has no detection route: the entry point then goes away.
  const [detectUnavailable, setDetectUnavailable] = useState<boolean>(false);
  const { 
    recurringTransactions, 
    accounts,
    addRecurringTransaction, 
    updateRecurringTransaction, 
    deleteRecurringTransaction,
    loading 
  } = useTransactions();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();
  const { success, error: showError } = useToastContext();
  const { recurringTransactionSchema } = createSchemas(t);
  const { registerHandler, unregisterHandler } = useCommandMenu();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; recurringId: string | null }>({
    isOpen: false,
    recurringId: null,
  });
  const [togglingRecurringId, setTogglingRecurringId] = useState<string | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const currencyMask = useCurrencyMask();
  // The follow-last-value toggle is offered only when the server reports the field (or there is nothing to learn from yet).
  const followSupported = recurringTransactions.length === 0 || recurringTransactions.some((r) => r.followLastAmount !== undefined);

  // Verificar se o usuário já viu o modal de ajuda
  useEffect(() => {
    const hasSeenHelp = localStorage.getItem('recurringTransactionsHelpSeen');
    if (!hasSeenHelp) {
      setIsHelpModalOpen(true);
    }
  }, []);

  const handleCloseHelpModal = () => {
    setIsHelpModalOpen(false);
    localStorage.setItem('recurringTransactionsHelpSeen', 'true');
  };

  useEffect(() => {
    registerHandler('newRecurring', () => {
      setEditingRecurring(null);
      setIsModalOpen(true);
    });
    return () => {
      unregisterHandler('newRecurring');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler para fechar modais com ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) {
          setIsModalOpen(false);
          setEditingRecurring(null);
        }
        if (isHelpModalOpen) {
          handleCloseHelpModal();
        }
      }
    };
    if (isModalOpen || isHelpModalOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isModalOpen, isHelpModalOpen]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<RecurringTransactionFormData>({
    resolver: zodResolver(recurringTransactionSchema),
    defaultValues: {
      description: '',
      amount: 0,
      type: TransactionType.EXPENSE,
      category: '',
      frequency: RecurrenceFrequency.MONTHLY,
      startDate: new Date(),
      endDate: undefined,
      nextDueDate: new Date(),
      accountId: '',
      isActive: true,
      followLastAmount: false,
    },
  });

  useEffect(() => {
    if (editingRecurring) {
      reset({
        description: editingRecurring.description,
        amount: editingRecurring.amount || 0,
        type: editingRecurring.type,
        category: editingRecurring.categoryName ?? editingRecurring.category,
        frequency: editingRecurring.frequency.toUpperCase() as RecurrenceFrequency,
        startDate: editingRecurring.startDate instanceof Date ? editingRecurring.startDate : new Date(editingRecurring.startDate),
        endDate: editingRecurring.endDate ? (editingRecurring.endDate instanceof Date ? editingRecurring.endDate : new Date(editingRecurring.endDate)) : undefined,
        nextDueDate: editingRecurring.nextDueDate instanceof Date ? editingRecurring.nextDueDate : new Date(editingRecurring.nextDueDate),
        accountId: editingRecurring.accountId || '',
        isActive: editingRecurring.isActive,
        followLastAmount: editingRecurring.followLastAmount === true,
      });
      currencyMask.setValue(editingRecurring.amount || 0);
      setValue('amount', editingRecurring.amount || 0);
    } else {
      reset({
        description: '',
        amount: 0,
        type: TransactionType.EXPENSE,
        category: '',
        frequency: RecurrenceFrequency.MONTHLY,
        startDate: new Date(),
        endDate: undefined,
        nextDueDate: new Date(),
        accountId: '',
        isActive: true,
        followLastAmount: false,
      });
      currencyMask.setValue('');
      setValue('amount', 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRecurring?.id, reset, setValue]);

  // Limpar categoria quando o tipo mudar para evitar incompatibilidade
  const currentType = watch('type');
  useEffect(() => {
    if (isModalOpen && currentType) {
      const currentCategory = watch('category');
      if (currentCategory) {
        // Verificar se a categoria atual é compatível com o tipo
        const categoryType = currentType === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
        const categoryName = getCategoryNameFromDisplay(currentCategory, t as unknown as Record<string, string>);
        if (categoryName) {
          const validCategories = getCategoriesByType(categoryType);
          if (!validCategories.includes(categoryName as CategoryName)) {
            // Categoria incompatível, limpar
            setValue('category', '', { shouldValidate: false });
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentType, isModalOpen]);

  // Prevenir scroll do body quando modais estiverem abertos
  useEffect(() => {
    if (isModalOpen || isHelpModalOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isModalOpen, isHelpModalOpen]);

  const onSubmit = async (data: RecurringTransactionFormData) => {
    try {
      const recurringData: Omit<RecurringTransaction, 'id' | 'userId'> = {
        description: data.description,
        amount: data.amount,
        type: data.type,
        category: data.category,
        frequency: (typeof data.frequency === 'string' 
          ? data.frequency 
          : (data.frequency as unknown as string).toLowerCase()) as 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly',
        startDate: data.startDate,
        endDate: data.endDate,
        nextDueDate: data.nextDueDate,
        accountId: data.accountId || undefined,
        isActive: data.isActive,
        followLastAmount: data.followLastAmount === true,
      };

      if (editingRecurring?.id) {
        await updateRecurringTransaction(editingRecurring.id, recurringData);
        success(t.recurringUpdated);
      } else {
        await addRecurringTransaction(recurringData);
        success(t.recurringCreated);
      }
      setIsModalOpen(false);
      setEditingRecurring(null);
      currencyMask.setValue('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t.error;
      showError(errorMessage);
    }
  };

  const deleteOperation = useAsyncOperation(
    async (id: string) => {
      await deleteRecurringTransaction(id);
    },
    {
      onSuccess: () => {
        success(t.recurringDeleted);
      },
      errorMessage: t.error,
    }
  );

  const toggleActiveOperation = useAsyncOperation(
    async (id: string, isActive: boolean) => {
      await updateRecurringTransaction(id, { isActive });
    },
    {
      onSuccess: () => {
        success(t.recurringUpdated);
      },
      errorMessage: t.error,
    }
  );


  const handleDelete = (id: string) => {
    setConfirmModal({ isOpen: true, recurringId: id });
  };

  const handleConfirmDelete = async () => {
    if (confirmModal.recurringId) {
      await deleteOperation.execute(confirmModal.recurringId);
      setConfirmModal({ isOpen: false, recurringId: null });
    }
  };

  const handleToggleActive = async (recurring: RecurringTransaction) => {
    if (!recurring.id) return;
    
    setTogglingRecurringId(recurring.id);
    try {
      await toggleActiveOperation.execute(recurring.id, !recurring.isActive);
    } finally {
      setTogglingRecurringId(null);
    }
  };


  if (loading) {
    return <RecurringTransactionsSkeleton />;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 dashboard-fade-in">
      <PageHeader
        title={t.recurring}
        description={
          <span>
            {t.recurringDescription}
            {' '}
            <button
              onClick={() => setIsHelpModalOpen(true)}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-500 hover:opacity-70 transition-opacity text-xs font-light"
              aria-label={t.recurringHelperTitle}
            >
              ?
            </button>
          </span>
        }
      >
        {canWrite && !detectUnavailable && (
          <PageButton
            onClick={() => setIsDetectOpen(true)}
            variant="secondary"
            icon={Repeat}
          >
            {t.detectRecButton}
          </PageButton>
        )}
        <PageButton
          onClick={() => {
            setEditingRecurring(null);
            setIsModalOpen(true);
          }}
          variant="primary"
          icon={Plus}
          aria-label={t.newRecurring}
        >
          {t.newRecurring}
        </PageButton>
      </PageHeader>

      {/* Lista de transações recorrentes */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden sm:rounded-md">
        {recurringTransactions.length === 0 ? (
          <div className="px-6 py-8 text-center font-light text-gray-500 dark:text-gray-400">
            {t.recurring} {t.none}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {recurringTransactions.map((recurring) => (
              <li key={recurring.id} className="px-4 sm:px-6 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base sm:text-lg font-light tracking-tight text-gray-900 dark:text-white">{recurring.description}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-light border ${
                        recurring.type === TransactionType.INCOME
                          ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400'
                          : 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
                      }`}>
                        {recurring.type === TransactionType.INCOME ? t.income : t.expense}
                      </span>
                      {!recurring.isActive && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-light border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                          {t.pause}
                        </span>
                      )}
                      {recurring.followLastAmount && (
                        <span
                          title={t.recurringFollowHelp}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-light border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                        >
                          {t.recurringFollowBadge}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-light text-gray-500 dark:text-gray-400">
                      <span>{formatCurrency(recurring.amount, baseCurrency)}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{recurring.category}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>
                        {recurring.frequency === 'daily' ? t.daily :
                         recurring.frequency === 'weekly' ? t.weekly :
                         recurring.frequency === 'biweekly' ? t.biweekly :
                         recurring.frequency === 'monthly' ? t.monthly : t.yearly}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span>{t.next} {formatDate(recurring.nextDueDate)}</span>
                    </div>
                  </div>
                  <RecurringTransactionsActionsMenu
                    recurring={recurring}
                    onEdit={(recurring) => {
                      setEditingRecurring(recurring);
                      setIsModalOpen(true);
                    }}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                    isToggling={togglingRecurringId === recurring.id || toggleActiveOperation.loading}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal de Ajuda */}
      {isHelpModalOpen && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out" onClick={handleCloseHelpModal} aria-hidden="true" />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full sm:w-96 max-w-md p-4 sm:p-5 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto animate-slide-in-bottom">
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <h3 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">
                  {t.recurringHelperTitle}
                </h3>
              </div>
              <button
                onClick={handleCloseHelpModal}
                className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1"
                aria-label={t.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2 text-sm font-light text-gray-600 dark:text-gray-400 leading-relaxed">
                {t.recurringHelperText.split('. ').filter(sentence => sentence.trim()).map((sentence, index, array) => {
                  const trimmedSentence = sentence.trim();
                  // Adicionar ponto final se não tiver (exceto no último item se já tiver)
                  const finalSentence = trimmedSentence.endsWith('.') 
                    ? trimmedSentence 
                    : `${trimmedSentence}${index < array.length - 1 ? '.' : ''}`;
                  return (
                    <p key={index}>
                      {finalSentence}
                    </p>
                  );
                })}
              </div>
              <button
                onClick={handleCloseHelpModal}
                className="w-full px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
        </div>,
        document.body
      )}

      {/* Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out" 
            onClick={() => setIsModalOpen(false)} 
            aria-hidden="true"
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full sm:w-96 max-w-md p-4 sm:p-5 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto min-w-0 animate-slide-in-bottom">
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">
                {editingRecurring ? t.editRecurring : t.newRecurring}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingRecurring(null);
                }}
                className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 min-w-0">
              <div>
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.type}
                </label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <SelectCombobox
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      options={[
                        { value: TransactionType.INCOME, label: t.income },
                        { value: TransactionType.EXPENSE, label: t.expense },
                      ]}
                      placeholder={t.selectType}
                    />
                  )}
                />
                {errors.type && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.type.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.description}
                </label>
                <input
                  type="text"
                  {...register('description')}
                  className={`block w-full px-3 py-2.5 border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 sm:text-sm font-light tracking-tight ${
                    errors.description ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
                  }`}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.amount}
                </label>
                <input
                  type="text"
                  value={currencyMask.value}
                  onChange={(e) => {
                    currencyMask.onChange(e);
                    const numericValue = parseCurrencyValue(e.target.value);
                    setValue('amount', numericValue, { shouldValidate: true });
                  }}
                  placeholder={t.currencyPlaceholder}
                  className={`block w-full px-3 py-2.5 border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 sm:text-sm font-light tracking-tight ${
                    errors.amount ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
                  }`}
                />
                <input
                  type="hidden"
                  {...register('amount', {
                    valueAsNumber: true,
                  })}
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.category}
                </label>
                <CategoryCombobox
                  value={watch('category') || ''}
                  onValueChange={(value) => setValue('category', value, { shouldValidate: true, shouldDirty: true })}
                  type={watch('type') === TransactionType.INCOME ? TransactionType.INCOME : watch('type') === TransactionType.EXPENSE ? TransactionType.EXPENSE : undefined}
                  householdId={householdId ?? undefined}
                />
                {errors.category && (
                  <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.frequency}
                </label>
                <Controller
                  name="frequency"
                  control={control}
                  render={({ field }) => (
                    <SelectCombobox
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      options={[
                        { value: 'daily', label: t.daily },
                        { value: 'weekly', label: t.weekly },
                        { value: 'biweekly', label: t.biweekly },
                        { value: 'monthly', label: t.monthly },
                        { value: 'yearly', label: t.yearly },
                      ]}
                      placeholder={t.selectFrequency}
                    />
                  )}
                />
                {errors.frequency && (
                  <p className="mt-1 text-sm text-red-600">{errors.frequency.message}</p>
                )}
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.startDate}
                </label>
                <DatePicker
                  value={watch('startDate') || new Date()}
                  onChange={(date) => {
                    setValue('startDate', date || new Date(), { shouldValidate: true, shouldDirty: true });
                  }}
                  placeholder={t.startDate}
                  className={errors.startDate ? 'border-red-300 dark:border-red-600' : ''}
                />
                <input
                  type="hidden"
                  {...register('startDate', {
                    valueAsDate: true,
                  })}
                />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
                )}
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.endDate}
                </label>
                <DatePicker
                  value={watch('endDate') || undefined}
                  onChange={(date) => {
                    setValue('endDate', date || undefined, { shouldValidate: true, shouldDirty: true });
                  }}
                  placeholder={t.endDate}
                  minDate={watch('startDate') || undefined}
                />
                <input
                  type="hidden"
                  {...register('endDate')}
                />
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.nextDueDate}
                </label>
                <DatePicker
                  value={watch('nextDueDate') || new Date()}
                  onChange={(date) => {
                    setValue('nextDueDate', date || new Date(), { shouldValidate: true, shouldDirty: true });
                  }}
                  placeholder={t.nextDueDate}
                  minDate={watch('startDate') || undefined}
                  className={errors.nextDueDate ? 'border-red-300 dark:border-red-600' : ''}
                />
                <input
                  type="hidden"
                  {...register('nextDueDate', {
                    valueAsDate: true,
                  })}
                />
                {errors.nextDueDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.nextDueDate.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.account} ({t.optional})
                </label>
                <Controller
                  name="accountId"
                  control={control}
                  render={({ field }) => (
                    <SelectCombobox
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      options={[
                        { value: '', label: t.none },
                        ...accounts.map(account => {
                          const isCreditCard = account.type === AccountType.CREDIT;
                          return {
                            value: account.id || '',
                            label: `${account.name}${isCreditCard ? t.creditCardInParentheses : ''}`
                          };
                        })
                      ]}
                      placeholder={t.none}
                    />
                  )}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm font-light text-gray-900 dark:text-white">
                  {t.activate}
                </label>
              </div>

              {followSupported && (
              <div>
                <div className="flex items-center">
                  <input
                    id="recurring-follow-last"
                    type="checkbox"
                    {...register('followLastAmount')}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="recurring-follow-last" className="ml-2 block text-sm font-light text-gray-900 dark:text-white">
                    {t.recurringFollowLabel}
                  </label>
                </div>
                <p className="mt-1 ml-6 text-xs font-light text-gray-500 dark:text-gray-400">{t.recurringFollowHelp}</p>
              </div>
              )}

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingRecurring(null);
                  }}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? t.loading : editingRecurring ? t.update : t.create}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      <DetectRecurringDialog
        open={isDetectOpen}
        onClose={() => setIsDetectOpen(false)}
        householdId={householdId ?? undefined}
        canWrite={canWrite}
        onUnavailable={() => {
          setDetectUnavailable(true);
          setIsDetectOpen(false);
        }}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, recurringId: null })}
        onConfirm={handleConfirmDelete}
        title={t.delete}
        message={t.confirmDeleteRecurring}
        variant="danger"
      />
    </div>
  );
};

export default RecurringTransactions;

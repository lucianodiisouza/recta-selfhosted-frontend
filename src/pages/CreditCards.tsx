import { MoneyText, PaymentCard, buttonClasses } from '../components/ui';
import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTransactions } from "../context/TransactionsContext";
import { useI18n } from "../context/I18nContext";
import { useCurrency } from "../context/CurrencyContext";
import { PageHeader } from "../components/PageHeader";
import { formatCurrency, parseDateFromAPI } from "../utils/format";
import {
  CreditCard,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  HelpCircle,
} from "lucide-react";
import { AccountActionsMenu } from "../components/AccountActionsMenu";
import { format, addMonths } from "date-fns";
import { ptBR as ptBRLocale } from "date-fns/locale/pt-BR";
import { enUS as enUSLocale } from "date-fns/locale/en-US";
import { es as esLocale } from "date-fns/locale/es";
import { fr as frLocale } from "date-fns/locale/fr";
import { ru as ruLocale } from "date-fns/locale/ru";
import { ja as jaLocale } from "date-fns/locale/ja";
import { zhCN as zhCNLocale } from "date-fns/locale/zh-CN";
import { arSA as arSALocale } from "date-fns/locale/ar-SA";
import { Transaction, Account } from "../types";
import { EmptyState } from "../components/EmptyState";
import { AccountsSkeleton } from "../components/PageSkeletons";
import { useToastContext } from "../context/ToastContext";
import TransactionModal from "../components/TransactionModal";
import { CreditCardModal } from "../components/CreditCardModal";
import { PageButton } from "../components/PageButton";
import ConfirmModal from "../components/ConfirmModal";
import InstallmentDeleteModal from "../components/InstallmentDeleteModal";
import { AccountType, CategoryName, getCategoryDisplayName, TransactionType } from "../lib/enums";
import { CreditCardsSummary } from "../components/CreditCardsSummary";
import { TransactionActionsMenu } from "../components/TransactionActionsMenu";
import SelectCombobox from "../components/SelectCombobox";
import { MonthNavigator, TransactionSearchBar } from "../components/shared";
import {
  useCreditCardInvoice,
  useCreditCardInvoiceTotals,
  usePayCreditCardInvoice, 
  useUndoCreditCardPayment 
} from "../hooks/api/useTransactions";
import { useDefaultHousehold } from "../hooks/useDefaultHousehold";
import { getCreditCardUsage } from "../utils/accountBalance";

const CreditCards = () => {
  const {
    accounts,
    transactions,
    loading,
    deleteTransaction,
    deleteAccount,
    updateTransaction,
  } = useTransactions();
  const { t, locale } = useI18n();
  const { baseCurrency } = useCurrency();
  const { success, error: showError } = useToastContext();
  const { householdId } = useDefaultHousehold();
  
  const payInvoiceMutation = usePayCreditCardInvoice();
  const undoPaymentMutation = useUndoCreditCardPayment();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // Format month for API: "YYYY-MM"
  const selectedMonthKey = format(selectedMonth, "yyyy-MM");
  
  // Whole invoice from the backend (every page)
  const { data: invoiceData, isLoading: invoiceLoading } = useCreditCardInvoice({
    accountId: selectedAccountId,
    month: selectedMonthKey,
    householdId,
  });
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);
  const [paymentSourceAccountId, setPaymentAccountSourceId] =
    useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [viewingTransaction, setViewingTransaction] =
    useState<Transaction | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    transactionId: string | null;
  }>({
    isOpen: false,
    transactionId: null,
  });
  const [confirmDeleteAccountModal, setConfirmDeleteAccountModal] = useState<{
    isOpen: boolean;
    accountId: string | null;
  }>({
    isOpen: false,
    accountId: null,
  });
  const [installmentDeleteModal, setInstallmentDeleteModal] = useState<{
    isOpen: boolean;
    transaction: Transaction | null;
  }>({
    isOpen: false,
    transaction: null,
  });

  const currentLocale = useMemo(() => {
    switch (locale) {
      case "pt-BR":
        return ptBRLocale;
      case "es-ES":
        return esLocale;
      case "fr-FR":
        return frLocale;
      case "ru-RU":
        return ruLocale;
      case "ja-JP":
        return jaLocale;
      case "zh-CN":
        return zhCNLocale;
      case "ar-SA":
        return arSALocale;
      default:
        return enUSLocale;
    }
  }, [locale]);

  const creditCards = useMemo(() => {
    return accounts.filter((account) => account.type === AccountType.CREDIT || account.type === "CREDIT");
  }, [accounts]);

  // Selecionar o primeiro cartão se nenhum estiver selecionado
  useEffect(() => {
    if (creditCards.length > 0 && !selectedAccountId) {
      setSelectedAccountId(creditCards[0].id || null);
    }
  }, [creditCards, selectedAccountId]);

  const selectedAccount = useMemo(() => {
    return creditCards.find((acc) => acc.id === selectedAccountId);
  }, [creditCards, selectedAccountId]);


  // Helper function to convert backend transaction to frontend format
  const convertTransaction = useMemo(() => {
    return (t: { id: string; description: string; amount: number | string; categoryName?: string; type?: string; date: string | Date; paid: boolean; accountId?: string; recurringTransactionId?: string; attachmentUrl?: string; installmentId?: string; installmentNumber?: number; totalInstallments?: number }): Transaction | null => {
      // Use type from backend first, fallback to categoryName inference
      let transactionType: TransactionType;
      if (t.type === 'INCOME' || t.type === 'EXPENSE' || t.type === 'TRANSFER' || t.type === 'ALLOCATION') {
        transactionType = t.type as TransactionType;
      } else {
        // Fallback: infer from categoryName if type is not available
        const incomeCategories = ['SALARY', 'FREELANCE', 'INVESTMENTS', 'SALES', 'RENTAL_INCOME', 'OTHER_INCOME'];
        const isIncome = t.categoryName && incomeCategories.includes(t.categoryName);
        transactionType = isIncome ? TransactionType.INCOME : TransactionType.EXPENSE;
      }
      
      // Parse and validate date
      let parsedDate: Date;
      try {
        parsedDate = parseDateFromAPI(t.date);
        // Validate date
        if (isNaN(parsedDate.getTime())) {
          return null; // Skip invalid transactions
        }
      } catch (error) {
        return null; // Skip invalid transactions
      }
      
      return {
        id: t.id,
        description: t.description,
        amount: typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount),
        type: transactionType,
        category: t.categoryName ? getCategoryDisplayName(t.categoryName as CategoryName, t as Record<string, string>) : '',
        date: parsedDate,
        paid: t.paid,
        accountId: t.accountId,
        recurringTransactionId: t.recurringTransactionId,
        attachmentUrl: t.attachmentUrl,
        installmentId: t.installmentId,
        installmentNumber: t.installmentNumber,
        totalInstallments: t.totalInstallments,
      };
    };
  }, []);

  // Use invoice transactions from backend
  // Convert backend format to frontend format
  const invoiceTransactions = useMemo(() => {
    if (!invoiceData?.invoiceTransactions) return [];
    return invoiceData.invoiceTransactions
      .map(convertTransaction)
      .filter((t): t is Transaction => t !== null); // Filter out null (invalid) transactions
  }, [invoiceData, convertTransaction]);

  // Search over the whole invoice: description, category, notes or amount (fdbk #175)
  const visibleInvoiceTransactions = useMemo(() => {
    const query = invoiceSearch.trim().toLocaleLowerCase();
    if (!query) return invoiceTransactions;
    return invoiceTransactions.filter((item: Transaction) =>
      [item.description, item.category, formatCurrency(item.amount, baseCurrency), String(item.amount)]
        .some((field) => !!field && String(field).toLocaleLowerCase().includes(query))
    );
  }, [invoiceTransactions, invoiceSearch, baseCurrency]);

  // Use invoice stats from backend
  const invoiceStats = useMemo(() => {
    if (!invoiceData) {
      return {
        expenses: 0,
        incomes: 0,
        total: 0,
        previousBalance: 0,
        isPaid: false,
        paymentTransactions: [],
      };
    }
    
    // Convert payment transactions
    const paymentTransactions = (invoiceData.paymentTransactions || [])
      .map(convertTransaction)
      .filter((t): t is Transaction => t !== null); // Filter out null (invalid) transactions
    
    return {
      expenses: invoiceData.currentExpenses || 0,
      incomes: invoiceData.currentPayments || 0,
      total: invoiceData.total || 0,
      previousBalance: invoiceData.previousBalance || 0,
      isPaid: invoiceData.isPaid || false,
      paymentTransactions,
    };
  }, [invoiceData, convertTransaction]);

  // Invoice of each card in the selected month (shown on the card picker tiles)
  const creditCardsInvoices = useCreditCardInvoiceTotals(
    creditCards.map((card) => card.id || "").filter(Boolean),
    selectedMonthKey,
    householdId
  );

  const cardDetails = useMemo(() => {
    if (!selectedAccountId) return null;
    const currentAccount = accounts.find(acc => acc.id === selectedAccountId);
    if (!currentAccount) return null;
    const { limit, used, available, usagePercent } = getCreditCardUsage(currentAccount);
    return { totalDebt: used, limit, available, usagePercent };
  }, [selectedAccountId, accounts]);

  const handleMonthChange = (month: Date) => setSelectedMonth(month);

  const handleNewTransaction = () => {
    // Se não tiver cartão selecionado, seleciona o primeiro
    if (!selectedAccountId && creditCards.length > 0) {
      setSelectedAccountId(creditCards[0].id || null);
    }
    setEditingTransaction(null);
    setIsTransactionModalOpen(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  const handleMarkAsPaid = async (id: string, paid: boolean): Promise<void> => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      await updateTransaction(id, { paid });
    }
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setIsAccountModalOpen(true);
  };

  const handleDeleteAccountClick = (accountId: string) => {
    setConfirmDeleteAccountModal({ isOpen: true, accountId });
  };

  const handleConfirmDeleteAccount = async (deleteTransactions = false) => {
    if (!confirmDeleteAccountModal.accountId) return;

    try {
      await deleteAccount(confirmDeleteAccountModal.accountId, deleteTransactions);
      success(t.accountDeleted);
      setConfirmDeleteAccountModal({ isOpen: false, accountId: null });
      setSelectedAccountId(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t.errorDeletingAccount;
      showError(message);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, transaction: Transaction) => {
    e.stopPropagation();
    if (transaction.installmentId) {
      setInstallmentDeleteModal({ isOpen: true, transaction });
    } else {
      setConfirmDeleteModal({
        isOpen: true,
        transactionId: transaction.id || null,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteModal.transactionId) return;

    try {
      await deleteTransaction(confirmDeleteModal.transactionId);
      success(t.transactionDeleted);
      setConfirmDeleteModal({ isOpen: false, transactionId: null });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t.errorDeletingTransaction;
      showError(message);
    }
  };

  const handleDeleteOnlyThis = async () => {
    const transaction = installmentDeleteModal.transaction;
    if (!transaction || !transaction.id) return;

    try {
      await deleteTransaction(transaction.id);
      success(t.transactionDeleted);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t.errorDeletingTransaction;
      showError(message);
    }
  };

  const handleDeleteSubsequent = async () => {
    const currentTransaction = installmentDeleteModal.transaction;
    if (!currentTransaction || !currentTransaction.installmentId) return;

    try {
      // Encontrar todas as parcelas subsequentes (mesmo installmentId e installmentNumber >= atual)
      const subsequentInstallments = transactions.filter(
        (t_item) =>
          t_item.installmentId === currentTransaction.installmentId &&
          (t_item.installmentNumber || 0) >=
            (currentTransaction.installmentNumber || 0)
      );

      for (const inst of subsequentInstallments) {
        if (inst.id) {
          await deleteTransaction(inst.id);
        }
      }

      success(t.transactionDeleted);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t.errorDeletingTransactions;
      showError(message);
    }
  };

  const handlePayInvoiceClick = () => {
    // Valor padrão = Total da fatura (vem do backend)
    const totalToPay = Math.max(0, invoiceStats.total);
    
    setPaymentAmount(totalToPay);
    setIsPayModalOpen(true);
  };

  const handlePayInvoice = async () => {
    if (!selectedAccount || !paymentSourceAccountId || paymentAmount <= 0)
      return;

    try {
      const monthName = format(selectedMonth, "MMMM", {
        locale: currentLocale,
      });
      const yearName = format(selectedMonth, "yyyy");
      const description = `${t.invoicePaymentDescription} - ${monthName}/${yearName}`;

      await payInvoiceMutation.mutateAsync({
        accountId: selectedAccount.id!,
        sourceAccountId: paymentSourceAccountId,
        amount: paymentAmount,
        month: selectedMonthKey,
        description,
        householdId: householdId || undefined,
      });

      success(t.confirmInvoicePayment);
      setIsPayModalOpen(false);
      setPaymentAccountSourceId("");
      setPaymentAmount(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.errorPayingInvoice;
      showError(message);
    }
  };

  const handleUndoPayment = async () => {
    if (!selectedAccount) return;

    try {
      // Find payment transaction for this month
      const paymentTransaction = invoiceStats.paymentTransactions?.[0];
      
      if (!paymentTransaction || !paymentTransaction.id) {
        showError(t.errorUndoingPayment || 'Payment transaction not found');
        return;
      }

      await undoPaymentMutation.mutateAsync({
        accountId: selectedAccount.id!,
        transactionId: paymentTransaction.id,
      });

      success(t.invoicePaymentUndone);
      setIsUndoModalOpen(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t.errorUndoingPayment;
      showError(message);
    }
  };

  if (loading) return <AccountsSkeleton />;

  if (creditCards.length === 0) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 dashboard-fade-in">
        <PageHeader
          title={t.creditCards}
          description={t.creditCardsDescription}
        />
        <EmptyState
          title={t.noCreditCards}
          description={t.creditCardsDescription}
          icon={CreditCard}
          action={{
            label: t.newCreditCard || "Adicionar Cartão",
            onClick: () => {
              setEditingAccount(null);
              setIsAccountModalOpen(true);
            },
          }}
        />
        {isAccountModalOpen && (
          <CreditCardModal
            account={editingAccount}
            onClose={() => {
              setIsAccountModalOpen(false);
              setEditingAccount(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 dashboard-fade-in">
      <PageHeader title={t.creditCards} description={t.creditCardsDescription}>
        <PageButton
          onClick={handleNewTransaction}
          variant="primary"
          icon={Plus}
        >
          {t.newTransaction}
        </PageButton>
      </PageHeader>

      {/* Seletor de Cartões: carrossel de cartões, como no app */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 pt-1 scrollbar-hide sm:mx-0 sm:px-1">
        {creditCards.map((card) => (
          <div key={card.id} className="w-[220px] flex-shrink-0 snap-start">
            <PaymentCard
              compact
              type={AccountType.CREDIT}
              color={card.color}
              selected={selectedAccountId === card.id}
              onClick={() => setSelectedAccountId(card.id || null)}
              className={selectedAccountId === card.id ? undefined : 'opacity-75 hover:opacity-100'}
              title={card.name}
              subtitle={`${t.invoice} ${format(selectedMonth, "MMM", { locale: currentLocale })}`}
              amount={<MoneyText value={creditCardsInvoices[card.id || ""] || 0} currency={baseCurrency} className="text-white" />}
            />
          </div>
        ))}

        {/* Botão para Adicionar Novo Cartão */}
        <button
          onClick={() => {
            setEditingAccount(null);
            setIsAccountModalOpen(true);
          }}
          className="group flex h-[120px] w-[220px] flex-shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-line text-content-tertiary transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken group-hover:bg-brand group-hover:text-white transition-colors">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold">{t.newCreditCard}</span>
        </button>
      </div>

      {/* Componente de resumo consolidado de todos os cartões */}
      <CreditCardsSummary selectedMonth={selectedMonth} />

      {selectedAccount && cardDetails ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Sidebar Stats (Limit Usage) - Agora primeiro no mobile (até 1280px) */}
          <div className="space-y-6 order-1 xl:order-2">
            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-title">
                  {t.limitUsage}
                </h3>
                <AccountActionsMenu
                  account={selectedAccount}
                  onEdit={handleEditAccount}
                  onDelete={(account) => handleDeleteAccountClick(account.id!)}
                />
              </div>

              <PaymentCard
                showChip
                type={AccountType.CREDIT}
                color={selectedAccount.color}
                title={selectedAccount.name}
                subtitle={t.invoice}
                amount={<MoneyText value={invoiceStats.total} currency={baseCurrency} size="xl" className="text-white" />}
                className="mb-6"
              />

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-content-secondary">
                      {t.usedLimit}
                    </span>
                    <span className="font-rounded font-semibold tabular-nums text-content">
                      {cardDetails.usagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-line rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        cardDetails.usagePercent > 90
                          ? "bg-negative"
                          : cardDetails.usagePercent > 70
                          ? "bg-[#F79009]"
                          : "bg-brand"
                      }`}
                      style={{
                        width: `${Math.min(100, cardDetails.usagePercent)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-surface-sunken/70">
                    <div className="text-xs font-medium text-content-secondary mb-2">
                      {t.availableLimit}
                    </div>
                    <div className="text-[15px] font-rounded font-semibold tabular-nums text-positive">
                      {formatCurrency(cardDetails.available, baseCurrency)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-sunken/70">
                    <div className="text-xs font-medium text-content-secondary mb-2">
                      {t.totalLimit}
                    </div>
                    <div className="text-[15px] font-rounded font-semibold tabular-nums text-content">
                      {formatCurrency(cardDetails.limit, baseCurrency)}
                    </div>
                  </div>
                </div>

                {!!selectedAccount.limitAdjustment && Math.round(selectedAccount.limitAdjustment * 100) !== 0 && (
                  <p className="-mt-3 text-xs font-light text-content-tertiary">
                    {t.limitAdjustmentNote.replace(
                      '{{amount}}',
                      formatCurrency(Math.abs(selectedAccount.limitAdjustment), baseCurrency),
                    )}
                  </p>
                )}

                <div className="pt-6 border-t border-line-subtle space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm font-medium text-content-secondary">
                      <Clock className="h-4 w-4" />
                      {t.dueDay}
                    </div>
                    <span className="text-[15px] font-semibold tabular-nums text-content">
                      {selectedAccount.dueDay || "--"}
                    </span>
                  </div>

                  {selectedAccount.closingDay && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm font-medium text-content-secondary">
                        <Calendar className="h-4 w-4" />
                        {t.closingDay}
                      </div>
                      <span className="text-[15px] font-semibold tabular-nums text-content">
                        {selectedAccount.closingDay}
                      </span>
                    </div>
                  )}

                  {selectedAccount.dueDay && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm font-medium text-content-secondary">
                        <CheckCircle2 className="h-4 w-4" />
                        {t.bestDayToBuy}
                      </div>
                      <span className="text-[15px] font-semibold tabular-nums text-positive">
                        {(() => {
                          const offset = selectedAccount.bestDayOffset ?? 10;
                          const baseDay = selectedAccount.closingDay ?? selectedAccount.dueDay ?? 1;
                          const result = baseDay - offset;
                          return result <= 0 ? 30 + result : result;
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Botão de Pagamento agora dentro do card */}
                <div className="pt-6 border-t border-line-subtle">
                  {invoiceStats.isPaid ? (
                    <button
                      onClick={() => setIsUndoModalOpen(true)}
                      className={buttonClasses({ variant: 'tertiary', fullWidth: true }) + ' !text-negative'}
                    >
                      <AlertCircle className="h-[18px] w-[18px]" aria-hidden="true" />
                      {t.undoInvoicePayment}
                    </button>
                  ) : (
                    <button
                      onClick={handlePayInvoiceClick}
                      disabled={invoiceStats.total <= 0}
                      className={buttonClasses({ variant: 'primary', fullWidth: true })}
                    >
                      <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden="true" />
                      {t.payInvoice}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card Summary (Lista de Transações) - Segundo no mobile (até 1280px) */}
          <div className="xl:col-span-2 space-y-6 order-2 xl:order-1">
            <div className="surface-card overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-line-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <MonthNavigator
                    selectedMonth={selectedMonth}
                    onMonthChange={handleMonthChange}
                    locale={locale}
                  />
                  {selectedAccount.dueDay && (
                    <span className="ps-1 text-xs font-medium text-brand">
                      {t.bestDayToBuy}:{" "}
                      {(() => {
                        const offset = selectedAccount.bestDayOffset ?? 10;
                        const baseDay = selectedAccount.closingDay ?? selectedAccount.dueDay ?? 1;
                        const result = baseDay - offset;
                        return result <= 0 ? 30 + result : result;
                      })()}
                    </span>
                  )}
                </div>

                <div className="sm:text-end">
                  <div className="text-sm font-medium text-content-secondary">
                    {t.invoice} (
                    {format(selectedMonth, "MMMM", { locale: currentLocale })})
                  </div>
                  <div className="text-2xl font-rounded font-semibold tabular-nums text-content">
                    {formatCurrency(invoiceStats.total, baseCurrency)}
                  </div>
                  {/* What this month alone added, without the carried-over balance (fdbk #176) */}
                  {invoiceStats.previousBalance !== 0 && (
                    <div className="text-xs text-content-secondary">
                      {t.invoiceMonthSpend}:{" "}
                      <span className="font-rounded font-semibold tabular-nums text-content">
                        {formatCurrency(invoiceStats.expenses, baseCurrency)}
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-content-tertiary">
                    {t.dueDay} {selectedAccount.dueDay}/
                    {/* The invoice month is the month it closes in: due later that month, or in the next one. */}
                    {format(
                      addMonths(
                        selectedMonth,
                        selectedAccount.closingDay && selectedAccount.dueDay && selectedAccount.dueDay > selectedAccount.closingDay ? 0 : 1
                      ),
                      "MM"
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[13px] font-semibold text-content-secondary">
                    {t.creditCardTransactions}
                  </h3>
                  <span className="text-xs text-content-tertiary">
                    {invoiceSearch.trim()
                      ? `${visibleInvoiceTransactions.length} / ${invoiceTransactions.length}`
                      : invoiceTransactions.length}{" "}
                    {t.items}
                  </span>
                </div>

                {invoiceTransactions.length > 0 && (
                  <TransactionSearchBar
                    value={invoiceSearch}
                    onChange={setInvoiceSearch}
                    placeholder={t.invoiceSearchPlaceholder}
                    debounceMs={150}
                    className="mb-2"
                  />
                )}

                <div className="space-y-4">
                  {invoiceLoading ? (
                    <div className="space-y-4 animate-pulse">
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
                  ) : (
                    <>
                      {/* Saldo Anterior */}
                      {invoiceStats.previousBalance !== 0 && !invoiceSearch.trim() && (
                        <div className="flex items-center justify-between py-3 border-b border-line-subtle">
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-content-tertiary" />
                            <div>
                              <div className="text-[15px] text-content-secondary flex items-center gap-1.5">
                                {t.previousBalance}
                                <span
                                  className="inline-flex text-content-tertiary cursor-help"
                                  title={t.previousBalanceTooltip}
                                  aria-label={t.previousBalanceTooltip}
                                >
                                  <HelpCircle className="h-3.5 w-3.5" />
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="font-rounded text-[15px] font-semibold tabular-nums text-content">
                            {formatCurrency(
                              invoiceStats.previousBalance,
                              baseCurrency
                            )}
                          </div>
                        </div>
                      )}

                      {invoiceTransactions.length === 0 &&
                      invoiceStats.previousBalance === 0 ? (
                        <div className="text-center py-8 text-content-tertiary">
                          {t.noInvoiceTransactions}
                        </div>
                      ) : (
                        <>
                          {invoiceSearch.trim() && visibleInvoiceTransactions.length === 0 && (
                            <div className="text-center py-8 text-content-tertiary">
                              {t.invoiceSearchNoResults}
                            </div>
                          )}
                          {visibleInvoiceTransactions.map((t_item: Transaction) => {
                      // Identificar transação de pagamento de fatura
                      // Verificar se tem attachmentUrl que indica pagamento
                      const isPayment = !!t_item.attachmentUrl && t_item.attachmentUrl.startsWith('invoice_pay:');
                      return (
                        <div
                          key={t_item.id}
                          className="flex items-center justify-between gap-3 group rounded-lg px-2 py-3 -mx-2 transition-colors hover:bg-surface-sunken/70 border-b border-line-subtle last:border-0"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="text-[15px] font-medium text-content truncate mb-0.5">
                                {t_item.description}
                              </div>
                              <div className="text-[13px] text-content-secondary flex items-center gap-2">
                                {(() => {
                                  try {
                                    const transactionDate = t_item.date instanceof Date ? t_item.date : parseDateFromAPI(String(t_item.date));
                                    if (isNaN(transactionDate.getTime())) return '';
                                    return format(transactionDate, "dd/MM");
                                  } catch {
                                    return '';
                                  }
                                })()} •{" "}
                                {t_item.category}
                                {t_item.installmentNumber && (
                                  <span className="text-content-tertiary">
                                    {t_item.installmentNumber}/{t_item.totalInstallments}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 xl:gap-2 ml-4">
                            <div
                              className={`font-rounded text-[15px] font-semibold tabular-nums whitespace-nowrap ${
                                isPayment
                                  ? "text-positive"
                                  : "text-negative"
                              }`}
                            >
                              {isPayment ? "-" : ""}
                              {formatCurrency(t_item.amount, baseCurrency)}
                            </div>

                            <TransactionActionsMenu
                              transaction={t_item}
                              onEdit={handleEditTransaction}
                              onDelete={(id: string) => {
                                const transaction = invoiceTransactions.find((t: Transaction) => t.id === id);
                                if (transaction) {
                                  handleDeleteClick({ stopPropagation: () => {} } as React.MouseEvent, transaction);
                                }
                              }}
                              onMarkAsPaid={handleMarkAsPaid}
                              onView={(transaction) => {
                                setViewingTransaction(transaction);
                                setEditingTransaction(null);
                                setIsTransactionModalOpen(true);
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                      </>
                    )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : selectedAccountId && invoiceLoading ? (
        // Skeleton quando tem cartão selecionado mas está carregando fatura
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Sidebar Stats skeleton */}
          <div className="space-y-6 order-1 xl:order-2">
            <div className="surface-card p-6 animate-pulse">
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
            <div className="surface-card overflow-hidden">
              <div className="p-6 border-b border-line-subtle">
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
      ) : null}

      {/* Modal de Pagamento de Fatura */}
      {isPayModalOpen && createPortal(
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop"
            onClick={() => setIsPayModalOpen(false)}
            aria-hidden="true"
          />
          <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
            <div className="relative w-full sm:w-96 max-w-md p-6 bg-surface-elevated rounded-t-[28px] sm:rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel">
              <h3 className="font-rounded text-lg font-semibold text-content mb-4 pb-4 border-b border-line-subtle">
                {t.payInvoice}
              </h3>
              <p className="text-sm font-light text-content-secondary mb-6">
                {t.payInvoiceDescription}{" "}
                <span className="font-light text-content">
                  {formatCurrency(invoiceStats.total, baseCurrency)}
                </span>
                .
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-light text-content-tertiary mb-2">
                    {t.paymentAccount}
                  </label>
                  <SelectCombobox
                    value={paymentSourceAccountId}
                    onValueChange={(value) => setPaymentAccountSourceId(value)}
                    options={[
                      { value: '', label: t.selectAccount },
                      ...accounts
                        .filter((acc) => acc.type !== AccountType.CREDIT && acc.type !== "CREDIT")
                        .map((acc) => ({
                          value: acc.id || '',
                          label: acc.name
                        }))
                    ]}
                    placeholder={t.selectAccount}
                  />
                </div>

                <div>
                  <label className="block text-sm font-light text-content-tertiary mb-2">
                    {t.amount}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={
                        paymentAmount > 0
                          ? formatCurrency(paymentAmount, baseCurrency)
                              .replace(/[^\d,.-]/g, "")
                              .trim()
                          : ""
                      }
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setPaymentAmount(Number(val) / 100);
                      }}
                      placeholder={formatCurrency(
                        invoiceStats.total,
                        baseCurrency
                      )}
                      className="field-control"
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-light text-content-tertiary">
                    {t.paymentAmountHint}
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-6 border-t border-line-subtle">
                  <button
                    onClick={handlePayInvoice}
                    disabled={!paymentSourceAccountId || paymentAmount <= 0}
                    className="w-full px-4 py-2.5 text-sm font-light tracking-tight text-white bg-brand-fill border border-brand rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed order-1"
                  >
                    {t.confirmInvoicePayment}
                  </button>
                  <button
                    onClick={() => setIsPayModalOpen(false)}
                    className="w-full px-4 py-2.5 border border-line-subtle rounded-md text-sm font-light tracking-tight text-content bg-surface-elevated hover:opacity-70 transition-opacity order-2"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Desfazer Pagamento */}
      {isUndoModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-elevated border border-line-subtle rounded-lg w-full max-w-md p-6">
            <div className="flex items-center gap-3 text-negative mb-6 pb-6 border-b border-line-subtle">
              <AlertCircle className="h-6 w-6" />
              <h3 className="font-rounded text-lg font-semibold text-content">{t.undoInvoicePayment}</h3>
            </div>
            <p className="text-sm font-light text-content-secondary mb-8">
              {t.undoInvoicePaymentDescription}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleUndoPayment}
                className="w-full px-4 py-2.5 text-sm font-light tracking-tight text-white bg-red-500 dark:bg-red-500 border border-red-500 dark:border-red-500 rounded-md hover:opacity-80 transition-opacity order-1"
              >
                {t.undoInvoicePayment}
              </button>
              <button
                onClick={() => setIsUndoModalOpen(false)}
                className="w-full px-4 py-2.5 border border-line-subtle rounded-md text-sm font-light tracking-tight text-content bg-surface-elevated hover:opacity-70 transition-opacity order-2"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Transação */}
      {isTransactionModalOpen && selectedAccountId && (
        <TransactionModal
          transaction={editingTransaction || viewingTransaction}
          defaultAccountId={selectedAccountId}
          defaultPaid={false}
          onClose={() => {
            setIsTransactionModalOpen(false);
            setEditingTransaction(null);
            setViewingTransaction(null);
          }}
          readOnly={!!viewingTransaction}
        />
      )}

      {/* Modal de Cartão de Crédito */}
      {isAccountModalOpen && (
        <CreditCardModal
          account={editingAccount}
          onClose={() => {
            setIsAccountModalOpen(false);
            setEditingAccount(null);
          }}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={confirmDeleteModal.isOpen}
        onClose={() =>
          setConfirmDeleteModal({ isOpen: false, transactionId: null })
        }
        onConfirm={handleConfirmDelete}
        title={t.delete}
        message={
          t.confirmDeleteTransaction ||
          "Tem certeza que deseja excluir esta transação?"
        }
        variant="danger"
      />

      {/* Modal de Confirmação de Exclusão de Conta */}
      <ConfirmModal
        isOpen={confirmDeleteAccountModal.isOpen}
        onClose={() =>
          setConfirmDeleteAccountModal({ isOpen: false, accountId: null })
        }
        onConfirm={handleConfirmDeleteAccount}
        title={t.delete}
        message={
          t.confirmDeleteAccount || "Tem certeza que deseja excluir esta conta?"
        }
        variant="danger"
      />

      {/* Modal de Exclusão de Parcelas */}
      <InstallmentDeleteModal
        isOpen={installmentDeleteModal.isOpen}
        onClose={() =>
          setInstallmentDeleteModal({ isOpen: false, transaction: null })
        }
        onDeleteOnly={handleDeleteOnlyThis}
        onDeleteAll={handleDeleteSubsequent}
      />
    </div>
  );
};

export default CreditCards;

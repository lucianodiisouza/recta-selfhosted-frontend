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
import {
  isSameMonth,
  format,
  isBefore,
  startOfMonth,
  subMonths,
  addMonths,
} from "date-fns";
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
import { effectiveClosingDay } from "../utils/closingDay";
import { ClosingDayRows } from "../components/credit-cards/ClosingDayRows";
import TransactionModal from "../components/TransactionModal";
import { CreditCardModal } from "../components/CreditCardModal";
import { PageButton } from "../components/PageButton";
import ConfirmModal from "../components/ConfirmModal";
import InstallmentDeleteModal from "../components/InstallmentDeleteModal";
import { AccountType, CategoryName, getCategoryDisplayName, TransactionType } from "../lib/enums";
import { CreditCardsSummary } from "../components/CreditCardsSummary";
import { TransactionActionsMenu } from "../components/TransactionActionsMenu";
import SelectCombobox from "../components/SelectCombobox";
import { MonthNavigator } from "../components/shared";
import {
  useCreditCardInvoice,
  useLoadMoreCreditCardInvoice,
  usePayCreditCardInvoice, 
  useUndoCreditCardPayment 
} from "../hooks/api/useTransactions";
import { useDefaultHousehold } from "../hooks/useDefaultHousehold";

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
  
  // Get invoice data from backend with pagination
  const { data: invoiceResponse, isLoading: invoiceLoading } = useCreditCardInvoice({
    accountId: selectedAccountId,
    month: selectedMonthKey,
    householdId,
    limit: 25,
  });
  
  const invoiceData = invoiceResponse?.data;
  const invoicePagination = invoiceResponse?.pagination;
  
  const loadMoreInvoiceMutation = useLoadMoreCreditCardInvoice();
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

  // The closing day is also the best day to buy; without one it is the due day - 7.
  const effectiveClosing = effectiveClosingDay(selectedAccount);


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

  // Calcular fatura atual de cada cartão (para exibir nos cards de seleção)
  const creditCardsInvoices = useMemo(() => {
    const invoices: Record<string, number> = {};
    
    creditCards.forEach((card) => {
      const monthKey = `${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`;
      const technicalIdentifier = `invoice_pay:${card.id}:${monthKey}`;
      
      // Buscar transações do cartão no mês selecionado
      const cardTransactions = transactions.filter((t_item) => {
        // Validate date before using
        if (!t_item.date) return false;
        const transactionDate = t_item.date instanceof Date ? t_item.date : parseDateFromAPI(String(t_item.date));
        if (isNaN(transactionDate.getTime())) return false;
        
        const isCardTransaction =
          t_item.accountId === card.id &&
          isSameMonth(transactionDate, selectedMonth);
        const isPaymentTransaction =
          t_item.attachmentUrl === technicalIdentifier;
        return isCardTransaction || isPaymentTransaction;
      });
      
      // Calcular saldo anterior (dívida herdada do mês anterior)
      const previousMonth = subMonths(selectedMonth, 1);
      const previousMonthKey = `${previousMonth.getFullYear()}-${previousMonth.getMonth()}`;
      const previousMonthTechnicalIdentifier = `invoice_pay:${card.id}:${previousMonthKey}`;
      
      const previousMonthPayment = transactions.find(
        (t) => t.attachmentUrl === previousMonthTechnicalIdentifier
      );
      
      let previousBalance = 0;
      
      if (previousMonthPayment) {
        const monthStart = startOfMonth(selectedMonth);
        const previousMonthTransactions = transactions.filter((t_prev) => {
          if (!t_prev.date) return false;
          const transactionDate = t_prev.date instanceof Date ? t_prev.date : parseDateFromAPI(String(t_prev.date));
          if (isNaN(transactionDate.getTime())) return false;
          return t_prev.accountId === card.id && isBefore(transactionDate, monthStart);
        });
        
        const prevExpenses = previousMonthTransactions
          .filter((t_prev) => t_prev.type === TransactionType.EXPENSE)
          .reduce((sum, t_prev) => sum + t_prev.amount, 0);
        
        const prevIncomes = previousMonthTransactions
          .filter((t_prev) => t_prev.type === TransactionType.INCOME)
          .reduce((sum, t_prev) => sum + t_prev.amount, 0);
        
        const previousMonthInvoiceTotal = prevExpenses - prevIncomes;
        
        if (previousMonthPayment.amount < previousMonthInvoiceTotal) {
          previousBalance = Number((previousMonthInvoiceTotal - previousMonthPayment.amount).toFixed(2));
        }
      } else {
        const monthStart = startOfMonth(selectedMonth);
        const previousCardTransactions = transactions.filter((t_prev) => {
          if (!t_prev.date) return false;
          const transactionDate = t_prev.date instanceof Date ? t_prev.date : parseDateFromAPI(String(t_prev.date));
          if (isNaN(transactionDate.getTime())) return false;
          return t_prev.accountId === card.id && isBefore(transactionDate, monthStart);
        });

        const prevExpenses = previousCardTransactions
          .filter((t_prev) => t_prev.type === TransactionType.EXPENSE)
          .reduce((sum, t_prev) => sum + t_prev.amount, 0);

        const prevIncomes = previousCardTransactions
          .filter((t_prev) => t_prev.type === TransactionType.INCOME)
          .reduce((sum, t_prev) => sum + t_prev.amount, 0);

        previousBalance = Number((prevExpenses - prevIncomes).toFixed(2));
      }
      
      // Calcular despesas do mês atual (apenas compras no cartão, não pagamentos)
      const currentExpenses = cardTransactions
        .filter(
          (t_item) =>
            t_item.accountId === card.id && 
            t_item.type === TransactionType.EXPENSE &&
            !t_item.attachmentUrl // Excluir transações de pagamento
        )
        .reduce((sum, t_item) => sum + t_item.amount, 0);
      
      // Calcular pagamentos do mês atual
      const currentPayments = cardTransactions
        .filter((t_item) => t_item.attachmentUrl === technicalIdentifier)
        .reduce((sum, t_item) => sum + t_item.amount, 0);
      
      // Fatura total = saldo anterior + despesas do mês - pagamentos do mês
      const total = Number(
        (previousBalance + currentExpenses - currentPayments).toFixed(2)
      );
      
      invoices[card.id || ""] = Math.max(0, total);
    });
    
    return invoices;
  }, [creditCards, transactions, selectedMonth]);

  const cardDetails = useMemo(() => {
    if (!selectedAccountId) return null;

    // Buscar conta atualizada diretamente do array de accounts
    const currentAccount = accounts.find(acc => acc.id === selectedAccountId);
    if (!currentAccount) return null;

    // Para cartões de crédito, o limite usado deve considerar:
    // 1. Saldo atual (account.balance) - que reflete transações pagas
    // 2. Transações não pagas - que também consomem o limite
    const paidDebt = typeof currentAccount.balance === 'number' ? currentAccount.balance : 0;
    
      // Adicionar transações não pagas deste cartão
      // Excluir transações de pagamento de fatura (elas têm attachmentUrl e são da conta bancária)
      const unpaidTransactions = transactions.filter((trans) => {
        if (!trans.accountId || trans.accountId !== selectedAccountId) return false;
        if (trans.type === TransactionType.TRANSFER || trans.type === TransactionType.ALLOCATION) return false;
        if (trans.attachmentUrl) return false; // Excluir pagamentos de fatura
        return trans.paid === false;
      });
    
    // Calculate unpaid debt: EXPENSE increases debt, INCOME decreases debt
    const unpaidAmount = unpaidTransactions.reduce((acc, trans) => {
      const amount = trans.amount || 0;
      if (trans.type === TransactionType.EXPENSE) {
        return acc + Math.abs(amount); // Expenses increase debt
      } else if (trans.type === TransactionType.INCOME) {
        return acc - Math.abs(amount); // Income decreases debt
      }
      return acc;
    }, 0);
    
    // Dívida total = saldo atual (transações pagas) + transações não pagas
    // Garantir que totalDebt nunca seja negativo
    const totalDebt = Math.max(0, paidDebt + unpaidAmount);
    
    const limit = currentAccount.totalLimit || currentAccount.creditLimit || 0;
    const available = Math.max(0, limit - totalDebt);
    // Garantir que a porcentagem de uso não seja negativa (caso de pagamento antecipado/crédito)
    const usagePercent = limit > 0 ? Math.max(0, Math.min(100, (totalDebt / limit) * 100)) : 0;

    return {
      totalDebt,
      limit,
      available,
      usagePercent,
    };
  }, [selectedAccountId, accounts, transactions]);

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
    <div className="px-4 sm:px-6 lg:px-8 space-y-6 dashboard-fade-in">
      <PageHeader title={t.creditCards} description={t.creditCardsDescription}>
        <PageButton
          onClick={handleNewTransaction}
          variant="primary"
          icon={Plus}
        >
          {t.newTransaction}
        </PageButton>
      </PageHeader>

      {/* Seletor de Cartões */}
      <div className="flex overflow-x-auto pb-2 gap-4 scrollbar-hide">
        {creditCards.map((card) => (
          <button
            key={card.id}
            onClick={() => setSelectedAccountId(card.id || null)}
            className={`flex-shrink-0 w-[200px] flex items-center p-4 rounded-lg border transition-all ${
              selectedAccountId === card.id
                ? "border-primary-500 dark:border-primary-500 bg-white dark:bg-gray-900"
                : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:opacity-80"
            }`}
          >
            <div
              className="p-2 rounded-lg mr-3"
              style={{
                backgroundColor: `${card.color || "#3b82f6"}20`,
                color: card.color || "#3b82f6",
              }}
            >
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="text-sm font-light text-gray-900 dark:text-white">
                {card.name}
              </div>
              <div className="text-xs font-light text-gray-500 dark:text-gray-400">
                {formatCurrency(
                  creditCardsInvoices[card.id || ""] || 0,
                  baseCurrency
                )}
              </div>
              <div className="text-[10px] font-light text-gray-400 dark:text-gray-500 mt-0.5">
                {t.invoice} {format(selectedMonth, "MMM", { locale: currentLocale })}
              </div>
            </div>
          </button>
        ))}

        {/* Botão para Adicionar Novo Cartão */}
        <button
          onClick={() => {
            setEditingAccount(null);
            setIsAccountModalOpen(true);
          }}
          className="flex-shrink-0 w-[200px] flex items-center p-4 rounded-lg border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:opacity-80 transition-opacity group"
        >
          <div className="p-2 rounded-lg mr-3 bg-gray-50 dark:bg-gray-900 text-gray-400 group-hover:text-primary-500 transition-colors">
            <Plus className="h-5 w-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-light text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white">
              {t.creditCard}
            </div>
            <div className="text-xs font-light text-gray-400 dark:text-gray-500">{t.newCreditCard}</div>
          </div>
        </button>
      </div>

      {/* Componente de resumo consolidado de todos os cartões */}
      <CreditCardsSummary selectedMonth={selectedMonth} />

      {selectedAccount && cardDetails ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Sidebar Stats (Limit Usage) - Agora primeiro no mobile (até 1280px) */}
          <div className="space-y-6 order-1 xl:order-2">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">
                  {t.limitUsage}
                </h3>
                <AccountActionsMenu
                  account={selectedAccount}
                  onEdit={handleEditAccount}
                  onDelete={(account) => handleDeleteAccountClick(account.id!)}
                />
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-500 dark:text-gray-300">
                      {t.usedLimit}
                    </span>
                    <span className="font-light text-gray-900 dark:text-white">
                      {cardDetails.usagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        cardDetails.usagePercent > 90
                          ? "bg-red-500"
                          : cardDetails.usagePercent > 70
                          ? "bg-yellow-500"
                          : "bg-primary-500"
                      }`}
                      style={{
                        width: `${Math.min(100, cardDetails.usagePercent)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-300 mb-2">
                      {t.availableLimit}
                    </div>
                    <div className="text-sm font-light text-green-500">
                      {formatCurrency(cardDetails.available, baseCurrency)}
                    </div>
                  </div>
                  <div className="p-4 border border-gray-100 dark:border-gray-800 rounded-lg">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-300 mb-2">
                      {t.totalLimit}
                    </div>
                    <div className="text-sm font-light text-gray-900 dark:text-white">
                      {formatCurrency(cardDetails.limit, baseCurrency)}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-300">
                      <Clock className="h-4 w-4" />
                      {t.dueDay}
                    </div>
                    <span className="text-sm font-light text-gray-900 dark:text-white">
                      {selectedAccount.dueDay || "--"}
                    </span>
                  </div>

                  <ClosingDayRows account={selectedAccount} />
                </div>

                {/* Botão de Pagamento agora dentro do card */}
                <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                  {invoiceStats.isPaid ? (
                    <button
                      onClick={() => setIsUndoModalOpen(true)}
                      className="w-full py-2.5 px-6 text-sm font-light tracking-tight text-red-500 border border-red-300 dark:border-red-700 rounded-md hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
                    >
                      <AlertCircle className="h-5 w-5" />
                      {t.undoInvoicePayment}
                    </button>
                  ) : (
                    <button
                      onClick={handlePayInvoiceClick}
                      disabled={invoiceStats.total <= 0}
                      className="w-full py-2.5 px-6 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      {t.payInvoice}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card Summary (Lista de Transações) - Segundo no mobile (até 1280px) */}
          <div className="xl:col-span-2 space-y-6 order-2 xl:order-1">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Calendar className="h-5 w-5" />
                      <span className="font-light capitalize text-lg">
                        {format(selectedMonth, "MMMM yyyy", {
                          locale: currentLocale,
                        })}
                      </span>
                    </div>
                    {effectiveClosing && (
                      <span className="text-xs text-primary-600 dark:text-primary-400 font-light mt-1">
                        {t.bestDayToBuy}:{" "}
                        {effectiveClosing}
                      </span>
                    )}
                  </div>
                  <MonthNavigator
                    selectedMonth={selectedMonth}
                    onMonthChange={handleMonthChange}
                    locale={locale}
                  />
                </div>

                <div className="text-right">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-300">
                    {t.invoice} (
                    {format(selectedMonth, "MMMM", { locale: currentLocale })})
                  </div>
                  <div className="text-2xl font-light tracking-tight text-gray-900 dark:text-white">
                    {formatCurrency(invoiceStats.total, baseCurrency)}
                  </div>
                  <div className="text-[10px] font-light text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {t.dueDay} {selectedAccount.dueDay}/
                    {format(addMonths(selectedMonth, 1), "MM")}
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-light text-gray-500 dark:text-gray-400">
                    {t.creditCardTransactions}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {invoiceTransactions.length} {t.items}
                  </span>
                </div>

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
                      {invoiceStats.previousBalance !== 0 && (
                        <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            <div>
                              <div className="text-sm font-light text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                {t.previousBalance}
                                <span
                                  className="inline-flex text-gray-400 dark:text-gray-500 cursor-help"
                                  title={t.previousBalanceTooltip}
                                  aria-label={t.previousBalanceTooltip}
                                >
                                  <HelpCircle className="h-3.5 w-3.5" />
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-sm font-light text-gray-900 dark:text-white">
                            {formatCurrency(
                              invoiceStats.previousBalance,
                              baseCurrency
                            )}
                          </div>
                        </div>
                      )}

                      {invoiceTransactions.length === 0 &&
                      invoiceStats.previousBalance === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          {t.noInvoiceTransactions}
                        </div>
                      ) : (
                        <>
                          {invoiceTransactions.map((t_item: Transaction) => {
                      // Identificar transação de pagamento de fatura
                      // Verificar se tem attachmentUrl que indica pagamento
                      const isPayment = !!t_item.attachmentUrl && t_item.attachmentUrl.startsWith('invoice_pay:');
                      return (
                        <div
                          key={t_item.id}
                          className="flex items-center justify-between group hover:bg-gray-50/50 dark:hover:bg-gray-900/50 p-3 xl:p-2 -mx-2 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-light text-gray-900 dark:text-white truncate mb-1">
                                {t_item.description}
                              </div>
                              <div className="text-xs font-light text-gray-500 dark:text-gray-400 flex items-center gap-2">
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
                                  <span className="text-gray-400 dark:text-gray-500">
                                    {t_item.installmentNumber}/{t_item.totalInstallments}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 xl:gap-2 ml-4">
                            <div
                              className={`text-base font-light whitespace-nowrap ${
                                isPayment
                                  ? "text-green-500"
                                  : "text-red-500"
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

                    {/* Load More Button */}
                    {invoicePagination?.hasMore && (
                      <div className="mt-6 text-center">
                        <PageButton
                          onClick={async () => {
                            if (invoicePagination.nextCursor && selectedAccountId) {
                              await loadMoreInvoiceMutation.mutateAsync({
                                accountId: selectedAccountId,
                                month: selectedMonthKey,
                                householdId,
                                limit: 25,
                                cursor: invoicePagination.nextCursor,
                              });
                            }
                          }}
                          variant="secondary"
                          disabled={loadMoreInvoiceMutation.isPending}
                        >
                          {loadMoreInvoiceMutation.isPending ? t.loading : "Carregar mais"}
                        </PageButton>
                        {invoicePagination.total && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Mostrando {invoiceTransactions.length} de {invoicePagination.total} transações
                          </p>
                        )}
                      </div>
                    )}
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
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-6"></div>
              <div className="space-y-6">
                <div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de transações skeleton */}
          <div className="xl:col-span-2 space-y-6 order-2 xl:order-1">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800">
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
            className="fixed inset-0 bg-black/40 transition-opacity"
            onClick={() => setIsPayModalOpen(false)}
            aria-hidden="true"
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full sm:w-96 max-w-md p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800">
              <h3 className="text-xl font-light tracking-tight text-gray-900 dark:text-white mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                {t.payInvoice}
              </h3>
              <p className="text-sm font-light text-gray-600 dark:text-gray-400 mb-6">
                {t.payInvoiceDescription}{" "}
                <span className="font-light text-gray-900 dark:text-white">
                  {formatCurrency(invoiceStats.total, baseCurrency)}
                </span>
                .
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
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
                  <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
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
                      className="block w-full px-3 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 sm:text-sm font-light tracking-tight"
                    />
                  </div>
                  <p className="mt-1 text-[10px] font-light text-gray-400 dark:text-gray-500">
                    {t.paymentAmountHint}
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={handlePayInvoice}
                    disabled={!paymentSourceAccountId || paymentAmount <= 0}
                    className="w-full px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed order-1"
                  >
                    {t.confirmInvoicePayment}
                  </button>
                  <button
                    onClick={() => setIsPayModalOpen(false)}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity order-2"
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
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg w-full max-w-md p-6">
            <div className="flex items-center gap-3 text-red-500 mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-xl font-light tracking-tight text-gray-900 dark:text-white">{t.undoInvoicePayment}</h3>
            </div>
            <p className="text-sm font-light text-gray-600 dark:text-gray-400 mb-8">
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
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity order-2"
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

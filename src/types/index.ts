import { TransactionType } from '../lib/enums';

export interface TransactionSplit {
  userId: string;
  amount: number;
  accountId?: string; // Account to pay from (optional)
}

export interface Transaction {
  id?: string;
  userId?: string;
  description: string;
  amount: number;
  type: TransactionType;
  category?: string; // Display name (for lists). Optional for transfers.
  categoryName?: string; // Enum or "CUSTOM:uuid" for API and forms.
  date: Date;
  paid?: boolean; // Flag para indicar se a transação já foi paga/recebida
  accountId?: string;
  fromAccountId?: string; // Para transferências
  toAccountId?: string; // Para transferências
  relatedEntityId?: string; // Para alocações (ID do cartão de crédito)
  isSplit?: boolean; // Indica se a transação é dividida entre membros
  splits?: TransactionSplit[]; // Array de splits quando isSplit é true
  recurringTransactionId?: string;
  installmentId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  attachmentUrl?: string;
  notes?: string;
}

export interface Category {
  id?: string;
  userId?: string;
  name: string;
  description?: string;
}

export interface CategoryData {
  name: string;
  receita: number;
  despesa: number;
  total: number;
}

export interface MonthlyComparison {
  month: string;
  receita: number;
  despesa: number;
  saldo: number;
}

export interface Budget {
  id?: string;
  userId?: string;
  category: string;
  categoryName?: string; // Enum or "CUSTOM:uuid" for API and forms.
  amount: number;
  month: Date;
  type: TransactionType;
}

export interface RecurringTransaction {
  id?: string;
  userId?: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  categoryName?: string; // Enum or "CUSTOM:uuid" for API and forms.
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  nextDueDate: Date;
  accountId?: string;
  isActive: boolean;
}

import { AccountType } from '../constants/accountTypes';

export interface Account {
  id?: string;
  userId?: string;
  name: string;
  type: AccountType;
  balance: number; // Legacy field - mantido para compatibilidade
  totalBalance?: number; // Saldo total (available + allocated)
  availableBalance?: number; // Saldo disponível para uso
  allocatedBalance?: number; // Saldo alocado como garantia
  color?: string;
  icon?: string;
  // Campos específicos para cartões de crédito
  creditLimit?: number; // Limite do cartão
  totalLimit?: number; // Limite total (creditLimit + allocatedBalance)
  availableLimit?: number; // Limite disponível (totalLimit - dívida atual)
  dueDay?: number; // Dia de vencimento da fatura (1-31)
  closingDay?: number; // Dia de fechamento da fatura (1-31)
  bestDayOffset?: number; // Dias antes do vencimento para o melhor dia de compra (1-30)
  linkedAccountId?: string; // ID da conta bancária vinculada (para herdar cor)
  // Campos para contas compartilhadas
  isPersonal?: boolean; // true se for conta pessoal compartilhada
  accountOwnerId?: string | null; // ID do dono da conta (null para contas da household, userId para contas compartilhadas)
}

export interface SavingsGoal {
  id?: string;
  userId?: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: Date;
  accountId?: string;
}

import { User } from 'firebase/auth';
import type { AuthMode } from '../config/authMode';

export interface AuthContextType {
  currentUser: User | null;
  /** How the backend signs users in; 'firebase' until GET /auth/config answers. */
  authMode: AuthMode;
  /** False when a local-mode backend has closed sign-ups. */
  registrationEnabled: boolean;
  signup: (email: string, password: string, referralCode?: string) => Promise<{ user: User }>;
  login: (email: string, password: string) => Promise<{ user: User }>;
  loginWithGoogle: (referralCode?: string) => Promise<{ user: User }>;
  logout: () => Promise<void>;
}

/** Minimal custom category for display/color/icon resolution. */
export interface CustomCategoryInfo {
  id: string;
  name: string;
  type?: string;
  color?: string | null;
  icon?: string | null;
}

export interface TransactionsContextType {
  transactions: Transaction[];
  categories: Category[];
  /** Custom categories (isSystem=false) for resolution in getCategoryDisplayName, etc. */
  customCategories: CustomCategoryInfo[];
  budgets: Budget[];
  recurringTransactions: RecurringTransaction[];
  accounts: Account[];
  savingsGoals: SavingsGoal[];
  loading: boolean;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'userId'>) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addBudget: (budget: Omit<Budget, 'id' | 'userId'>) => Promise<void>;
  updateBudget: (id: string, budget: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  addRecurringTransaction: (recurring: Omit<RecurringTransaction, 'id' | 'userId'>) => Promise<string>;
  updateRecurringTransaction: (id: string, recurring: Partial<RecurringTransaction>) => Promise<void>;
  deleteRecurringTransaction: (id: string) => Promise<void>;
  addAccount: (account: Omit<Account, 'id' | 'userId'>) => Promise<void>;
  updateAccount: (id: string, account: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string, deleteTransactions?: boolean) => Promise<void>;
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id' | 'userId'>) => Promise<void>;
  updateSavingsGoal: (id: string, goal: Partial<SavingsGoal>) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;
  createInstallments: (transaction: Omit<Transaction, 'id' | 'userId'>, installments: number) => Promise<void>;
  createTransfer: (data: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    date: Date;
    notes?: string;
  }) => Promise<void>;
  exportToCSV: () => void;
  processRecurringTransactions: () => Promise<void>;
}

export type WidgetId = 
  | 'creditCards'
  | 'trends'
  | 'forecast'
  | 'savingsGoals'
  | 'projectedBalance'
  | 'balanceEvolution'
  | 'monthlyComparison'
  | 'insights'
  | 'budgetVsRealized'
  | 'fixedVsVariable'
  | 'dailyCashFlow'
  | 'spendingHeatmap';

export interface WidgetConfig {
  id: WidgetId;
  enabled: boolean;
  order: number;
}

export interface DashboardPreferences {
  widgets: WidgetConfig[];
  updatedAt?: Date;
}


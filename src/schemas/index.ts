import { z } from 'zod';
import { sanitizeString, sanitizeNumber } from '../utils/sanitize';
import { Translations } from '../context/I18nContext';
import { CurrencyCode } from '../context/CurrencyContext';
import { RecurrenceFrequency, AccountType, TransactionType } from '../lib/enums';

// Factory function to create schemas with i18n support
export const createSchemas = (t: Translations) => {
  // Helper to sanitize string fields - apply validation first, then sanitize
  const sanitizeStringField = (maxLength: number = 500, requiredMessage?: string) =>
    z.string().min(1, requiredMessage || t.fieldRequired).max(maxLength, t.nameTooLong).transform((val) => sanitizeString(val, maxLength));

  // Helper for optional string fields
  const sanitizeOptionalStringField = (maxLength: number = 500) =>
    z.string().max(maxLength, t.nameTooLong).optional().or(z.literal('')).transform((val) => {
      if (!val || val === '') return '';
      return sanitizeString(val, maxLength);
    });

  // Transaction Schema
  const transactionSchema = z.object({
    description: sanitizeOptionalStringField(500),
    amount: z.number().positive(t.amountMustBePositive).transform((val) => sanitizeNumber(val, 1e15)),
    type: z.nativeEnum(TransactionType, {
      required_error: t.typeRequired,
    }),
    category: sanitizeStringField(100, t.categoryRequired).optional().or(z.literal('')), // Optional for transfers
    date: z.union([z.date(), z.string()]).transform((val: Date | string) => {
      if (val instanceof Date) return val;
      return new Date(val);
    }),
    paid: z.boolean().optional().default(true), // Por padrão, assume como pago
    accountId: z.string().optional().transform((val) => val ? sanitizeString(val, 100) : '').or(z.literal('')),
    // Transfer fields
    fromAccountId: z.string().optional().transform((val) => val ? sanitizeString(val, 100) : '').or(z.literal('')),
    toAccountId: z.string().optional().transform((val) => val ? sanitizeString(val, 100) : '').or(z.literal('')),
    installments: z.number().int().min(1, t.installmentsMin).max(120, t.installmentsMax).default(1),
  })
    .refine((data) => {
      // If type is TRANSFER, fromAccountId and toAccountId are required
      if (data.type === TransactionType.TRANSFER) {
        return !!data.fromAccountId && !!data.toAccountId && data.fromAccountId !== data.toAccountId;
      }
      return true;
    }, {
      message: t.fromAccountRequired || 'Contas de origem e destino são obrigatórias para transferências',
      path: ['fromAccountId'],
    })
    .refine((data) => {
      // If type is INCOME or EXPENSE, category is required
      if (data.type === TransactionType.INCOME || data.type === TransactionType.EXPENSE) {
        return !!data.category;
      }
      return true;
    }, {
      message: t.categoryRequired,
      path: ['category'],
    })
    .refine((data) => {
      // If type is INCOME or EXPENSE, accountId is required
      if (data.type === TransactionType.INCOME || data.type === TransactionType.EXPENSE) {
        return !!data.accountId && data.accountId !== '';
      }
      return true;
    }, {
      message: 'Por favor, selecione uma conta ou cartão para movimentar. Não é possível criar transações sem uma conta associada.',
      path: ['accountId'],
    });

  // Recurring Transaction Schema
  const recurringTransactionSchema = z.object({
    description: sanitizeStringField(500, t.descriptionRequired),
    amount: z.number().positive(t.amountMustBePositive).transform((val) => sanitizeNumber(val, 1e15)),
    type: z.nativeEnum(TransactionType, {
      required_error: t.typeRequired,
    }),
    category: sanitizeStringField(100, t.categoryRequired),
    frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly']).transform((val) => {
      // Convert lowercase to enum value
      return val.toUpperCase() as RecurrenceFrequency;
    }).or(z.nativeEnum(RecurrenceFrequency)),
    startDate: z.union([z.date(), z.string()]).transform((val: Date | string) => {
      if (val instanceof Date) return val;
      return new Date(val);
    }),
    endDate: z.union([z.date(), z.string()]).optional().transform((val?: Date | string) => {
      if (!val) return undefined;
      if (val instanceof Date) return val;
      return new Date(val);
    }),
    nextDueDate: z.union([z.date(), z.string()]).transform((val: Date | string) => {
      if (val instanceof Date) return val;
      return new Date(val);
    }),
    accountId: z.string().optional().transform((val) => val ? sanitizeString(val, 100) : '').or(z.literal('')),
    isActive: z.boolean().default(true),
  });

  // Budget Schema
  const budgetSchema = z.object({
    category: sanitizeStringField(100, t.categoryRequired),
    amount: z.number().positive(t.amountMustBePositive).transform((val) => sanitizeNumber(val, 1e15)),
    type: z.nativeEnum(TransactionType, {
      required_error: t.typeRequired,
    }),
    month: z.union([z.date(), z.string()]).transform((val: Date | string) => {
      if (val instanceof Date) return val;
      if (typeof val === 'string' && val.includes('-')) {
        return new Date(val + '-01');
      }
      return new Date(val);
    }),
  });

  // Account Schema - usando enum para corresponder ao backend
  const accountSchema = z.object({
    name: sanitizeStringField(100, t.nameRequired),
    type: z.nativeEnum(AccountType).or(z.enum(['CHECKING', 'SAVINGS', 'CREDIT', 'CASH', 'INVESTMENT']).transform((val) => val as AccountType)),
    balance: z.number().default(0).transform((val) => sanitizeNumber(val, 1e15)),
    color: z.string().regex(/^#[0-9A-F]{6}$/i, t.invalidColor).default('#3b82f6'),
    creditLimit: z.union([
      z.number().positive(t.limitMustBePositive).transform((val) => sanitizeNumber(val, 1e15)),
      z.null(),
      z.undefined(),
    ]).optional().transform((val) => val === null || val === undefined ? undefined : val),
    dueDay: z.union([
      z.number().int().min(1, t.dueDayMin).max(31, t.dueDayMax),
      z.null(),
      z.undefined(),
    ]).optional().transform((val) => val === null || val === undefined ? undefined : val),
    closingDay: z.union([
      z.number().int().min(1, t.dueDayMin).max(31, t.dueDayMax),
      z.null(),
      z.undefined(),
    ]).optional().transform((val) => val === null || val === undefined ? undefined : val),
    linkedAccountId: z.string().uuid().optional().nullable(),
  }).refine((data) => {
    // Se for cartão de crédito e tiver creditLimit definido, deve ser positivo
    if (data.type === AccountType.CREDIT && data.creditLimit !== undefined && data.creditLimit !== null && data.creditLimit <= 0) {
      return false;
    }
    return true;
  }, {
    message: t.cardLimitMustBePositive,
    path: ['creditLimit'],
  });

  // Savings Goal Schema
  const savingsGoalSchema = z.object({
    name: sanitizeStringField(100, t.nameRequired),
    targetAmount: z.number().positive(t.targetAmountMustBePositive).transform((val) => sanitizeNumber(val, 1e15)),
    currentAmount: z.number().min(0, t.currentAmountCannotBeNegative).default(0).transform((val) => sanitizeNumber(val, 1e15)),
    targetDate: z.union([z.date(), z.string()]).optional().transform((val?: Date | string) => {
      if (!val) return undefined;
      if (val instanceof Date) return val;
      return new Date(val);
    }),
    accountId: z.string().optional().transform((val) => val ? sanitizeString(val, 100) : '').or(z.literal('')),
  });

  // Login Schema
  const loginSchema = z.object({
    email: z.string().email(t.invalidEmail),
    password: z.string().min(6, t.invalidPassword),
  });

  // Onboarding Schemas
  const localeSchema = z.object({
    locale: z.enum(['pt-BR', 'en-US', 'es-ES', 'ja-JP', 'ru-RU', 'zh-CN', 'fr-FR', 'ar-SA'], {
      required_error: t.localeRequired,
    }),
  });

  const nameSchema = z.object({
    displayName: z.string().min(1, t.displayNameRequired).max(50, t.displayNameTooLong),
  });

  const countryCurrencySchema = z.object({
    country: z.string().min(1, t.countryRequired),
    currency: z.string().min(1, t.currencyRequired) as z.ZodType<CurrencyCode>,
  });

  const onboardingAccountSchema = z.object({
    accountName: z.string().max(100, t.accountNameTooLong).optional().or(z.literal('')),
    accountType: z.nativeEnum(AccountType).or(z.enum(['CHECKING', 'SAVINGS', 'CREDIT', 'CASH', 'INVESTMENT']).transform((val) => val as AccountType)),
    balance: z.number().default(0).transform((val) => sanitizeNumber(val, 1e15)),
    creditLimit: z.number().positive(t.limitMustBePositive).optional().transform((val) => val !== undefined ? sanitizeNumber(val, 1e15) : undefined),
    dueDay: z.number().int().min(1, t.dueDayMin).max(31, t.dueDayMax).optional(),
  }).refine((data) => {
    // Se for cartão de crédito, limite é recomendado mas não obrigatório
    if (data.accountType === AccountType.CREDIT && data.creditLimit && data.creditLimit <= 0) {
      return false;
    }
    return true;
  }, {
    message: t.cardLimitMustBePositive,
    path: ['creditLimit'],
  });

  const onboardingRecurringSchema = z.object({
    description: z.string().max(500, t.descriptionTooLong).optional().or(z.literal('')),
    amount: z.number().min(0).optional(),
    accountId: z.string().optional(),
  });

  const onboardingBudgetSchema = z.object({
    category: z.string().max(100, t.categoryTooLong).optional().or(z.literal('')),
    amount: z.number().min(0).optional(),
  });

  return {
    transactionSchema,
    recurringTransactionSchema,
    budgetSchema,
    accountSchema,
    savingsGoalSchema,
    loginSchema,
    localeSchema,
    nameSchema,
    countryCurrencySchema,
    onboardingAccountSchema,
    onboardingRecurringSchema,
    onboardingBudgetSchema,
  };
};

// Export types
export type TransactionFormData = z.infer<ReturnType<typeof createSchemas>['transactionSchema']>;
export type RecurringTransactionFormData = z.infer<ReturnType<typeof createSchemas>['recurringTransactionSchema']>;
export type BudgetFormData = z.infer<ReturnType<typeof createSchemas>['budgetSchema']>;
export type AccountFormData = z.infer<ReturnType<typeof createSchemas>['accountSchema']>;
export type SavingsGoalFormData = z.infer<ReturnType<typeof createSchemas>['savingsGoalSchema']>;
export type LoginFormData = z.infer<ReturnType<typeof createSchemas>['loginSchema']>;
export type LocaleFormData = z.infer<ReturnType<typeof createSchemas>['localeSchema']>;
export type NameFormData = z.infer<ReturnType<typeof createSchemas>['nameSchema']>;
export type CountryCurrencyFormData = z.infer<ReturnType<typeof createSchemas>['countryCurrencySchema']>;
export type OnboardingAccountFormData = z.infer<ReturnType<typeof createSchemas>['onboardingAccountSchema']>;
export type OnboardingRecurringFormData = z.infer<ReturnType<typeof createSchemas>['onboardingRecurringSchema']>;
export type OnboardingBudgetFormData = z.infer<ReturnType<typeof createSchemas>['onboardingBudgetSchema']>;

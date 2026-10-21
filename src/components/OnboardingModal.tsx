import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useCurrency, CurrencyCode, CURRENCY_LIST } from '../context/CurrencyContext';
import { useTransactions } from '../context/TransactionsContext';
import { useReferral } from '../hooks/useReferral';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import { useToastContext } from '../context/ToastContext';
import { useI18n, Locale } from '../context/I18nContext';
import { useConfetti } from '../context/ConfettiContext';
import { analyticsHelpers } from '../utils/analytics';
import { useUser, useUpdateUserPreferences } from '../hooks/api/useUsers';
import { addMonths, isSameMonth } from 'date-fns';
import { ChevronRight, ChevronLeft, Sun, Moon } from 'lucide-react';
import SelectCombobox from './SelectCombobox';
import { useTheme } from '../context/ThemeContext';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { COUNTRIES, COUNTRY_CURRENCY_MAP, LANGUAGES } from '../utils/onboardingData';
import { getCategoriesByType, getCategoryDisplayName, CategoryType } from '../lib/enums';
import { createSchemas, LocaleFormData, NameFormData, CountryCurrencyFormData, OnboardingAccountFormData, OnboardingRecurringFormData, OnboardingBudgetFormData } from '../schemas';
import { getAccountTypeLabel as getAccountTypeLabelHelper } from '../constants/accountTypes';
import { AccountType, TransactionType } from '../lib/enums';
import {
  OnboardingStep5Accounts,
  OnboardingStep6Recurring,
  OnboardingStep7Budgets,
  OnboardingStep8Invite,
} from './onboarding/steps';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const OnboardingModal = memo(({ isOpen, onComplete }: OnboardingModalProps) => {
  const { currentUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { setBaseCurrency, baseCurrency } = useCurrency();
  const { addAccount, addRecurringTransaction, addBudget, accounts, recurringTransactions, budgets, customCategories } = useTransactions();
  const { getInviteLink, referralCode, loading: referralLoading } = useReferral();
  const { success, error: showError } = useToastContext();
  const { locale, setLocale, t } = useI18n();
  const { showConfetti } = useConfetti();
  const { data: user } = useUser();
  const updatePreferences = useUpdateUserPreferences();
  const queryClient = useQueryClient();
  const { householdId } = useDefaultHousehold();
  
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  // Memoizar schemas para evitar recriação em cada render
  const schemas = useMemo(() => createSchemas(t), [t]);
  const { 
    localeSchema, 
    nameSchema, 
    countryCurrencySchema, 
    onboardingAccountSchema, 
    onboardingRecurringSchema, 
    onboardingBudgetSchema 
  } = schemas;
  
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Rastrear quais etapas já foram completadas para evitar duplicatas
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  
  // Estado para o link de convite que será atualizado quando o referralCode estiver disponível
  const [inviteLink, setInviteLink] = useState<string>('');
  
  // Atualizar o link quando o referralCode estiver disponível
  useEffect(() => {
    if (referralCode && !referralLoading) {
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/login?ref=${referralCode}`;
      setInviteLink(link);
    } else if (!referralLoading && !referralCode) {
      // Se não estiver carregando e não tiver código, limpar o link
      setInviteLink('');
    }
  }, [referralCode, referralLoading]);
  
  // Refetch accounts quando o modal voltar ao step 5 (onde contas são criadas)
  useEffect(() => {
    if (isOpen && currentStep === 5 && householdId) {
      // Garantir que as contas sejam refetchadas quando voltar ao step 5
      queryClient.refetchQueries({ 
        queryKey: ['accounts', { householdId }],
        exact: false 
      });
    }
  }, [isOpen, currentStep, householdId, queryClient]);

  // Verificar se já existem dados para permitir pular etapas
  const hasExistingAccounts = Array.isArray(accounts) && accounts.length > 0;
  const hasExistingRecurring = (recurringTransactions?.length ?? 0) > 0;
  
  // Filtrar contas bancárias para recorrências (excluir cartões de crédito e investimentos)
  const bankAccountsForRecurring = useMemo(() => {
    if (!accounts || !Array.isArray(accounts)) return [];
    return accounts.filter(account => 
      account.type !== AccountType.CREDIT && 
      account.type !== AccountType.INVESTMENT
    );
  }, [accounts]);
  const currentMonthBudgets = useMemo(() => {
    if (!budgets || !Array.isArray(budgets)) return [];
    const now = new Date();
    return budgets.filter(budget => isSameMonth(new Date(budget.month), now));
  }, [budgets]);
  const hasExistingBudgets = (budgets?.length ?? 0) > 0;
  
  // Função auxiliar memoizada para obter labels - usando constantes
  const getAccountTypeLabel = useCallback((type: string) => {
    return getAccountTypeLabelHelper(type as AccountType, t as any);
  }, [t]);
  
  const getFrequencyLabel = useCallback((frequency: string) => {
    switch (frequency) {
      case 'daily': return t.daily;
      case 'weekly': return t.weekly;
      case 'biweekly': return t.biweekly;
      case 'monthly': return t.monthly;
      case 'yearly': return t.yearly;
      default: return frequency;
    }
  }, [t]);
  
  // Form definitions
  const localeForm = useForm<LocaleFormData>({
    resolver: zodResolver(localeSchema),
    defaultValues: { locale: 'pt-BR' },
  });
  
  const countryForm = useForm<CountryCurrencyFormData>({
    resolver: zodResolver(countryCurrencySchema),
    defaultValues: { country: 'BR', currency: 'BRL' },
  });
  
  const nameForm = useForm<NameFormData>({
    resolver: zodResolver(nameSchema),
    defaultValues: { displayName: '' },
  });
  
  const accountForm = useForm<OnboardingAccountFormData>({
    resolver: zodResolver(onboardingAccountSchema),
    defaultValues: { accountName: '', accountType: AccountType.CHECKING, balance: 0, creditLimit: undefined, dueDay: undefined },
  });
  const accountCurrencyMask = useCurrencyMask();
  const creditLimitCurrencyMask = useCurrencyMask();
  
  const recurringForm = useForm<OnboardingRecurringFormData>({
    resolver: zodResolver(onboardingRecurringSchema),
    defaultValues: { description: t.salary, amount: 0 },
  });
  const recurringCurrencyMask = useCurrencyMask();
  const [recurringAccountId, setRecurringAccountId] = useState<string>('');
  
  const budgetForm = useForm<OnboardingBudgetFormData>({
    resolver: zodResolver(onboardingBudgetSchema),
    defaultValues: { category: t.generalCategory, amount: 0 },
  });
  const budgetCurrencyMask = useCurrencyMask();

  // useWatch para performance - evita re-render do componente todo quando os campos mudam
  const watchedLocale = useWatch({ control: localeForm.control, name: 'locale' });
  const watchedCountry = useWatch({ control: countryForm.control, name: 'country' });
  const watchedCurrency = useWatch({ control: countryForm.control, name: 'currency' });

  // Categorias disponíveis para o onboarding (apenas categorias de despesa, já que orçamentos são sempre EXPENSE)
  const onboardingCategoryOptions = useMemo(() => {
    // Filtrar apenas categorias de despesa (EXPENSE) para o onboarding de orçamentos
    const expenseCategories = getCategoriesByType(CategoryType.EXPENSE);
    const categoryOptions = expenseCategories.map(catName => {
      const displayName = getCategoryDisplayName(catName, t as unknown as Record<string, string>);
      return { value: displayName, label: displayName };
    });
    
    // Adicionar também categorias customizadas de despesa, se houver
    const customExpenseCategories = (customCategories || []).filter(cat => cat.type === CategoryType.EXPENSE);
    const customOptions = customExpenseCategories.map(cat => ({ value: cat.name, label: cat.name }));
    
    // Combinar todas as opções e remover duplicatas
    const allOptions = [...categoryOptions, ...customOptions];
    const uniqueOptions = Array.from(
      new Map(allOptions.map(opt => [opt.value, opt])).values()
    );
    
    // Filtrar a opção "Geral" se existir
    const filteredOptions = uniqueOptions.filter(opt => opt.value !== t.generalCategory);
    
    return [
      { value: t.generalCategory, label: t.generalCategory },
      ...filteredOptions.sort((a, b) => a.label.localeCompare(b.label))
    ];
  }, [t, customCategories]);

  // Resetar para o primeiro passo apenas quando o modal for aberto vindo de um estado fechado
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setCurrentStep(1);
      setCompletedSteps(new Set()); // Resetar etapas completadas
      
      // Aguardar um pouco para garantir que os dados do usuário sejam carregados primeiro
      // Se houver dados do usuário, eles serão carregados pelo useEffect abaixo
      // Se não houver, resetar para valores padrão
      setTimeout(() => {
        // Só resetar se não houver dados do usuário carregados
        if (!user?.locale && !user?.country && !user?.displayName) {
          accountForm.reset({
            accountName: '',
            accountType: AccountType.CHECKING,
            balance: 0,
            creditLimit: undefined,
            dueDay: undefined,
          });
          recurringForm.reset({
            description: t.salary,
            amount: 0,
            accountId: undefined,
          });
          budgetForm.reset({
            category: t.generalCategory,
            amount: 0,
          });
          accountCurrencyMask.setValue('');
          creditLimitCurrencyMask.setValue('');
          recurringCurrencyMask.setValue('');
          budgetCurrencyMask.setValue('');
          setRecurringAccountId('');
        }
        analyticsHelpers.logOnboardingStarted();
      }, 200);
    }
    prevIsOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  // Gerenciamento de foco ao mudar de etapa (Acessibilidade)
  useEffect(() => {
    if (isOpen) {
      stepHeadingRef.current?.focus();
    }
  }, [currentStep, isOpen]);

  // Prevenir scroll do body quando modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;
    
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Carregar dados do usuário se existirem (executar ANTES do reset)
  const hasLoadedUserData = useRef(false);
  useEffect(() => {
    if (!user || !isOpen) return;
    
    // Carregar locale
    if (user.locale) {
      localeForm.setValue('locale', user.locale as Locale, { shouldDirty: false });
    }
    
    // Carregar country e currency
    if (user.country) {
      countryForm.setValue('country', user.country, { shouldValidate: true, shouldDirty: false });
      const currency = COUNTRY_CURRENCY_MAP[user.country] || user.baseCurrency || 'BRL';
      countryForm.setValue('currency', currency as CurrencyCode, { shouldValidate: true, shouldDirty: false });
    } else if (user.baseCurrency) {
      // Se não tem country mas tem currency, usar a currency
      countryForm.setValue('currency', user.baseCurrency as CurrencyCode, { shouldValidate: true, shouldDirty: false });
    }
    
    // Carregar displayName
    if (user.displayName) {
      nameForm.setValue('displayName', user.displayName, { shouldDirty: false });
    }
    
    hasLoadedUserData.current = true;
  }, [user, isOpen, localeForm, countryForm, nameForm]);

  // Resetar flag quando modal fechar
  useEffect(() => {
    if (!isOpen) {
      hasLoadedUserData.current = false;
    }
  }, [isOpen]);

  // Atualizar moeda quando país mudar (apenas se não foi carregado do backend)
  useEffect(() => {
    // Só atualizar se o país foi mudado pelo usuário, não se foi carregado do backend
    if (hasLoadedUserData.current) {
      hasLoadedUserData.current = false; // Resetar após primeira execução
      return;
    }
    if (watchedCountry && COUNTRY_CURRENCY_MAP[watchedCountry]) {
      const currency = COUNTRY_CURRENCY_MAP[watchedCountry];
      countryForm.setValue('currency', currency);
    }
  }, [watchedCountry, countryForm]);

  // Atualizar accountId quando contas bancárias forem criadas (para recorrências)
  useEffect(() => {
    if (bankAccountsForRecurring && bankAccountsForRecurring.length > 0 && currentStep >= 5) {
      setRecurringAccountId(bankAccountsForRecurring[0].id || '');
    }
  }, [bankAccountsForRecurring, currentStep]);

  // Inicializar localeForm com o locale atual
  useEffect(() => {
    if (isOpen && locale) {
      // shouldDirty: false para não marcar como alterado quando apenas inicializando
      localeForm.setValue('locale', locale, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, locale]);

  const handleStepChange = (newStep: Step) => {
    setIsTransitioning(true);
    
    // Se voltando para uma etapa que já foi completada, resetar o formulário
    if (newStep < currentStep) {
      if (newStep === 5 && completedSteps.has(5)) {
        accountForm.reset({
          accountName: '',
          accountType: AccountType.CHECKING,
          balance: 0,
          creditLimit: undefined,
          dueDay: undefined,
        });
        accountCurrencyMask.setValue('');
        creditLimitCurrencyMask.setValue('');
      } else if (newStep === 6 && completedSteps.has(6)) {
        recurringForm.reset({
          description: t.salary,
          amount: 0,
          accountId: undefined,
        });
        recurringCurrencyMask.setValue('');
        setRecurringAccountId('');
      } else if (newStep === 7 && completedSteps.has(7)) {
        budgetForm.reset({
          category: t.generalCategory,
          amount: 0,
        });
        budgetCurrencyMask.setValue('');
      }
    }
    
    setTimeout(() => {
      setCurrentStep(newStep);
      setIsTransitioning(false);
    }, 200);
  };

  const handleStep1Submit = async (data: { locale: Locale }) => {
    if (!currentUser) return;
    
    try {
      // Só atualizar se o locale realmente mudou
      if (data.locale !== user?.locale) {
        setLocale(data.locale);
        await updatePreferences.mutateAsync({ locale: data.locale });
      }
      
      analyticsHelpers.logOnboardingStepCompleted(1, 'language');
      handleStepChange(2);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.errorSavingLanguage;
      showError(message);
    }
  };

  const handleStep2Next = () => {
    analyticsHelpers.logOnboardingStepCompleted(2, 'theme');
    handleStepChange(3);
  };

  const handleStep3Submit = async (data: { country: string; currency: CurrencyCode }) => {
    if (!currentUser) return;
    
    try {
      // Só atualizar se realmente mudou
      const hasChanges = data.country !== user?.country || data.currency !== user?.baseCurrency;
      if (hasChanges) {
        await updatePreferences.mutateAsync({
          country: data.country,
          currency: data.currency,
        });
      }
      
      setBaseCurrency(data.currency);
      analyticsHelpers.logOnboardingStepCompleted(3, 'country_currency');
      handleStepChange(4);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.errorSavingCountry;
      showError(message);
    }
  };

  const handleStep4Submit = async (data: { displayName: string }) => {
    if (!currentUser) return;
    
    try {
      // Só atualizar se realmente mudou
      if (data.displayName !== user?.displayName) {
        await updatePreferences.mutateAsync({ displayName: data.displayName });
      }
      
      analyticsHelpers.logOnboardingStepCompleted(4, 'display_name');
      handleStepChange(5);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.errorSavingName;
      showError(message);
    }
  };

  const handleStep5Submit = async (data: OnboardingAccountFormData) => {
    try {
      // Se já existem contas, pode pular criando uma nova ou apenas avançar
      if (data.accountName) {
        // Verificar se já existe uma conta com o mesmo nome e tipo
        const duplicateAccount = accounts?.find(
          acc => acc.name === data.accountName && acc.type === data.accountType
        );
        
        if (duplicateAccount) {
          showError(t.accountAlreadyExists);
          return;
        }
        
        await addAccount({
          name: data.accountName,
          type: data.accountType,
          balance: data.balance,
          color: '#3b82f6',
          ...(data.accountType === 'CREDIT' && {
            creditLimit: data.creditLimit,
            dueDay: data.dueDay,
          }),
        });
        
        // Aguardar que as queries sejam refetchadas e que o cache seja atualizado
        // O addAccount já aguarda o refetch, mas vamos garantir que o estado esteja sincronizado
        // Verificar diretamente no cache do React Query se a conta foi criada
        if (householdId) {
          let retries = 0;
          const maxRetries = 10;
          while (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 100));
            const accountsData = queryClient.getQueryData(['accounts', { householdId }]) as any;
            if (accountsData) {
              const accountsArray = Array.isArray(accountsData) 
                ? accountsData 
                : accountsData?.accounts || [];
              const createdAccount = accountsArray.find(
                (acc: any) => acc.name === data.accountName && acc.type === data.accountType
              );
              if (createdAccount) {
                break;
              }
            }
            retries++;
          }
        } else {
          // Se não há householdId, aguardar um pouco para o estado atualizar
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        success(t.accountCreated);
        
        // Marcar etapa como completada e limpar formulário
        setCompletedSteps(prev => new Set(prev).add(5));
        accountForm.reset({
          accountName: '',
          accountType: AccountType.CHECKING,
          balance: 0,
          creditLimit: undefined,
          dueDay: undefined,
        });
        accountCurrencyMask.setValue('');
        creditLimitCurrencyMask.setValue('');
      }
      analyticsHelpers.logOnboardingStepCompleted(5, 'initial_account');
      handleStepChange(6);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.errorCreatingAccount;
      showError(message);
    }
  };

  const handleStep6Submit = async (data: OnboardingRecurringFormData) => {
    try {
      // Se já existem recorrências, pode pular criando uma nova ou apenas avançar
      if (data.description && data.amount && data.amount > 0) {
        // Se não há contas bancárias disponíveis, apenas avançar sem criar recorrência
        // O usuário pode criar recorrências depois no app
        if (!bankAccountsForRecurring || bankAccountsForRecurring.length === 0) {
          // Não bloquear, apenas avançar para próximo passo
          analyticsHelpers.logOnboardingStepCompleted(6, 'initial_recurring_skipped_no_account');
          handleStepChange(7);
          return;
        }

        const resolvedAccountId = data.accountId || bankAccountsForRecurring?.[0]?.id;
        if (!resolvedAccountId) {
          // Não bloquear, apenas avançar para próximo passo
          analyticsHelpers.logOnboardingStepCompleted(6, 'initial_recurring_skipped_no_account');
          handleStepChange(7);
          return;
        }
        
        // Verificar se já existe uma recorrência com a mesma descrição e valor
        const duplicateRecurring = recurringTransactions?.find(
          rec => rec.description === data.description && 
                 rec.amount === data.amount && 
                 rec.frequency === 'monthly'
        );
        
        if (duplicateRecurring) {
          showError(t.recurringAlreadyExists);
          return;
        }
        
        const today = new Date();
        const nextMonth = addMonths(today, 1);
        
        try {
        await addRecurringTransaction({
          description: data.description,
          amount: data.amount,
          type: TransactionType.INCOME,
          category: t.salary,
          frequency: 'monthly',
          startDate: today,
          nextDueDate: nextMonth,
          accountId: resolvedAccountId,
          isActive: true,
        });
          
          success(t.recurringCreated);
          
          // Marcar etapa como completada e limpar formulário
          setCompletedSteps(prev => new Set(prev).add(6));
          recurringForm.reset({
            description: t.salary,
            amount: 0,
            accountId: undefined,
          });
          recurringCurrencyMask.setValue('');
          setRecurringAccountId('');
        } catch (recurringError: unknown) {
          const errorMessage = recurringError instanceof Error 
            ? recurringError.message 
            : t.errorCreatingRecurring || 'Erro ao criar recorrência';
          showError(errorMessage);
          return; // Não avançar para próxima etapa se houver erro
        }
      }
      
      analyticsHelpers.logOnboardingStepCompleted(6, 'initial_recurring');
      handleStepChange(7);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.errorCreatingRecurring;
      showError(message);
    }
  };

  const handleStep7Submit = async (data: OnboardingBudgetFormData) => {
    try {
      // Se já existem orçamentos, pode pular criando um novo ou apenas avançar
      if (data.category && data.amount && data.amount > 0) {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        
        // Verificar se já existe um orçamento para a mesma categoria no mesmo mês
        const duplicateBudget = currentMonthBudgets.find(
          budget => budget.category === data.category && 
                   isSameMonth(new Date(budget.month), currentMonth)
        );
        
        if (duplicateBudget) {
          showError(t.budgetAlreadyExists);
          return;
        }
        
        await addBudget({
          category: data.category,
          amount: data.amount,
          type: TransactionType.EXPENSE,
          month: currentMonth,
        });
        
        success(t.budgetCreated);
        
        // Marcar etapa como completada e limpar formulário
        setCompletedSteps(prev => new Set(prev).add(7));
        budgetForm.reset({
          category: t.generalCategory,
          amount: 0,
        });
        budgetCurrencyMask.setValue('');
      }
      analyticsHelpers.logOnboardingStepCompleted(7, 'initial_budget');
      handleStepChange(8);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.errorCreatingBudget;
      showError(message);
    }
  };

  const handleComplete = async () => {
    if (!currentUser) return;
    
    try {
      await updatePreferences.mutateAsync({ onboardingCompleted: true });
      
      // Aguardar que a query do usuário seja atualizada para garantir sincronização
      await queryClient.refetchQueries({ queryKey: ['users', 'me'] });
      await queryClient.refetchQueries({ queryKey: ['auth', 'me'] });
      
      analyticsHelpers.logOnboardingCompleted();
      // Disparar confetti antes de fechar o modal
      showConfetti();
      
      // Pequeno delay para o confetti aparecer antes de fechar
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.errorFinishingOnboarding;
      showError(message);
    }
  };

  const handleSkip = () => {
    const stepNames: Record<number, string> = {
      5: 'initial_account',
      6: 'initial_recurring',
      7: 'initial_budget',
      8: 'referral'
    };
    analyticsHelpers.logOnboardingSkipped(currentStep, stepNames[currentStep] || 'unknown');

    if (currentStep < 8) {
      handleStepChange((currentStep + 1) as Step);
    } else {
      handleComplete();
    }
  };

  const handleCopyLink = () => {
    const link = getInviteLink();
    if (link) {
      navigator.clipboard.writeText(link);
      setLinkCopied(true);
      success(t.inviteLinkCopied);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const canGoBack = currentStep > 1;
  // Removido canSkip - quando há dados existentes, o botão "Próximo" já faz a mesma coisa
  // O botão "Pular" só aparece no step 8 (último passo)
  const canSkip = currentStep === 8;

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-gray-900 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="relative w-full max-w-2xl bg-surface-elevated max-h-[90vh] overflow-y-auto rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel">
        {/* Header - sem botão de fechar */}
        <div className="sticky top-0 bg-surface-elevated border-b border-line px-6 py-4 z-10">
            <div className="flex items-center justify-between">
              <h2 id="onboarding-title" className="text-2xl font-bold text-content">
                {t.welcome}
              </h2>
              <div className="flex items-center space-x-2" aria-hidden="true">
                <span className="text-sm text-content-tertiary">
                  {currentStep} {t.of} 8
                </span>
              </div>
            </div>
            {currentStep === 1 && (
              <p className="mt-2 text-sm text-brand font-medium">
                {t.onboardingStep1Motivational}
              </p>
            )}
            
            {/* Progress bar */}
            <div 
              className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden"
              role="progressbar"
              aria-valuenow={currentStep}
              aria-valuemin={1}
              aria-valuemax={8}
              aria-label={`${t.step} ${currentStep} ${t.of} 8`}
            >
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${(currentStep / 8) * 100}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-600 animate-pulse-slow opacity-50" />
              </div>
            </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Idioma */}
          {currentStep === 1 && (
            <form onSubmit={localeForm.handleSubmit(handleStep1Submit)} className={`space-y-6 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'} transition-all duration-300 ease-out`}>
              <div className="animate-fade-in-up">
                <h3 
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="text-xl font-semibold text-content mb-2 focus:outline-none"
                >
                  {t.onboardingStep1Title}
                </h3>
                <p className="text-content-secondary mb-4 animate-fade-in-up animate-delay-100">
                  {t.onboardingStep1Description}
                </p>
                <div className="animate-fade-in-up animate-delay-200">
                    <SelectCombobox
                      value={watchedLocale}
                      onValueChange={(value) => {
                        const newLocale = value as Locale;
                        localeForm.setValue('locale', newLocale, { shouldValidate: true });
                        // Atualizar o idioma imediatamente
                        setLocale(newLocale);
                      }}
                      options={LANGUAGES.map(lang => ({ value: lang.code, label: lang.name }))}
                      placeholder={t.selectLanguage}
                      searchable={true}
                    />
                  {localeForm.formState.errors.locale && (
                    <p className="mt-2 text-sm text-negative" role="alert">
                      {localeForm.formState.errors.locale.message}
                    </p>
                  )}
                </div>
              </div>
            </form>
          )}

          {/* Step 2: Tema */}
          {currentStep === 2 && (
            <div className={`space-y-6 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'} transition-all duration-300 ease-out`}>
              <div className="animate-fade-in-up">
                <h3 
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="text-xl font-semibold text-content mb-2 focus:outline-none"
                >
                  {t.onboardingStep2ThemeTitle}
                </h3>
                <p className="text-content-secondary mb-6 animate-fade-in-up animate-delay-100">
                  {t.onboardingStep2ThemeDescription}
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up animate-delay-200">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 group ${
                      theme === 'light' 
                        ? 'border-primary-500 bg-brand-soft' 
                        : 'border-line hover:border-primary-300 dark:hover:border-primary-700 bg-surface-elevated'
                    }`}
                  >
                    <div className={`p-4 rounded-full mb-4 transition-colors duration-200 ${
                      theme === 'light' ? 'bg-primary-500 text-white' : 'bg-surface-sunken text-content-tertiary group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40'
                    }`}>
                      <Sun className="h-8 w-8" />
                    </div>
                    <span className={`font-semibold ${theme === 'light' ? 'text-primary-900 dark:text-primary-100' : 'text-content-secondary'}`}>
                      {t.lightMode}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 group ${
                      theme === 'dark' 
                        ? 'border-primary-500 bg-brand-soft' 
                        : 'border-line hover:border-primary-300 dark:hover:border-primary-700 bg-surface-elevated'
                    }`}
                  >
                    <div className={`p-4 rounded-full mb-4 transition-colors duration-200 ${
                      theme === 'dark' ? 'bg-primary-500 text-white' : 'bg-surface-sunken text-content-tertiary group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40'
                    }`}>
                      <Moon className="h-8 w-8" />
                    </div>
                    <span className={`font-semibold ${theme === 'dark' ? 'text-primary-900 dark:text-primary-100' : 'text-content-secondary'}`}>
                      {t.darkMode}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: País e Moeda */}
          {currentStep === 3 && (
            <form onSubmit={countryForm.handleSubmit(handleStep3Submit)} className={`space-y-6 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'} transition-all duration-300 ease-out`}>
              <div className="animate-fade-in-up">
                <h3 
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="text-xl font-semibold text-content mb-2 focus:outline-none"
                >
                  {t.onboardingStep3Title}
                </h3>
                <p className="text-content-secondary mb-4 animate-fade-in-up animate-delay-100">
                  {t.onboardingStep3Description}
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label id="country-label" className="block text-sm font-medium text-content-secondary mb-2">
                      {t.countryLabel}
                    </label>
                    <div className="animate-fade-in-up animate-delay-200">
                      <SelectCombobox
                        value={watchedCountry}
                        onValueChange={(value) => countryForm.setValue('country', value, { shouldValidate: true })}
                        options={COUNTRIES.map(country => ({ value: country.code, label: country.name }))}
                        placeholder={t.selectCountry}
                        searchable={true}
                      />
                      {countryForm.formState.errors.country && (
                        <p className="mt-2 text-sm text-negative" role="alert">
                          {countryForm.formState.errors.country.message}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label id="currency-label" className="block text-sm font-medium text-content-secondary mb-2">
                      {t.currencyLabel}
                    </label>
                    <div className="animate-fade-in-up animate-delay-300">
                      <SelectCombobox
                        value={watchedCurrency}
                        onValueChange={(value) => countryForm.setValue('currency', value as CurrencyCode, { shouldValidate: true })}
                        options={CURRENCY_LIST.map(currency => ({ 
                          value: currency.code, 
                          label: `${currency.symbol} - ${currency.name} (${currency.code})` 
                        }))}
                        placeholder={t.selectCurrency}
                        searchable={true}
                      />
                      {countryForm.formState.errors.currency && (
                        <p className="mt-2 text-sm text-negative" role="alert">
                          {countryForm.formState.errors.currency.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Step 4: Nome */}
          {currentStep === 4 && (
            <form onSubmit={nameForm.handleSubmit(handleStep4Submit)} className={`space-y-6 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'} transition-all duration-300 ease-out`}>
              <div className="animate-fade-in-up">
                <h3 
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="text-xl font-semibold text-content mb-2 focus:outline-none"
                >
                  {t.onboardingStep4Title}
                </h3>
                <p className="text-content-secondary mb-4 animate-fade-in-up animate-delay-100">
                  {t.onboardingStep4Description}
                </p>
                <div className="animate-fade-in-up animate-delay-200">
                  <label htmlFor="displayName" className="sr-only">{t.displayNamePlaceholder}</label>
                  <input
                    id="displayName"
                    type="text"
                    {...nameForm.register('displayName')}
                    placeholder={t.displayNamePlaceholder}
                    className={`block w-full px-4 py-3 border rounded-lg shadow-sm bg-surface-elevated text-content focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:shadow-md ${
                      nameForm.formState.errors.displayName ? 'border-negative/60' : 'border-line'
                    }`}
                    autoFocus
                  />
                  {nameForm.formState.errors.displayName && (
                    <p className="mt-2 text-sm text-negative" role="alert">
                      {nameForm.formState.errors.displayName.message}
                    </p>
                  )}
                </div>
              </div>
            </form>
          )}

          {/* Step 5: Conta */}
          {currentStep === 5 && (
            <OnboardingStep5Accounts
              accountForm={accountForm}
              accountCurrencyMask={accountCurrencyMask}
              creditLimitCurrencyMask={creditLimitCurrencyMask}
              accounts={accounts || []}
              baseCurrency={baseCurrency || 'BRL'}
              getAccountTypeLabel={getAccountTypeLabel}
              hasExistingAccounts={hasExistingAccounts}
              isTransitioning={isTransitioning}
              stepHeadingRef={stepHeadingRef}
              onSubmit={handleStep5Submit}
            />
          )}

          {/* Step 6: Recorrência */}
          {currentStep === 6 && (
            <OnboardingStep6Recurring
              recurringForm={recurringForm}
              recurringCurrencyMask={recurringCurrencyMask}
              bankAccountsForRecurring={bankAccountsForRecurring || []}
              baseCurrency={baseCurrency || 'BRL'}
              isTransitioning={isTransitioning}
              stepHeadingRef={stepHeadingRef}
              onSubmit={handleStep6Submit}
              recurringAccountId={recurringAccountId}
              onRecurringAccountIdChange={setRecurringAccountId}
              hasExistingRecurring={hasExistingRecurring}
              recurringTransactions={recurringTransactions || []}
              getFrequencyLabel={getFrequencyLabel}
            />
          )}

          {/* Step 7: Orçamento */}
          {currentStep === 7 && (
            <OnboardingStep7Budgets
              budgetForm={budgetForm}
              budgetCurrencyMask={budgetCurrencyMask}
              baseCurrency={baseCurrency || 'BRL'}
              isTransitioning={isTransitioning}
              stepHeadingRef={stepHeadingRef}
              onSubmit={handleStep7Submit}
              hasExistingBudgets={hasExistingBudgets}
              budgets={budgets || []}
              onboardingCategoryOptions={onboardingCategoryOptions}
            />
          )}

          {/* Step 8: Convidar */}
          {currentStep === 8 && (
            <OnboardingStep8Invite
              isTransitioning={isTransitioning}
              stepHeadingRef={stepHeadingRef}
              inviteLink={inviteLink}
              linkCopied={linkCopied}
              onCopyLink={handleCopyLink}
              referralLoading={referralLoading}
            />
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface-elevated border-t border-line px-6 py-4 flex items-center justify-between">
          <div>
            {canGoBack && (
              <button
                type="button"
                onClick={() => handleStepChange((currentStep - 1) as Step)}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
              >
                <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
                <span>{t.back}</span>
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {canSkip && (
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-2 text-sm font-medium text-content-secondary hover:text-content transition-all duration-200 hover:scale-105 active:scale-95"
              >
                {t.skip}
              </button>
            )}
            
            {currentStep === 1 && (
              <button
                type="button"
                onClick={localeForm.handleSubmit(handleStep1Submit)}
                disabled={localeForm.formState.isSubmitting}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
              >
                <span>{t.nextStep}</span>
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            )}
            
            {currentStep === 2 && (
              <button
                type="button"
                onClick={handleStep2Next}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
              >
                <span>{t.nextStep}</span>
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            )}
            
            {currentStep === 3 && (
              <button
                type="button"
                onClick={countryForm.handleSubmit(handleStep3Submit)}
                disabled={countryForm.formState.isSubmitting}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
              >
                <span>{t.nextStep}</span>
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            )}
            
            {currentStep === 4 && (
              <button
                type="button"
                onClick={nameForm.handleSubmit(handleStep4Submit)}
                disabled={nameForm.formState.isSubmitting}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
              >
                <span>{t.nextStep}</span>
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            )}
            
            {currentStep === 5 && (
              <button
                type="button"
                onClick={accountForm.handleSubmit(handleStep5Submit)}
                disabled={accountForm.formState.isSubmitting}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
              >
                <span>{t.nextStep}</span>
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            )}
            
            {currentStep === 6 && (
              <button
                type="button"
                onClick={(e) => {
                  recurringForm.handleSubmit(handleStep6Submit)(e);
                }}
                disabled={recurringForm.formState.isSubmitting}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
              >
                <span>{t.nextStep}</span>
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            )}
            
            {currentStep === 7 && (
              <button
                type="button"
                onClick={budgetForm.handleSubmit(handleStep7Submit)}
                disabled={budgetForm.formState.isSubmitting}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium flex items-center space-x-2 disabled:opacity-50 transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95"
              >
                <span>{t.nextStep}</span>
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            )}
            
            {currentStep === 8 && (
              <button
                type="button"
                onClick={handleComplete}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95 animate-pulse-slow"
              >
                {t.finish}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});


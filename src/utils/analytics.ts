import { logEvent, setUserProperties } from 'firebase/analytics';
import { getFirebaseAnalytics } from '../config/firebase';
import { TransactionType } from '../lib/enums';

// Tipo para metadados do analytics
type AnalyticsMetadata = {
  app_version: string;
  browser: string;
  language: string;
  screen_res: string;
  platform: string;
};

// Cache de metadados para evitar repetidas detecções
const cachedMetadata: AnalyticsMetadata = {
  app_version: import.meta.env.VITE_APP_VERSION || '0.0.0-beta',
  browser: 'Unknown',
  language: typeof navigator !== 'undefined' ? navigator.language : 'Unknown',
  screen_res: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'Unknown',
  platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
};

// Função para detectar navegador de forma simples
const detectBrowser = () => {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (ua.indexOf("Firefox") > -1) return "Firefox";
  if (ua.indexOf("SamsungBrowser") > -1) return "Samsung Browser";
  if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) return "Opera";
  if (ua.indexOf("Trident") > -1) return "Internet Explorer";
  if (ua.indexOf("Edge") > -1) return "Edge";
  if (ua.indexOf("Chrome") > -1) return "Chrome";
  if (ua.indexOf("Safari") > -1) return "Safari";
  return "Other";
};

// Flag para garantir que as propriedades do usuário foram definidas uma vez por sessão
let userPropertiesSet = false;

// Inicializa metadados básicos no cliente
if (typeof window !== 'undefined') {
  cachedMetadata.browser = detectBrowser();
}

// Tipos de eventos principais
export enum AnalyticsEvent {
  // Autenticação
  LOGIN = 'login',
  LOGOUT = 'logout',
  SIGNUP = 'sign_up',
  LOGIN_WITH_GOOGLE = 'login_with_google',
  
  // Transações
  TRANSACTION_CREATED = 'transaction_created',
  TRANSACTION_UPDATED = 'transaction_updated',
  TRANSACTION_DELETED = 'transaction_deleted',
  TRANSACTIONS_DELETED_BULK = 'transactions_deleted_bulk',
  TRANSACTION_EXPORTED = 'transaction_exported',
  
  // Contas
  ACCOUNT_CREATED = 'account_created',
  ACCOUNT_UPDATED = 'account_updated',
  ACCOUNT_DELETED = 'account_deleted',
  
  // Orçamentos
  BUDGET_CREATED = 'budget_created',
  BUDGET_UPDATED = 'budget_updated',
  BUDGET_DELETED = 'budget_deleted',
  
  // Metas de Economia
  SAVINGS_GOAL_CREATED = 'savings_goal_created',
  SAVINGS_GOAL_UPDATED = 'savings_goal_updated',
  SAVINGS_GOAL_DELETED = 'savings_goal_deleted',
  
  // Transações Recorrentes
  RECURRING_TRANSACTION_CREATED = 'recurring_transaction_created',
  RECURRING_TRANSACTION_UPDATED = 'recurring_transaction_updated',
  RECURRING_TRANSACTION_DELETED = 'recurring_transaction_deleted',
  RECURRING_TRANSACTION_TOGGLED = 'recurring_transaction_toggled',
  
  // Dashboard
  DASHBOARD_WIDGET_REORDERED = 'dashboard_widget_reordered',
  DASHBOARD_WIDGET_TOGGLED = 'dashboard_widget_toggled',
  DASHBOARD_WIDGETS_RESET = 'dashboard_widgets_reset',
  
  // Navegação
  PAGE_VIEW = 'page_view',
  
  // Categorias
  CATEGORY_CREATED = 'category_created',
  CATEGORY_UPDATED = 'category_updated',
  CATEGORY_DELETED = 'category_deleted',
  
  // Onboarding
  ONBOARDING_STARTED = 'onboarding_started',
  ONBOARDING_STEP_COMPLETED = 'onboarding_step_completed',
  ONBOARDING_COMPLETED = 'onboarding_completed',
  ONBOARDING_SKIPPED = 'onboarding_skipped',
  
  // Landing Page
  LANDING_CTA_CLICKED = 'landing_cta_clicked',
  LANDING_SECTION_VIEWED = 'landing_section_viewed',
  LANDING_PLAN_CLICKED = 'landing_plan_clicked',
  LANDING_SCROLL_DEPTH = 'landing_scroll_depth',
  LANDING_THEME_TOGGLED = 'landing_theme_toggled',
  LANDING_NAV_CLICKED = 'landing_nav_clicked',
  
  // PWA / Instalação
  PWA_INSTALL_PROMPT_SHOWN = 'pwa_install_prompt_shown',
  PWA_INSTALL_ACCEPTED = 'pwa_install_accepted',
  PWA_INSTALL_DISMISSED = 'pwa_install_dismissed',
  PWA_INSTALL_LATER = 'pwa_install_later',
  PWA_ALREADY_INSTALLED = 'pwa_already_installed',
  PWA_INFO_MODAL_SHOWN = 'pwa_info_modal_shown',
  PWA_INFO_MODAL_CLOSED = 'pwa_info_modal_closed',
  PWA_INFO_MODAL_DONT_SHOW_AGAIN = 'pwa_info_modal_dont_show_again',
  PWA_INSTALL_ATTEMPTED = 'pwa_install_attempted',
  
  // Version Update
  VERSION_UPDATE_DETECTED = 'version_update_detected',
  VERSION_UPDATE_RELOADED = 'version_update_reloaded',
  
  // Alocação de Saldo
  ALLOCATION_MODAL_OPENED = 'allocation_modal_opened',
  ALLOCATION_CREATED = 'allocation_created',
  DEALLOCATION_CREATED = 'deallocation_created',
  
  // Modais Importantes
  WHATS_NEW_MODAL_OPENED = 'whats_new_modal_opened',
  WHATS_NEW_MODAL_CLOSED = 'whats_new_modal_closed',
  CREDIT_CARD_CREATED = 'credit_card_created',
  CREDIT_CARD_UPDATED = 'credit_card_updated',
  DELETE_USER_ACCOUNT_MODAL_OPENED = 'delete_user_account_modal_opened',
  USER_ACCOUNT_DELETED = 'user_account_deleted',
  
  // Transações Recorrentes - Menu
  RECURRING_TRANSACTION_MENU_OPENED = 'recurring_transaction_menu_opened',
  RECURRING_TRANSACTION_MENU_ACTION = 'recurring_transaction_menu_action',
  
  // Households
  HOUSEHOLD_CREATED = 'household_created',
  HOUSEHOLD_UPDATED = 'household_updated',
  HOUSEHOLD_DELETED = 'household_deleted',
  HOUSEHOLD_MEMBER_INVITED = 'household_member_invited',
  HOUSEHOLD_MEMBER_INVITE_ACCEPTED = 'household_member_invite_accepted',
  HOUSEHOLD_MEMBER_INVITE_REJECTED = 'household_member_invite_rejected',
  HOUSEHOLD_MEMBER_REMOVED = 'household_member_removed',
  HOUSEHOLD_MEMBER_ROLE_UPDATED = 'household_member_role_updated',
  HOUSEHOLD_LEFT = 'household_left',
  HOUSEHOLD_OWNERSHIP_TRANSFERRED = 'household_ownership_transferred',
  
  // Transferências e Ajustes
  ACCOUNT_TRANSFER_CREATED = 'account_transfer_created',
  ACCOUNT_BALANCE_ADJUSTED = 'account_balance_adjusted',
  ACCOUNT_RESET = 'account_reset',
  
  // Split de Transações
  TRANSACTION_SPLIT_CREATED = 'transaction_split_created',
  TRANSACTION_SPLIT_UPDATED = 'transaction_split_updated',
  TRANSACTION_SPLIT_REMOVED = 'transaction_split_removed',
  
  // Command Menu
  COMMAND_MENU_OPENED = 'command_menu_opened',
  COMMAND_MENU_COMMAND_EXECUTED = 'command_menu_command_executed',
  
  // Filtros e Busca
  TRANSACTION_FILTER_APPLIED = 'transaction_filter_applied',
  TRANSACTION_SEARCH_PERFORMED = 'transaction_search_performed',
  TRANSACTION_TAB_SWITCHED = 'transaction_tab_switched',
  
  // Visualizações
  REPORTS_PAGE_VIEWED = 'reports_page_viewed',
  MONTHLY_RECAP_VIEWED = 'monthly_recap_viewed',
  TRANSACTION_DETAILS_VIEWED = 'transaction_details_viewed',
  
  // Ações de Transação
  TRANSACTION_MARKED_AS_PAID = 'transaction_marked_as_paid',
  TRANSACTION_MARKED_AS_PENDING = 'transaction_marked_as_pending',
  TRANSACTION_DUPLICATED = 'transaction_duplicated',
  
  // Preferências
  THEME_CHANGED = 'theme_changed',
  LANGUAGE_CHANGED = 'language_changed',
  CURRENCY_CHANGED = 'currency_changed',
  COUNTRY_CHANGED = 'country_changed',
  DISPLAY_NAME_UPDATED = 'display_name_updated',
}

// Função helper para logar eventos
export const logAnalyticsEvent = (
  eventName: AnalyticsEvent | string,
  eventParams?: Record<string, unknown>
): void => {
  const analytics = getFirebaseAnalytics();
  if (!analytics) {
    // Analytics não está disponível (SSR, não suportado ou modo local sem Firebase)
    return;
  }

  try {
    // Se ainda não definimos as propriedades do usuário nesta sessão, fazemos agora
    if (!userPropertiesSet) {
      setUserProperties(analytics, {
        app_version: cachedMetadata.app_version,
        browser: cachedMetadata.browser,
        platform: cachedMetadata.platform,
        language: cachedMetadata.language,
        screen_res: cachedMetadata.screen_res
      });
      userPropertiesSet = true;
    }

    // Mescla parâmetros do evento com metadados globais
    const paramsWithMetadata = {
      ...cachedMetadata,
      ...eventParams,
    };
    
    logEvent(analytics, eventName, paramsWithMetadata);
  } catch (error) {
    // Silenciosamente falha se analytics não estiver disponível
  }
};

// Funções específicas para eventos comuns
export const analyticsHelpers = {
  // Autenticação
  logLogin: (method: 'email' | 'google') => {
    logAnalyticsEvent(AnalyticsEvent.LOGIN, { method });
  },
  
  logLogout: () => {
    logAnalyticsEvent(AnalyticsEvent.LOGOUT);
  },
  
  logSignup: (method: 'email' | 'google') => {
    logAnalyticsEvent(AnalyticsEvent.SIGNUP, { method });
  },
  
  // Transações
  logTransactionCreated: (type: TransactionType, hasAccount: boolean, isPaid: boolean) => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_CREATED, {
      transaction_type: type,
      has_account: hasAccount,
      is_paid: isPaid,
    });
  },
  
  logTransactionUpdated: (type: TransactionType) => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_UPDATED, {
      transaction_type: type,
    });
  },
  
  logTransactionDeleted: () => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_DELETED);
  },
  
  logTransactionsDeletedBulk: (count: number) => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTIONS_DELETED_BULK, {
      count,
    });
  },
  
  logTransactionExported: () => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_EXPORTED);
  },
  
  // Contas
  logAccountCreated: (type: string) => {
    logAnalyticsEvent(AnalyticsEvent.ACCOUNT_CREATED, {
      account_type: type,
    });
  },
  
  logAccountUpdated: (type: string) => {
    logAnalyticsEvent(AnalyticsEvent.ACCOUNT_UPDATED, {
      account_type: type,
    });
  },
  
  logAccountDeleted: (type: string) => {
    logAnalyticsEvent(AnalyticsEvent.ACCOUNT_DELETED, {
      account_type: type,
    });
  },
  
  // Orçamentos
  logBudgetCreated: (type: TransactionType, category: string) => {
    logAnalyticsEvent(AnalyticsEvent.BUDGET_CREATED, {
      budget_type: type,
      category,
    });
  },
  
  logBudgetUpdated: (type: TransactionType) => {
    logAnalyticsEvent(AnalyticsEvent.BUDGET_UPDATED, {
      budget_type: type,
    });
  },
  
  logBudgetDeleted: () => {
    logAnalyticsEvent(AnalyticsEvent.BUDGET_DELETED);
  },
  
  // Metas de Economia
  logSavingsGoalCreated: () => {
    logAnalyticsEvent(AnalyticsEvent.SAVINGS_GOAL_CREATED);
  },
  
  logSavingsGoalUpdated: () => {
    logAnalyticsEvent(AnalyticsEvent.SAVINGS_GOAL_UPDATED);
  },
  
  logSavingsGoalDeleted: () => {
    logAnalyticsEvent(AnalyticsEvent.SAVINGS_GOAL_DELETED);
  },
  
  // Transações Recorrentes
  logRecurringTransactionCreated: (type: TransactionType, frequency: string) => {
    logAnalyticsEvent(AnalyticsEvent.RECURRING_TRANSACTION_CREATED, {
      transaction_type: type,
      frequency,
    });
  },
  
  logRecurringTransactionUpdated: () => {
    logAnalyticsEvent(AnalyticsEvent.RECURRING_TRANSACTION_UPDATED);
  },
  
  logRecurringTransactionDeleted: () => {
    logAnalyticsEvent(AnalyticsEvent.RECURRING_TRANSACTION_DELETED);
  },
  
  logRecurringTransactionToggled: (isActive: boolean) => {
    logAnalyticsEvent(AnalyticsEvent.RECURRING_TRANSACTION_TOGGLED, {
      is_active: isActive,
    });
  },
  
  // Dashboard
  logDashboardWidgetReordered: (widgetCount: number) => {
    logAnalyticsEvent(AnalyticsEvent.DASHBOARD_WIDGET_REORDERED, {
      widget_count: widgetCount,
    });
  },
  
  logDashboardWidgetToggled: (widgetId: string, enabled: boolean) => {
    logAnalyticsEvent(AnalyticsEvent.DASHBOARD_WIDGET_TOGGLED, {
      widget_id: widgetId,
      enabled,
    });
  },
  
  logDashboardWidgetsReset: () => {
    logAnalyticsEvent(AnalyticsEvent.DASHBOARD_WIDGETS_RESET);
  },
  
  // Navegação
  logPageView: (pageName: string) => {
    logAnalyticsEvent(AnalyticsEvent.PAGE_VIEW, {
      page_name: pageName,
    });
  },
  
  // Categorias
  logCategoryCreated: () => {
    logAnalyticsEvent(AnalyticsEvent.CATEGORY_CREATED);
  },
  
  logCategoryUpdated: () => {
    logAnalyticsEvent(AnalyticsEvent.CATEGORY_UPDATED);
  },
  
  logCategoryDeleted: () => {
    logAnalyticsEvent(AnalyticsEvent.CATEGORY_DELETED);
  },
  
  // Landing Page
  logLandingCtaClicked: (ctaLocation: string, userAuthenticated: boolean) => {
    logAnalyticsEvent(AnalyticsEvent.LANDING_CTA_CLICKED, {
      cta_location: ctaLocation, // 'hero', 'features', 'pricing', 'final_cta'
      user_authenticated: userAuthenticated,
    });
  },
  
  logLandingSectionViewed: (sectionName: string) => {
    logAnalyticsEvent(AnalyticsEvent.LANDING_SECTION_VIEWED, {
      section_name: sectionName, // 'features', 'widget_demo', 'security', 'pricing', 'cta'
    });
  },
  
  logLandingPlanClicked: (planName: string) => {
    logAnalyticsEvent(AnalyticsEvent.LANDING_PLAN_CLICKED, {
      plan_name: planName, // 'gratis', 'premium_individual', 'premium_familia'
    });
  },
  
  logLandingScrollDepth: (scrollPercentage: number) => {
    logAnalyticsEvent(AnalyticsEvent.LANDING_SCROLL_DEPTH, {
      scroll_percentage: scrollPercentage, // 25, 50, 75, 100
    });
  },
  
  logLandingThemeToggled: (newTheme: 'light' | 'dark') => {
    logAnalyticsEvent(AnalyticsEvent.LANDING_THEME_TOGGLED, {
      theme: newTheme,
    });
  },
  
  logLandingNavClicked: (navItem: string) => {
    logAnalyticsEvent(AnalyticsEvent.LANDING_NAV_CLICKED, {
      nav_item: navItem, // 'logo', 'login', 'go_to_app'
    });
  },

  // Onboarding
  logOnboardingStarted: () => {
    logAnalyticsEvent(AnalyticsEvent.ONBOARDING_STARTED);
  },

  logOnboardingStepCompleted: (step: number, stepName: string) => {
    logAnalyticsEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step,
      step_name: stepName,
    });
  },

  logOnboardingCompleted: () => {
    logAnalyticsEvent(AnalyticsEvent.ONBOARDING_COMPLETED);
  },

  logOnboardingSkipped: (step: number, stepName: string) => {
    logAnalyticsEvent(AnalyticsEvent.ONBOARDING_SKIPPED, {
      step,
      step_name: stepName,
    });
  },

  // PWA / Instalação
  logPWAInstallPromptShown: () => {
    logAnalyticsEvent(AnalyticsEvent.PWA_INSTALL_PROMPT_SHOWN);
  },

  logPWAInstallAccepted: () => {
    logAnalyticsEvent(AnalyticsEvent.PWA_INSTALL_ACCEPTED);
  },

  logPWAInstallDismissed: () => {
    logAnalyticsEvent(AnalyticsEvent.PWA_INSTALL_DISMISSED);
  },

  logPWAInstallLater: () => {
    logAnalyticsEvent(AnalyticsEvent.PWA_INSTALL_LATER);
  },

  logPWAAlreadyInstalled: () => {
    logAnalyticsEvent(AnalyticsEvent.PWA_ALREADY_INSTALLED);
  },

  logPWAInfoModalShown: (source: 'landing_page' | 'dashboard') => {
    logAnalyticsEvent(AnalyticsEvent.PWA_INFO_MODAL_SHOWN, {
      source,
    });
  },

  logPWAInfoModalClosed: (source: 'landing_page' | 'dashboard') => {
    logAnalyticsEvent(AnalyticsEvent.PWA_INFO_MODAL_CLOSED, {
      source,
    });
  },

  logPWAInfoModalDontShowAgain: (source: 'landing_page' | 'dashboard') => {
    logAnalyticsEvent(AnalyticsEvent.PWA_INFO_MODAL_DONT_SHOW_AGAIN, {
      source,
    });
  },

  logPWAInstallAttempted: (success: boolean, method?: string) => {
    logAnalyticsEvent(AnalyticsEvent.PWA_INSTALL_ATTEMPTED, {
      success,
      method,
    });
  },

  // Version Update
  logVersionUpdateDetected: () => {
    logAnalyticsEvent(AnalyticsEvent.VERSION_UPDATE_DETECTED);
  },

  logVersionUpdateReloaded: () => {
    logAnalyticsEvent(AnalyticsEvent.VERSION_UPDATE_RELOADED);
  },

  // Alocação de Saldo
  logAllocationModalOpened: (mode: 'allocate' | 'deallocate') => {
    logAnalyticsEvent(AnalyticsEvent.ALLOCATION_MODAL_OPENED, {
      mode,
    });
  },

  logAllocationCreated: (amount: number, accountId: string, creditCardId: string) => {
    logAnalyticsEvent(AnalyticsEvent.ALLOCATION_CREATED, {
      amount,
      account_id: accountId,
      credit_card_id: creditCardId,
    });
  },

  logDeallocationCreated: (amount: number, accountId: string, creditCardId: string) => {
    logAnalyticsEvent(AnalyticsEvent.DEALLOCATION_CREATED, {
      amount,
      account_id: accountId,
      credit_card_id: creditCardId,
    });
  },

  // Modais Importantes
  logWhatsNewModalOpened: () => {
    logAnalyticsEvent(AnalyticsEvent.WHATS_NEW_MODAL_OPENED);
  },

  logWhatsNewModalClosed: (hasScrolledToEnd: boolean, hasUnderstood: boolean) => {
    logAnalyticsEvent(AnalyticsEvent.WHATS_NEW_MODAL_CLOSED, {
      has_scrolled_to_end: hasScrolledToEnd,
      has_understood: hasUnderstood,
    });
  },

  logCreditCardCreated: () => {
    logAnalyticsEvent(AnalyticsEvent.CREDIT_CARD_CREATED);
  },

  logCreditCardUpdated: () => {
    logAnalyticsEvent(AnalyticsEvent.CREDIT_CARD_UPDATED);
  },

  logDeleteUserAccountModalOpened: () => {
    logAnalyticsEvent(AnalyticsEvent.DELETE_USER_ACCOUNT_MODAL_OPENED);
  },

  logUserAccountDeleted: () => {
    logAnalyticsEvent(AnalyticsEvent.USER_ACCOUNT_DELETED);
  },

  // Transações Recorrentes - Menu
  logRecurringTransactionMenuOpened: () => {
    logAnalyticsEvent(AnalyticsEvent.RECURRING_TRANSACTION_MENU_OPENED);
  },

  logRecurringTransactionMenuAction: (action: 'edit' | 'delete' | 'toggle', isActive?: boolean) => {
    logAnalyticsEvent(AnalyticsEvent.RECURRING_TRANSACTION_MENU_ACTION, {
      action,
      is_active: isActive,
    });
  },
  
  // Households
  logHouseholdCreated: () => {
    logAnalyticsEvent(AnalyticsEvent.HOUSEHOLD_CREATED);
  },
  
  logHouseholdUpdated: () => {
    logAnalyticsEvent(AnalyticsEvent.HOUSEHOLD_UPDATED);
  },
  
  logHouseholdDeleted: () => {
    logAnalyticsEvent(AnalyticsEvent.HOUSEHOLD_DELETED);
  },
  
  logHouseholdMemberInvited: (role: 'EDITOR' | 'VIEWER') => {
    logAnalyticsEvent(AnalyticsEvent.HOUSEHOLD_MEMBER_INVITED, {
      role,
    });
  },
  
  logHouseholdMemberInviteAccepted: () => {
    logAnalyticsEvent(AnalyticsEvent.HOUSEHOLD_MEMBER_INVITE_ACCEPTED);
  },
  
  logHouseholdMemberInviteRejected: () => {
    logAnalyticsEvent(AnalyticsEvent.HOUSEHOLD_MEMBER_INVITE_REJECTED);
  },
  
  logHouseholdMemberRemoved: () => {
    logAnalyticsEvent(AnalyticsEvent.HOUSEHOLD_MEMBER_REMOVED);
  },
  
  logHouseholdMemberRoleUpdated: (newRole: 'OWNER' | 'EDITOR' | 'VIEWER') => {
    logAnalyticsEvent(AnalyticsEvent.HOUSEHOLD_MEMBER_ROLE_UPDATED, {
      new_role: newRole,
    });
  },
  
  logHouseholdLeft: () => {
    logAnalyticsEvent(AnalyticsEvent.HOUSEHOLD_LEFT);
  },
  
  logHouseholdOwnershipTransferred: () => {
    logAnalyticsEvent(AnalyticsEvent.HOUSEHOLD_OWNERSHIP_TRANSFERRED);
  },
  
  // Transferências e Ajustes
  logAccountTransferCreated: (fromAccountType: string, toAccountType: string, amount: number) => {
    logAnalyticsEvent(AnalyticsEvent.ACCOUNT_TRANSFER_CREATED, {
      from_account_type: fromAccountType,
      to_account_type: toAccountType,
      amount,
    });
  },
  
  logAccountBalanceAdjusted: (accountType: string, adjustmentAmount: number) => {
    logAnalyticsEvent(AnalyticsEvent.ACCOUNT_BALANCE_ADJUSTED, {
      account_type: accountType,
      adjustment_amount: adjustmentAmount,
    });
  },
  
  logAccountReset: (accountType: string) => {
    logAnalyticsEvent(AnalyticsEvent.ACCOUNT_RESET, {
      account_type: accountType,
    });
  },
  
  // Split de Transações
  logTransactionSplitCreated: (splitCount: number, totalAmount: number) => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_SPLIT_CREATED, {
      split_count: splitCount,
      total_amount: totalAmount,
    });
  },
  
  logTransactionSplitUpdated: (splitCount: number) => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_SPLIT_UPDATED, {
      split_count: splitCount,
    });
  },
  
  logTransactionSplitRemoved: () => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_SPLIT_REMOVED);
  },
  
  // Command Menu
  logCommandMenuOpened: () => {
    logAnalyticsEvent(AnalyticsEvent.COMMAND_MENU_OPENED);
  },
  
  logCommandMenuCommandExecuted: (command: string) => {
    logAnalyticsEvent(AnalyticsEvent.COMMAND_MENU_COMMAND_EXECUTED, {
      command,
    });
  },
  
  // Filtros e Busca
  logTransactionFilterApplied: (filterType: string, filterValue: string) => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_FILTER_APPLIED, {
      filter_type: filterType,
      filter_value: filterValue,
    });
  },
  
  logTransactionSearchPerformed: (searchTerm: string, resultCount?: number) => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_SEARCH_PERFORMED, {
      search_term: searchTerm,
      result_count: resultCount,
    });
  },
  
  logTransactionTabSwitched: (tab: 'transactions' | 'scheduled') => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_TAB_SWITCHED, {
      tab,
    });
  },
  
  // Visualizações
  logReportsPageViewed: (reportType?: 'mensal' | 'anual') => {
    logAnalyticsEvent(AnalyticsEvent.REPORTS_PAGE_VIEWED, {
      report_type: reportType,
    });
  },
  
  logMonthlyRecapViewed: () => {
    logAnalyticsEvent(AnalyticsEvent.MONTHLY_RECAP_VIEWED);
  },
  
  logTransactionDetailsViewed: (transactionType: TransactionType) => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_DETAILS_VIEWED, {
      transaction_type: transactionType,
    });
  },
  
  // Ações de Transação
  logTransactionMarkedAsPaid: () => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_MARKED_AS_PAID);
  },
  
  logTransactionMarkedAsPending: () => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_MARKED_AS_PENDING);
  },
  
  logTransactionDuplicated: () => {
    logAnalyticsEvent(AnalyticsEvent.TRANSACTION_DUPLICATED);
  },
  
  // Preferências
  logThemeChanged: (theme: 'light' | 'dark') => {
    logAnalyticsEvent(AnalyticsEvent.THEME_CHANGED, {
      theme,
    });
  },
  
  logLanguageChanged: (language: string) => {
    logAnalyticsEvent(AnalyticsEvent.LANGUAGE_CHANGED, {
      language,
    });
  },
  
  logCurrencyChanged: (currency: string) => {
    logAnalyticsEvent(AnalyticsEvent.CURRENCY_CHANGED, {
      currency,
    });
  },
  
  logCountryChanged: (country: string) => {
    logAnalyticsEvent(AnalyticsEvent.COUNTRY_CHANGED, {
      country,
    });
  },
  
  logDisplayNameUpdated: () => {
    logAnalyticsEvent(AnalyticsEvent.DISPLAY_NAME_UPDATED);
  },
};


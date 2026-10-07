import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useUser, useUpdateUserPreferences } from '../hooks/api/useUsers';
import ptBR from '../i18n/pt-BR.json';
import enUS from '../i18n/en-US.json';
import esES from '../i18n/es-ES.json';
import jaJP from '../i18n/ja-JP.json';
import ruRU from '../i18n/ru-RU.json';
import zhCN from '../i18n/zh-CN.json';
import frFR from '../i18n/fr-FR.json';
import arSA from '../i18n/ar-SA.json';

export type Locale = 'pt-BR' | 'en-US' | 'es-ES' | 'ja-JP' | 'ru-RU' | 'zh-CN' | 'fr-FR' | 'ar-SA';

export interface Translations {
  // Navigation
  dashboard: string;
  transactions: string;
  budgets: string;
  recurring: string;
  accounts: string;
  goals: string;
  reports: string;
  settings: string;
  logout: string;
  community: string;
  
  // Common
  save: string;
  saveAndCreateNew: string;
  cancel: string;
  resetAccount: string;
  resetRectaAccount: string;
  resetRectaAccountDescription: string;
  resetAccountConfirmationPhrase: string;
  resetAccountWarning: string;
  resetAccountWarningMessage: string;
  resetAccountConfirmationLabel: string;
  resetAccountConfirmationMismatch: string;
  edit: string;
  delete: string;
  create: string;
  update: string;
  close: string;
  loading: string;
  search: string;
  filter: string;
  all: string;
  allTypes: string;
  allCategories: string;
  allStatus: string;
  none: string;
  optional: string;
  clearFilters: string;
  exportCSV: string;
  noResults: string;
  noDescription: string;
  noCategory: string;
  select: string;
  selectAll: string;
  deselectAll: string;
  selected: string;
  transaction: string;
  upcomingScheduled: string;
  
  // Transaction types
  income: string;
  expense: string;
  operation: string;
  
  // Transaction form
  newTransaction: string;
  editTransaction: string;
  description: string;
  amount: string;
  category: string;
  date: string;
  account: string;
  installments: string;
  type: string;
  paid: string;
  paidDescription: string;
  pending: string;
  overdue: string;
  paymentStatus: string;
  markAsPaid: string;
  markAsPending: string;
  
  // Dashboard
  overview: string;
  totalIncome: string;
  totalExpense: string;
  balance: string;
  monthlyComparison: string;
  trends: string;
  forecast: string;
  predictedIncome: string;
  predictedExpense: string;
  predictedBalance: string;
  creditCards: string;
  creditCardsDescription: string;
  totalCreditLimit: string;
  allCreditCards: string;
  invoice: string;
  invoicePeriod: string;
  dueDay: string;
  closingDay: string;
  bestDayToBuy: string;
  closingDayFromDueHint: string;
  payInvoice: string;
  payInvoiceDescription: string;
  paymentAccount: string;
  invoicePaymentDescription: string;
  paymentAmountHint: string;
  confirmInvoicePayment: string;
  undoInvoicePayment: string;
  undoInvoicePaymentDescription: string;
  invoicePaymentUndone: string;
  newCreditCard: string;
  previousBalance: string;
  previousBalanceTooltip: string;
  deleteAllSubsequentInstallments: string;
  deleteAllSubsequentHint: string;
  installmentDeleteTitle: string;
  installmentDeleteMessage: string;
  deleteOnlyThisInstallment: string;
  deleteOnlyThisHint: string;
  confirmDeleteTransaction: string;
  noCreditCards: string;
  creditCardTransactions: string;
  items: string;
  deleteTransaction: string;
  errorDeletingTransaction: string;
  errorDeletingAccount: string;
  errorDeletingTransactions: string;
  errorPayingInvoice: string;
  errorUndoingPayment: string;
  noInvoiceTransactions: string;
  comingSoon: string;
  person: string;
  people: string;
  user: string;
  limitUsage: string;
  totalLimit: string;
  currentDebt: string;
  availableLimit: string;
  usedLimit: string;
  of: string;
  used: string;
  savingsGoals: string;
  totalAccountsBalance: string;
  availableBalance: string;
  availableBalanceDescription: string;
  projectedBalance: string;
  projectedBalanceDescription: string;
  difference: string;
  expensesByCategory: string;
  incomeByCategory: string;
  budgetAlerts: string;
  budgetExceeded: string;
  selectMonth: string;
  previousMonths: string;
  nextMonths: string;
  currentMonth: string;
  thisMonth: string;
  lastMonth: string;
  last3Months: string;
  last6Months: string;
  thisQuarter: string;
  thisYear: string;
  lastYear: string;
  allPeriods: string;
  selectPeriod: string;
  fromDate: string;
  toDate: string;
  custom: string;
  personalized: string;
  noChange: string;
  insights: string;
  moreOptions: string;
  showValues: string;
  hideValues: string;
  showValuesBlur: string;
  hideValuesBlur: string;
  configureWidgets: string;
  widgetConfigTitle: string;
  widgetConfigSubtitle: string;
  widgetConfigDescription: string;
  searchWidgets: string;
  noWidgetsFound: string;
  moveToTop: string;
  moveToBottom: string;
  resetToDefault: string;
  resetToDefaultConfirm: string;
  moveUp: string;
  moveDown: string;
  hideWidget: string;
  showWidget: string;
  saveChanges: string;
  periodFilters: string;
  quickPeriods: string;
  healthExcellent: string;
  healthGood: string;
  healthAttention: string;
  healthCritical: string;
  balanceVsLastMonth: string;
  savingsRate: string;
  savingsSavedThisMonth: string;
  savingsOverspentThisMonth: string;
  thisMonthSuffix: string;
  viewAllIncome: string;
  viewAllExpenses: string;
  alert: string;
  alerts: string;
  projectionIncrease: string;
  projectionDecrease: string;
  projectionNegative: string;
  projectedDifference: string;
  currentBalanceLabel: string;
  projectedBalanceInfo: string;
  comparedToLastMonth: string;
  trendGreat: string;
  trendAttention: string;
  monthLabel: string;
  spendingHeatmapTitle: string;
  spendingHeatmapTotal: string;
  spendingByDayOfMonth: string;
  spendingByDayOfWeek: string;
  previousMonth: string;
  nextMonth: string;
  less: string;
  more: string;
  monthlyTotal: string;
  financialSummary: string;
  dashboardWidgets: string;
  dailyCashFlow: string;
  daysRemaining: string;
  maxBalance: string;
  minBalance: string;
  projectedEnd: string;
  negativeProjectionWarning: string;
  negativeProjectionMessage: string;
  fixedExpenses: string;
  variableExpenses: string;
  fixedVsVariable: string;
  noExpensesThisMonth: string;
  ofTotal: string;
  fixedExpensesInsight: string;
  noBudgetForMonth: string;
  budgetsVsRealized: string;
  budgeted: string;
  historicalAverageComparison: string;
  averageIncome: string;
  averageExpense: string;
  averageBalance: string;
  vsAverage: string;
  basedOnLastMonths: string;
  categoryTrends: string;
  recentAverage: string;
  comparisonLastMonths: string;
  exportReport: string;
  daySunday: string;
  dayMonday: string;
  dayTuesday: string;
  dayWednesday: string;
  dayThursday: string;
  dayFriday: string;
  daySaturday: string;
  reportInsightDominantCategoryTitle: string;
  reportInsightDominantCategoryDescription: string;
  insightsIncomeUp: string;
  insightsIncomeDown: string;
  insightsExpenseUp: string;
  insightsExpenseDown: string;
  insightsBalanceUp: string;
  insightsBalanceDown: string;
  insightsVsLastMonth: string;
  insightsHighestExpense: string;
  insightsPositiveBalance: string;
  insightsNegativeBalance: string;
  insightsIncomeHigh: string;
  insightsIncomeAttention: string;
  insightsExpensesIncreasing: string;
  insightsGreatSavings: string;
  insightsBalanceImproving: string;
  insightsTopExpenseCategory: string;
  insightsLowSavingsMargin: string;
  insightsNegativeBalanceTitle: string;
  dueDate: string;
  balanceEvolution: string;
  balanceEvolutionDescription: string;
  accumulatedBalance: string;
  projectedYearEnd: string;
  noSavingsGoals: string;
  noExpensesByCategory: string;
  noIncomeByCategory: string;
  
  // Accounts
  newAccount: string;
  editAccount: string;
  accountName: string;
  accountType: string;
  initialBalance: string;
  creditLimit: string;
  noDebt: string;
  noAccounts: string;
  totalAvailableBalance: string;
  excludesCreditDebt: string;
  currentBalance: string;
  balanceEditHint: string;
  balanceAndTypeEditHint: string;
  checkingAccount: string;
  savingsAccount: string;
  creditCard: string;
  editCreditCard: string;
  selectCreditCard: string;
  noCreditCardsRegistered: string;
  cash: string;
  investment: string;
  color: string;
  initialDebt: string;
  cardLimit: string;
  dayOfMonth: string;
  
  // Budgets
  newBudget: string;
  editBudget: string;
  budgetAmount: string;
  spent: string;
  remaining: string;
  exceeded: string;
  general: string;
  month: string;
  
  // Goals
  newGoal: string;
  editGoal: string;
  goalName: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  completed: string;
  remainingAmount: string;
  deadline: string;
  day: string;
  days: string;
  monthlySavingsNeeded: string;
  perMonth: string;
  toReachGoal: string;
  goalSyncedWithAccount: string;
  synced: string;
  filters: string;
  
  // Recurring
  newRecurring: string;
  editRecurring: string;
  recurringHelperTitle: string;
  recurringHelperText: string;
  frequency: string;
  daily: string;
  weekly: string;
  biweekly: string;
  monthly: string;
  yearly: string;
  startDate: string;
  endDate: string;
  nextDueDate: string;
  pause: string;
  activate: string;
  next: string;
  nextStep: string;
  step: string;
  preferences: string;
  baseCurrency: string;
  language: string;
  baseCurrencyDescription: string;
  languageDescription: string;
  
  // Onboarding
  welcome: string;
  onboardingStep1Title: string;
  onboardingStep1Description: string;
  onboardingStep1Motivational: string;
  onboardingStep2ThemeTitle: string;
  onboardingStep2ThemeDescription: string;
  onboardingStep3Title: string;
  onboardingStep3Description: string;
  onboardingStep4Title: string;
  onboardingStep4Description: string;
  onboardingStep5Title: string;
  onboardingStep5Description: string;
  onboardingStep6Title: string;
  onboardingStep6Description: string;
  onboardingStep7Title: string;
  onboardingStep7Description: string;
  onboardingStep8Title: string;
  onboardingStep8Description: string;
  displayName: string;
  displayNameLabel: string;
  displayNameDescription: string;
  displayNamePlaceholder: string;
  back: string;
  skip: string;
  finish: string;
  addMore: string;
  inviteLinkCopied: string;
  selectLanguage: string;
  selectTheme: string;
  selectCountry: string;
  selectCurrency: string;
  selectAccountType: string;
  selectAccount: string;
  accountNameLabel: string;
  accountNamePlaceholder: string;
  accountTypeLabel: string;
  initialBalanceLabel: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  amountLabel: string;
  accountOptionalLabel: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  budgetAmountLabel: string;
  inviteLinkLabel: string;
  copied: string;
  copy: string;
  countryLabel: string;
  currencyLabel: string;
  country: string;
  restartOnboarding: string;
  restartOnboardingDescription: string;
  restartOnboardingButton: string;
  onboardingRestarted: string;
  youAlreadyHaveAccounts: string;
  youCanAddMoreAccounts: string;
  youAlreadyHaveRecurring: string;
  andMoreRecurring: string;
  youCanAddMoreRecurring: string;
  noAccountsForRecurring: string;
  noAccountsForRecurringHint: string;
  youAlreadyHaveBudgets: string;
  andMoreBudgets: string;
  youCanAddMoreBudgets: string;
  errorSavingLanguage: string;
  errorSavingTheme: string;
  errorSavingCountry: string;
  errorSavingName: string;
  errorCreatingAccount: string;
  errorCreatingRecurring: string;
  errorCreatingBudget: string;
  accountAlreadyExists: string;
  recurringAlreadyExists: string;
  budgetAlreadyExists: string;
  errorFinishingOnboarding: string;
  salary: string;
  generalCategory: string;
  manageCategories: string;
  addCategory: string;
  noCustomCategories: string;

  // Messages
  transactionCreated: string;
  transactionUpdated: string;
  transactionDeleted: string;
  accountCreated: string;
  accountUpdated: string;
  accountDeleted: string;
  budgetCreated: string;
  budgetUpdated: string;
  budgetDeleted: string;
  goalCreated: string;
  goalUpdated: string;
  goalDeleted: string;
  recurringCreated: string;
  recurringUpdated: string;
  recurringDeleted: string;
  recurringProcessed: string;
  recurringAlreadyProcessed: string;
  processRecurringTitle: string;
  processRecurringDescription: string;
  processRecurringPoint1: string;
  processRecurringPoint2: string;
  processRecurringPoint3: string;
  processRecurringPoint4: string;
  processRecurringNote: string;
  processRecurringNoteText: string;
  processRecurringConfirm: string;
  currencyChanged: string;
  languageChanged: string;
  installmentsCreated: string;
  
  // Errors
  required: string;
  invalidEmail: string;
  emailDoesNotMatch: string;
  invalidPassword: string;
  error: string;
  confirmDelete: string;
  confirmDeleteAccount: string;
  deleteBankAccount: string;
  deleteAccountWarning: string;
  deleteAccountTransactionsWarning: string;
  deleteAccountAndTransactionsWarning: string;
  deleteLinkedTransactions: string;
  deleteUserAccount: string;
  deleteUserAccountWarning: string;
  confirmPassword: string;
  confirmPasswordHint: string;
  googleAccountDeleteInfo: string;
  confirmEmailHint: string;
  requiresRecentLogin: string;
  typeBankAccountNameToConfirm: string;
  nameDoesNotMatch: string;
  bankAccount: string;
  bankAccounts: string;
  confirmDeleteBudget: string;
  confirmDeleteGoal: string;
  confirmDeleteRecurring: string;
  
  // Category
  selectCategory: string;
  searchCategory: string;
  noCategoryFound: string;
  categoryDeleteInUse: string;
  
  // Category translations
  categorySALARY: string;
  categoryFREELANCE: string;
  categoryINVESTMENTS: string;
  categorySALES: string;
  categoryRENTAL_INCOME: string;
  categoryOTHER_INCOME: string;
  categoryFOOD: string;
  categoryTRANSPORTATION: string;
  categoryHOUSING: string;
  categoryHEALTHCARE: string;
  categoryEDUCATION: string;
  categoryENTERTAINMENT: string;
  categoryCLOTHING: string;
  categoryUTILITIES: string;
  categorySUBSCRIPTIONS: string;
  categoryONLINE_SHOPPING: string;
  categoryGROCERIES: string;
  categoryRESTAURANT: string;
  categoryFUEL: string;
  categoryPHARMACY: string;
  categoryOTHER_EXPENSES: string;
  categoryTRANSFER: string;
  categoryALLOCATION: string;
  
  // Accounts
  accountsDescription: string;
  accountsHelperTitle: string;
  accountsHelper1: string;
  accountsHelper2: string;
  accountsHelper3: string;
  accountsHelper4: string;
  accountsHelper5: string;
  accountsHelper6: string;
  accountsHelper7: string;
  accountsHelper8: string;
  goalsDescription: string;
  budgetsDescription: string;
  creditCardInitialDebtHint: string;
  
  // Recurring
  recurringDescription: string;
  processNow: string;
  
  // App Info
  appInfo: string;
  appVersion: string;
  profile: string;
  name: string;
  avatar: string;
  privacyNotice: string;
  privacyNoticeDescription: string;
  appearance: string;
  theme: string;
  lightMode: string;
  darkMode: string;
  themeDescription: string;
  subscription: string;
  premiumPlan: string;
  premiumPlanActive: string;
  premiumPlanDescription: string;
  
  // Command Menu
  commandMenuPlaceholder: string;
  commandMenuDescription: string;
  commandMenuNoResults: string;
  commandMenuTransactionsGroup: string;
  commandMenuManagementGroup: string;
  commandMenuNavigationGroup: string;
  commandMenuFunGroup: string;
  commandMenuShowConfetti: string;
  commandMenuNewSavingsGoal: string;
  
  // Reports
  reportType: string;
  year: string;
  totalIncomeLabel: string;
  totalExpenseLabel: string;
  balanceLabel: string;
  annualComparison: string;
  monthlyComparisonOfYear: string;
  topCategories: string;
  categoryDetails: string;
  reportFinancialReport: string;
  reportTypeMonthly: string;
  reportTypeYearly: string;
  reportSummary: string;
  reportTotalIncome: string;
  reportTotalExpense: string;
  reportBalance: string;
  reportSavingsRate: string;
  reportCategories: string;
  reportPreviousMonth: string;
  reportPreviousYear: string;
  reportSavingsRateLabel: string;
  reportMonthlyAverage: string;
  reportDay: string;
  reportTopCategories: string;
  reportCategory: string;
  reportCategoriesPlural: string;
  reportInsightExcellentSavingsRateTitle: string;
  reportInsightExcellentSavingsRateDescription: string;
  reportInsightGoodSavingsRateTitle: string;
  reportInsightGoodSavingsRateDescription: string;
  reportInsightNegativeSavingsRateTitle: string;
  reportInsightNegativeSavingsRateDescription: string;
  reportInsightHealthyGrowthTitle: string;
  reportInsightHealthyGrowthDescription: string;
  
  // Months
  january: string;
  february: string;
  march: string;
  april: string;
  may: string;
  june: string;
  july: string;
  august: string;
  september: string;
  october: string;
  november: string;
  december: string;
  
  // Login
  loginTitle: string;
  signupTitle: string;
  loginOr: string;
  signupAlreadyHaveAccount: string;
  createNewAccount: string;
  doLogin: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  showPasswordAriaLabel: string;
  hidePasswordAriaLabel: string;
  loginButton: string;
  signupButton: string;
  continueWith: string;
  google: string;
  loginError: string;
  googleLoginError: string;
  loginBackToHome: string;
  loginSignupWithGoogle: string;
  
  // Placeholders
  currencyPlaceholder: string;
  exampleDay: string;
  notAvailable: string;
  
  // Savings Goals
  noGoalsRegistered: string;
  
  // Mobile Banner
  mobileBannerTitle: string;
  mobileBannerMessage: string;
  
  // Referrals
  copyInviteLink: string;
  referralCount: string;
  referralCountDescription: string;
  yourInviteLink: string;
  noReferralsYet: string;
  
  // Schema validation
  nameRequired: string;
  typeRequired: string;
  invalidColor: string;
  limitMustBePositive: string;
  cardLimitMustBePositive: string;
  targetAmountMustBePositive: string;
  currentAmountCannotBeNegative: string;
  fieldRequired: string;
  amountMustBePositive: string;
  amountMustBeGreaterThanZero: string;
  balanceCannotBeNegative: string;
  descriptionRequired: string;
  categoryRequired: string;
  countryRequired: string;
  currencyRequired: string;
  displayNameRequired: string;
  displayNameTooLong: string;
  accountNameRequired: string;
  accountNameTooLong: string;
  descriptionTooLong: string;
  categoryTooLong: string;
  nameTooLong: string;
  frequencyRequired: string;
  localeRequired: string;
  installmentsMin: string;
  installmentsMax: string;
  dueDayMin: string;
  dueDayMax: string;
  
  // CSV Export
  csvFileName: string;
  
  // Landing Page
  landingHeroTitle: string;
  landingHeroSubtitle: string;
  landingCtaButton: string;
  landingLoginButton: string;
  landingFeaturesTitle: string;
  landingFeaturesSubtitle: string;
  landingFeature1Title: string;
  landingFeature1Description: string;
  landingFeature2Title: string;
  landingFeature2Description: string;
  landingFeature3Title: string;
  landingFeature3Description: string;
  landingFeature4Title: string;
  landingFeature4Description: string;
  landingSecurityTitle: string;
  landingSecurityDescription: string;
  landingSecurityLink: string;
  landingAppTitle: string;
  landingAppDescription: string;
  landingGetStarted: string;
  landingFreeTrial: string;
  landingLearnMore: string;
  landingHeroWord1: string;
  landingHeroWord2: string;
  landingHeroWord3: string;
  landingHeroWord4: string;
  landingGoToApp: string;
  landingTotalBalance: string;
  landingDemoIncome: string;
  landingDemoExpense: string;
  landingWidgetTitle: string;
  landingWidgetSubtitle: string;
  landingWidgetChartTitle: string;
  landingDemoCategory1: string;
  landingDemoCategory2: string;
  landingDemoCategory3: string;
  landingDetailedReportsTitle: string;
  landingDetailedReportsDesc: string;
  landingAutomaticInsightsTitle: string;
  landingAutomaticInsightsDesc: string;
  landingPricingTitle: string;
  landingPricingSubtitle: string;
  landingMostPopular: string;
  landingBetaFree: string;
  landingFreePlanName: string;
  landingPerMonth: string;
  landingFreePlanFeature1: string;
  landingFreePlanFeature2: string;
  landingFreePlanFeature3: string;
  landingFreePlanFeature4: string;
  landingPremiumIndividualName: string;
  landingPremiumIndividualFeature1: string;
  landingPremiumIndividualFeature2: string;
  landingPremiumIndividualFeature3: string;
  landingPremiumIndividualFeature4: string;
  landingPremiumIndividualFeature5: string;
  landingPremiumIndividualFeature6: string;
  landingPremiumFamilyName: string;
  landingPremiumFamilyFeature1: string;
  landingPremiumFamilyFeature2: string;
  landingPremiumFamilyFeature3: string;
  landingPremiumFamilyFeature4: string;
  landingPremiumFamilyFeature5: string;
  landingPricingNote: string;
  landingComingSoon: string;
  landingFooterRights: string;
  landingSeoTitle: string;
  landingSeoDescription: string;
  landingNavAriaLabel: string;
  landingMainContentAriaLabel: string;
  landingHeroSectionAriaLabel: string;
  versionUpdateTitle: string;
  versionUpdateDescription: string;
  versionUpdateButton: string;

  // PWA Install
  installApp: string;
  installAppDescription: string;
  installNow: string;
  later: string;
  pwaInfoTitle: string;
  pwaInfoDescription: string;
  pwaInfoMobileTitle: string;
  pwaInfoMobileDescription: string;
  pwaInfoDesktopTitle: string;
  pwaInfoDesktopDescription: string;
  pwaInfoBenefit: string;
  dontShowAgain: string;
  gotIt: string;
  pwaInstalled: string;
  pwaInstallNotAvailable: string;

  // Verification
  verifyEmailTitle: string;
  verifyEmailDescription: string;
  resendVerificationEmail: string;
  resendCooldown: string;
  confirmVerification: string;
  verificationEmailSent: string;
  emailVerifiedSuccess: string;
  errorSendingVerification: string;
  emailNotVerified: string;
  obviousFakeEmailError: string;
  
  // Allocation
  allocateBalance: string;
  deallocateBalance: string;
  allocateToCard: string;
  deallocate: string;
  accountAndCreditCardRequired: string;
  insufficientAvailableBalance: string;
  insufficientAllocatedBalance: string;
  allocationSuccess: string;
  deallocationSuccess: string;
  errorProcessingAllocation: string;
  valueToAllocate: string;
  valueToDeallocate: string;
  maximumAvailable: string;
  maximumAllocated: string;
  maximumAllocatedInCard: string;
  processing: string;
  allocate: string;
  totalBalance: string;
  allocatedBalance: string;
  selectType: string;
  selectFrequency: string;
  notes: string;
  notesOptional: string;
  details: string;
  viewDetails: string;
  attachment: string;
  viewAttachment: string;
  creditCardInParentheses: string;
  transfer: string;
  fromAccount: string;
  toAccount: string;
  fromAccountRequired: string;
  sameAccountError: string;
  transferCreated: string;
  
  // Feedback
  giveFeedback: string;
  feedbackTitle: string;
  feedbackRatingLabel: string;
  feedbackCommentLabel: string;
  feedbackPlaceholder: string;
  feedbackSubmit: string;
  feedbackSubmitting: string;
  feedbackSuccess: string;
  feedbackError: string;
  
  // What's New Modal
  whatsNewTitle: string;
  whatsNewIntro: string;
  whatsNewTransactionsTitle: string;
  whatsNewTransactions1: string;
  whatsNewTransactions2: string;
  whatsNewTransactions3: string;
  whatsNewControlsTitle: string;
  whatsNewControls1: string;
  whatsNewControls2: string;
  whatsNewControls3: string;
  whatsNewCardsTitle: string;
  whatsNewCards1: string;
  whatsNewCards2: string;
  whatsNewCards3: string;
  whatsNewRecurringTitle: string;
  whatsNewRecurring1: string;
  whatsNewRecurring2: string;
  whatsNewRecurring3: string;
  whatsNewPerformanceTitle: string;
  whatsNewPerformance1: string;
  whatsNewPerformance2: string;
  whatsNewPerformance3: string;
  whatsNewCategoriesTitle: string;
  whatsNewCategories1: string;
  whatsNewCategories2: string;
  whatsNewMigrationTitle: string;
  whatsNewMigrationText: string;
  whatsNewMigrationRecommendation: string;
  whatsNewUnderstand: string;
  whatsNewContinue: string;
  // What's New - v0.5.0
  whatsNewV05CardsTitle: string;
  whatsNewV05Cards1: string;
  whatsNewV05Cards2: string;
  whatsNewV05BudgetsTitle: string;
  whatsNewV05Budgets1: string;
  whatsNewV05Budgets2: string;
  whatsNewV05Budgets3: string;
  whatsNewV05ForecastTitle: string;
  whatsNewV05ForecastText: string;

  // UI Labels
  appNameWithBeta: string;
  openMenu: string;
  closeMenu: string;
  selectMonthDescription: string;
  backToCurrentMonth: string;
  fromAccountDefault: string;
  toAccountDefault: string;
  youLabel: string;
  
  // Validation errors
  accountOrCardRequired: string;
  pleaseSplitExpense: string;
  splitSumMustEqualTotal: string;
  splitExpenseBetweenMembers: string;
  splitBetweenMembers: string;
  divideEqually: string;
  totalSplit: string;
  noAccountsAvailable: string;
  noAccountsAvailableMessage: string;
  personalAccount: string;
  myPersonalAccount: string;
  otherMemberPersonalAccount: string;
  accountToPay: string;
  totalAmount: string;
  splitInsufficientBalance: string;
  youDontHavePersonalAccounts: string;
  currentPlanSupportsUpTo: string;
  youWereAddedToHousehold: string;
  youHaveNoUnreadNotifications: string;
  youHaveNoPendingInvites: string;
  youCanInviteAnotherPerson: string;
  selectAccountOrCreateBeforeRecurring: string;
  notifications: string;
  markAllAsRead: string;
  noNotifications: string;
  noInvitesFound: string;
  planLimitReached: string;
  sharePersonalAccounts: string;
  sharePersonalAccountsDescription: string;
  selectPersonalAccountsToShare: string;
  inviteNewMember: string;
  inviteMemberHint: string;
  inviteCancelled: string;
  inviteSent: string;
  memberRemoved: string;
  inviteRejected: string;
  inviteRemoved: string;
  inviteAccepted: string;
  inviteResolved: string;
  sharedHouseholdCreated: string;
  confirmRemoveMember: string;
  owner: string;
  editor: string;
  viewer: string;
  sharedAccountsCount: string;
  allAccountsShared: string;
  householdNameLabel: string;
  householdNamePlaceholder: string;
  errorSavingAccount: string;
  errorSavingBudget: string;
  errorInvitingMember: string;
  cannotInviteYourself: string;
  errorRemovingMember: string;
  errorUpdatingPermission: string;
  errorUpdatingSharedAccounts: string;
  errorCancellingInvite: string;
  errorAcceptingInvite: string;
  errorRejectingInvite: string;
  errorCreatingSharedHousehold: string;
  errorDeletingHousehold: string;
  formValidationError: string;
  deleteHousehold: string;
  deleteHouseholdConfirm: string;
  deleteHouseholdDescription: string;
  householdDeleted: string;
  leaveHousehold: string;
  leaveHouseholdDescription: string;
  confirmLeaveHousehold: string;
  leftHouseholdSuccess: string;
  errorLeavingHousehold: string;
  personalAccountsSharedSuccess: string;
  personalAccountsRevoked: string;
  sharedAccountsUpdatedSuccess: string;
  noAccountsShared: string;
  permissionUpdatedSuccess: string;
  personalAccounts: string;
  noSharedAccounts: string;

  // Household selector & create
  myFinances: string;
  householdTypeIndividual: string;
  householdTypeShared: string;
  manageMembersAndSharedAccounts: string;
  manageMySharedAccounts: string;
  createSharedHousehold: string;
  creating: string;

  // Invites
  myInvites: string;
  confirmCancelInvite: string;

  // Maintenance
  maintenanceInProgress: string;
  maintenanceMessage1: string;
  maintenanceMessage2: string;
  maintenanceEstimatedEnd: string;
  maintenanceTimeRemaining: string;
  maintenanceTryAgainLater: string;

  // Date picker
  selectDate: string;
  confirm: string;
  closeModal: string;

  // WhatsNew
  pleaseScrollToEndToContinue: string;

  destructiveAction: string;
  dangerZone: string;
  typeEmailToConfirm: string;
  emailNotAvailable: string;

  invitesPending: string;
  invitesAccepted: string;
  invitesRejected: string;
  accept: string;
  reject: string;
  noMembersFound: string;
  noBudgetForThisMonth: string;

  // Monthly Recap
  monthlyRecapTitle: string;
  monthlyRecapWelcome: string;
  monthlyRecapSubtitle: string;
  monthlyRecapSummaryTitle: string;
  monthlyRecapTransactionsCount: string;
  monthlyRecapTopCategoryTitle: string;
  monthlyRecapTransactions: string;
  monthlyRecapLargestExpenseTitle: string;
  monthlyRecapComparisonTitle: string;
  monthlyRecapQuiz: string;
  monthlyRecapQuizResultTitle: string;
  monthlyRecapQuizTopCategoryQuestion: string;
  monthlyRecapQuizOtherCategory: string;
  monthlyRecapQuizCorrect: string;
  monthlyRecapQuizIncorrect: string;
  monthlyRecapQuizTopCategoryExplanation: string;
  monthlyRecapQuizIn: string;
  monthlyRecapQuizLargestExpenseQuestion: string;
  monthlyRecapQuizLargestExpenseExplanation: string;
  monthlyRecapQuizBalanceQuestion: string;
  monthlyRecapQuizBalanceExplanation: string;
  monthlyRecapQuizCompleted: string;
  monthlyRecapQuizPerfect: string;
  monthlyRecapQuizGood: string;
  monthlyRecapQuizKeepGoing: string;
  monthlyRecapNextMonthTitle: string;
  monthlyRecapNextMonthMessage: string;
  monthlyRecapNextMonthSubtitle: string;
  monthlyRecapNavigationHint: string;
  monthlyRecapLoading: string;
  
  // Insights Widget
  insightExcellentSavingsRateTitle: string;
  insightExcellentSavingsRateDescription: string;
  insightGoodSavingsRateTitle: string;
  insightGoodSavingsRateDescription: string;
  insightLowSavingsRateTitle: string;
  insightLowSavingsRateDescription: string;
  insightNegativeSavingsRateTitle: string;
  insightNegativeSavingsRateDescription: string;
  insightIncomeIncreaseTitle: string;
  insightIncomeIncreaseDescription: string;
  insightIncomeDecreaseTitle: string;
  insightIncomeDecreaseDescription: string;
  insightExpenseIncreaseTitle: string;
  insightExpenseIncreaseDescription: string;
  insightExpenseDecreaseTitle: string;
  insightExpenseDecreaseDescription: string;
  insightDominantCategoryTitle: string;
  insightDominantCategoryDescription: string;
  insightMajorCategoryTitle: string;
  insightMajorCategoryDescription: string;
  insightStrongEmergencyFundTitle: string;
  insightStrongEmergencyFundDescription: string;
  insightDecentEmergencyFundTitle: string;
  insightDecentEmergencyFundDescription: string;
  insightCriticalNegativeBalanceTitle: string;
  insightCriticalNegativeBalanceDescription: string;
  insightHealthyGrowthTitle: string;
  insightHealthyGrowthDescription: string;
  
  // Forecast Widget
  forecastNextMonth: string;
  forecastSavingsRate: string;
  forecastExcellentMessage: string;
  forecastGoodMessage: string;
  forecastWarningMessage: string;
  forecastCriticalMessage: string;
  forecastNote: string;

  // Statement import (OFX/CSV)
  importStatementButton: string;
  importStatementButtonLabel: string;
  importStatementTitle: string;
  importStatementAccount: string;
  importStatementChooseAccount: string;
  importStatementLoadingAccounts: string;
  importStatementFile: string;
  importStatementHint: string;
  importStatementInvalidFormat: string;
  importStatementNoHousehold: string;
  importStatementSelectAccount: string;
  importStatementSelectFile: string;
  importStatementAnalyzing: string;
  importStatementPreview: string;
  importStatementPreviewFailed: string;
  importStatementUnavailable: string;
  importStatementNewOne: string;
  importStatementNewMany: string;
  importStatementDuplicateOne: string;
  importStatementDuplicateMany: string;
  importStatementEmpty: string;
  importStatementStatus: string;
  importStatementRowNew: string;
  importStatementRowDuplicate: string;
  importStatementNothingNew: string;
  importStatementConfirm: string;
  importStatementImporting: string;
  importStatementConfirmFailed: string;
  importStatementImportedOne: string;
  importStatementImportedMany: string;
  importStatementCardWarning: string;
  importStatementSkippedTitle: string;
  importStatementSkipLine: string;
  importStatementSkipInvalidDate: string;
  importStatementSkipInvalidAmount: string;
  importStatementSkipAmbiguousAmount: string;
  importStatementSkipColumnCount: string;
  importStatementSkipRepeatedId: string;
  importStatementMoreRows: string;
  importStatementPartial: string;
  importStatementBusy: string;
  importStatementTimeout: string;
  cardOfxButton: string;
  cardOfxButtonLabel: string;
  cardOfxTitle: string;
  cardOfxFile: string;
  cardOfxHint: string;
  cardOfxMonth: string;
  cardOfxMonthInvalid: string;
  cardOfxMonthHint: string;
  cardOfxInvalidFormat: string;
  cardOfxTooLarge: string;
  cardOfxSelectFile: string;
  cardOfxAnalyzing: string;
  cardOfxPreview: string;
  cardOfxPreviewFailed: string;
  cardOfxUnavailable: string;
  cardOfxTimeout: string;
  cardOfxMonthFromFile: string;
  cardOfxMonthChosen: string;
  cardOfxPeriod: string;
  cardOfxTotal: string;
  cardOfxLedger: string;
  cardOfxCountNew: string;
  cardOfxCountPayments: string;
  cardOfxWarningMultipleStatements: string;
  cardOfxWarningPeriodEndMissing: string;
  cardOfxWarningCardWithoutDueDay: string;
  cardOfxWarningCardWithoutClosingDay: string;
  cardOfxWarningBalanceMismatch: string;
  cardOfxPaymentTitle: string;
  cardOfxPaymentMatches: string;
  cardOfxPaymentDiffers: string;
  cardOfxPaymentMissing: string;
  cardOfxPaymentUndetermined: string;
  cardOfxSkippedTitle: string;
  cardOfxSkipLine: string;
  cardOfxSkipInvalidAmount: string;
  cardOfxSkipZeroAmount: string;
  cardOfxSkipAmountTooLarge: string;
  cardOfxSkipInvalidDate: string;
  cardOfxSkipMissingId: string;
  cardOfxSkipIdTooLong: string;
  cardOfxStatus: string;
  cardOfxStatusNew: string;
  cardOfxStatusPayment: string;
  cardOfxKindRefund: string;
  cardOfxKindDiscount: string;
  cardOfxMoreLines: string;
  cardOfxPreviewOnly: string;
}

// Note: Some language files may have missing translations. We cast through `unknown`
// to allow partial translations. Missing keys will show the key name as fallback.
const translations: Record<Locale, Translations> = {
  'pt-BR': ptBR as unknown as Translations,
  'en-US': enUS as unknown as Translations,
  'es-ES': esES as unknown as Translations,
  'ja-JP': jaJP as unknown as Translations,
  'ru-RU': ruRU as unknown as Translations,
  'zh-CN': zhCN as unknown as Translations,
  'fr-FR': frFR as unknown as Translations,
  'ar-SA': arSA as unknown as Translations,
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const { data: user, isLoading: userLoading } = useUser();
  const updatePreferences = useUpdateUserPreferences();
  
  const detectInitialLocale = (): Locale => {
    // 1. Tenta localStorage
    const saved = localStorage.getItem('locale');
    if (saved && Object.keys(translations).includes(saved)) {
      return saved as Locale;
    }

    // 2. Tenta inferir pelo Fuso Horário (Localização aproximada sem pedir permissão)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone.includes('Sao_Paulo') || timezone.includes('Brasilia') || timezone.includes('Recife') || timezone.includes('Fortaleza')) return 'pt-BR';
      if (timezone.includes('Europe/Madrid') || timezone.includes('America/Mexico_City') || timezone.includes('America/Argentina') || timezone.includes('America/Bogota') || timezone.includes('America/Santiago')) return 'es-ES';
      if (timezone.includes('Paris') || timezone.includes('Brussels') || timezone.includes('Montreal') || timezone.includes('Zurich')) return 'fr-FR';
      if (timezone.includes('Tokyo')) return 'ja-JP';
      if (timezone.includes('Moscow')) return 'ru-RU';
      if (timezone.includes('Shanghai') || timezone.includes('Hong_Kong') || timezone.includes('Taipei')) return 'zh-CN';
      if (timezone.includes('Riyadh') || timezone.includes('Dubai') || timezone.includes('Cairo') || timezone.includes('Casablanca')) return 'ar-SA';
    } catch (e) {
      // Silenciosamente falha se o navegador não suportar
    }

    // 3. Tenta as linguagens do navegador
    if (typeof navigator !== 'undefined') {
      const browserLanguages = navigator.languages || [navigator.language];
      for (const lang of browserLanguages) {
        if (lang.startsWith('pt')) return 'pt-BR';
        if (lang.startsWith('es')) return 'es-ES';
        if (lang.startsWith('fr')) return 'fr-FR';
        if (lang.startsWith('ar')) return 'ar-SA';
        if (lang.startsWith('ja')) return 'ja-JP';
        if (lang.startsWith('ru')) return 'ru-RU';
        if (lang.startsWith('zh')) return 'zh-CN';
        if (lang.startsWith('en')) return 'en-US';
      }
    }

    // 4. Fallback para pt-BR
    return 'pt-BR';
  };

  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);
  const [isInitialized, setIsInitialized] = useState(false);
  const isUpdatingFromBackend = useRef(false);
  const lastSavedLocale = useRef<Locale | null>(null);
  const updatePreferencesRef = useRef(updatePreferences);
  updatePreferencesRef.current = updatePreferences;

  // Carregar preferências do backend quando o usuário fizer login
  useEffect(() => {
    if (!currentUser || userLoading) {
      if (!currentUser) {
        // Se não estiver logado, usa localStorage como fallback
        const saved = localStorage.getItem('locale');
        if (saved) {
          setLocaleState(saved as Locale);
        }
        setIsInitialized(true);
      }
      return;
    }

    if (user?.locale) {
      const backendLocale = user.locale as Locale;
      // Só atualizar se for diferente do valor atual
      if (backendLocale !== locale) {
        // Marcar que estamos atualizando do backend para evitar loop
        isUpdatingFromBackend.current = true;
        lastSavedLocale.current = backendLocale;
        setLocaleState(backendLocale);
        localStorage.setItem('locale', backendLocale);
        // Resetar flag após um pequeno delay
        setTimeout(() => {
          isUpdatingFromBackend.current = false;
        }, 100);
      }
    }
    setIsInitialized(true);
  }, [currentUser, user, userLoading, locale]);

  // Salvar no backend quando mudar (mas não durante o carregamento inicial ou quando vier do backend)
  useEffect(() => {
    if (!isInitialized || !currentUser || userLoading || isUpdatingFromBackend.current) return;
    
    // Não salvar se o valor não mudou desde a última vez que salvamos
    if (lastSavedLocale.current === locale) return;

    const timeoutId = setTimeout(() => {
      if (!isUpdatingFromBackend.current && lastSavedLocale.current !== locale) {
        lastSavedLocale.current = locale;
        updatePreferencesRef.current.mutate({ locale });
      }
    }, 500); // Aumentar delay para evitar múltiplas chamadas

    return () => clearTimeout(timeoutId);
  }, [locale, currentUser, isInitialized, userLoading]);

  // Salvar no localStorage sempre que o idioma mudar (para todos os usuários)
  useEffect(() => {
    if (locale) {
      localStorage.setItem('locale', locale);
    }
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    if (currentUser && isInitialized) {
      lastSavedLocale.current = newLocale;
      updatePreferencesRef.current.mutate({ locale: newLocale });
    }
  }, [currentUser, isInitialized]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t: translations[locale],
  }), [locale, setLocale]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};

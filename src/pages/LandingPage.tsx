import { Link } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { CreditCard, Target, BarChart3, Shield, ArrowRight, Sun, Moon, Users, Check } from 'lucide-react';
import { useI18n, Locale } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { analyticsHelpers } from '../utils/analytics';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useCurrency, CurrencyCode } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/format';
import SelectCombobox from '../components/SelectCombobox';
import RectaMark from '../components/RectaMark';
import { APP_STORE_URL, COMMUNITY_URL, GOOGLE_PLAY_URL, FEEDBACK_BOARD_URL, OTHER_APPS, SUPPORT_EMAIL } from '../constants/links';

const LandingPage = () => {
  const { t, locale, setLocale } = useI18n();
  const { currentUser } = useAuth();
  // Don't fetch user data on landing page - not needed and prevents unnecessary queries
  const { theme, toggleTheme } = useTheme();
  const { baseCurrency, setBaseCurrency } = useCurrency();
  
  // Mapping of Locale to a default Currency for demo purposes
  const LOCALE_CURRENCY_MAP: Record<string, CurrencyCode> = useMemo(() => ({
    'pt-BR': 'BRL',
    'en-US': 'USD',
    'es-ES': 'EUR',
    'fr-FR': 'EUR',
    'ja-JP': 'JPY',
    'ru-RU': 'RUB',
    'zh-CN': 'CNY',
    'ar-SA': 'SAR',
  }), []);

  // Update baseCurrency when locale changes (only for non-logged in users on landing page)
  useEffect(() => {
    if (!currentUser && LOCALE_CURRENCY_MAP[locale]) {
      setBaseCurrency(LOCALE_CURRENCY_MAP[locale]);
    }
  }, [locale, currentUser, LOCALE_CURRENCY_MAP, setBaseCurrency]);

  // Animated words for the hero title
  const words = useMemo(() => [
    t.landingHeroWord1,
    t.landingHeroWord2,
    t.landingHeroWord3,
    t.landingHeroWord4
  ], [t.landingHeroWord1, t.landingHeroWord2, t.landingHeroWord3, t.landingHeroWord4]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [displayText, setDisplayText] = useState(words[0] || '');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // ... rest of state ...
  const featuresSectionRef = useRef<HTMLElement>(null);
  const widgetSectionRef = useRef<HTMLElement>(null);
  const securitySectionRef = useRef<HTMLElement>(null);
  const freeSectionRef = useRef<HTMLElement>(null);
  const ctaSectionRef = useRef<HTMLElement>(null);
  const [isFeaturesVisible, setIsFeaturesVisible] = useState(false);
  const [isWidgetVisible, setIsWidgetVisible] = useState(false);
  const [isSecurityVisible, setIsSecurityVisible] = useState(false);
  const [isFreeVisible, setIsFreeVisible] = useState(false);
  const [isCtaVisible, setIsCtaVisible] = useState(false);
  
  // Demo data for the widget
  const demoExpensesByCategory = [
    { name: t.landingDemoCategory1, value: 1200 },
    { name: t.landingDemoCategory2, value: 800 },
    { name: t.landingDemoCategory3, value: 550 },
  ];
  
  // Update displayText when words change (locale change)
  useEffect(() => {
    setDisplayText(words[currentWordIndex] || '');
  }, [locale, words, currentWordIndex]);

  const COLORS = ['#5B3DF5', '#C6F25B', '#8F7BFF'];
  
  // Languages for the selector
  const languages = [
    { code: 'pt-BR', name: 'Português', flag: '🇧🇷' },
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
    { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
    { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
    { code: 'ru-RU', name: 'Русский', flag: '🇷🇺' },
    { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
    { code: 'ar-SA', name: 'العربية', flag: '🇸🇦' },
  ];

  // ... rest of effects ...
  
  // Intersection Observer for scroll animations and analytics
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const sectionViewed = new Set<string>();
    
    const createObserver = (ref: React.RefObject<HTMLElement>, setVisible: (value: boolean) => void, sectionName: string) => {
      if (!ref.current) return null;
      
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisible(true);
              // Track section view only once
              if (!sectionViewed.has(sectionName)) {
                sectionViewed.add(sectionName);
                analyticsHelpers.logLandingSectionViewed(sectionName);
              }
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -100px 0px' }
      );
      
      observer.observe(ref.current);
      return observer;
    };
    
    const featuresObserver = createObserver(featuresSectionRef, setIsFeaturesVisible, 'features');
    const widgetObserver = createObserver(widgetSectionRef, setIsWidgetVisible, 'widget_demo');
    const securityObserver = createObserver(securitySectionRef, setIsSecurityVisible, 'security');
    const freeObserver = createObserver(freeSectionRef, setIsFreeVisible, 'free');
    const ctaObserver = createObserver(ctaSectionRef, setIsCtaVisible, 'cta');
    
    if (featuresObserver) observers.push(featuresObserver);
    if (widgetObserver) observers.push(widgetObserver);
    if (securityObserver) observers.push(securityObserver);
    if (freeObserver) observers.push(freeObserver);
    if (ctaObserver) observers.push(ctaObserver);
    
    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, []);

  // Scroll depth tracking
  useEffect(() => {
    const trackedDepths = new Set<number>();
    const milestones = [25, 50, 75, 100];

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercentage = Math.round((scrollTop / documentHeight) * 100);

      milestones.forEach((milestone) => {
        if (scrollPercentage >= milestone && !trackedDepths.has(milestone)) {
          trackedDepths.add(milestone);
          analyticsHelpers.logLandingScrollDepth(milestone);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const currentWord = words[currentWordIndex];
    
    if (isDeleting) {
      // Deleting characters
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(currentWord.slice(0, displayText.length - 1));
        }, 100);
      } else {
        // Move to next word
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % words.length);
      }
    } else {
      // Typing characters
      if (displayText.length < currentWord.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentWord.slice(0, displayText.length + 1));
        }, 150);
      } else {
        // Wait before deleting
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, currentWordIndex, isDeleting, words]);

  // Structured data for AI optimization
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": t.landingSeoTitle,
    "description": t.landingSeoDescription,
    "url": "https://www.recta.app/",
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "Recta",
      "applicationCategory": "FinanceApplication"
    }
  };

  const heroScreenshot = locale === 'pt-BR' ? '/landing/app-home-pt-BR.webp' : '/landing/app-home-en-US.webp';

  const primaryCta = currentUser
    ? { to: '/app', label: t.landingGoToApp }
    : { to: '/login?action=signup', label: t.landingGetStarted };

  const features = [
    { icon: CreditCard, title: t.landingFeature1Title, description: t.landingFeature1Description },
    { icon: Target, title: t.landingFeature2Title, description: t.landingFeature2Description },
    { icon: BarChart3, title: t.landingFeature3Title, description: t.landingFeature3Description },
    { icon: Users, title: t.landingFeature4Title, description: t.landingFeature4Description },
  ];

  return (
    <div className="min-h-screen bg-paper dark:bg-ink text-ink dark:text-paper">
      {/* Structured Data for AI */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Navigation */}
      <nav className="bg-paper/85 dark:bg-ink/85 backdrop-blur-md border-b border-ink/5 dark:border-white/5 sticky top-0 z-50 animate-fade-in-up" aria-label={t.landingNavAriaLabel}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link
              to="/home"
              className="mark-hover flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              onClick={() => analyticsHelpers.logLandingNavClicked('logo')}
            >
              <RectaMark className="h-6 w-auto text-ink dark:text-paper" />
              <span className="text-xl font-semibold tracking-tight text-ink dark:text-paper">Recta</span>
            </Link>
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Desktop Language Selector */}
              <div className="hidden sm:block">
                <SelectCombobox
                  value={locale}
                  onValueChange={(value) => setLocale(value as Locale)}
                  options={languages.map((lang) => ({
                    value: lang.code,
                    label: `${lang.flag} ${lang.name}`
                  }))}
                  placeholder={t.selectLanguage}
                />
              </div>

              {/* Mobile Language Selector (Flag only) */}
              <div className="sm:hidden">
                <SelectCombobox
                  value={locale}
                  onValueChange={(value) => setLocale(value as Locale)}
                  options={languages.map((lang) => ({
                    value: lang.code,
                    label: lang.flag
                  }))}
                  placeholder="🌐"
                />
              </div>

              <Link
                to={currentUser ? '/app' : '/login?action=login'}
                className="rounded-full bg-ink text-paper dark:bg-paper dark:text-ink px-4 py-2 text-sm font-medium transition-transform duration-200 hover:scale-[1.03] active:scale-95"
                onClick={() => analyticsHelpers.logLandingNavClicked(currentUser ? 'go_to_app' : 'login')}
              >
                {currentUser ? t.landingGoToApp : t.landingLoginButton}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" aria-label={t.landingMainContentAriaLabel}>
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-16 lg:pt-24 lg:pb-28" aria-label={t.landingHeroSectionAriaLabel}>
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
            <div className="animate-fade-in-left">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-ink-soft border border-ink/10 dark:border-white/10 pl-2 pr-3.5 py-1 text-sm font-medium mb-6 hover:border-brand-400 transition-colors"
                onClick={() => analyticsHelpers.logLandingNavClicked('app_store_badge')}
              >
                <span className="h-2 w-2 rounded-full bg-lime ring-4 ring-lime/30" aria-hidden="true" />
                {t.landingNowOnIphone}
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </a>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl !font-semibold !tracking-tight leading-[1.05] mb-6 animate-fade-in-up animate-delay-100">
                <span className="block">
                  {t.landingHeroTitle.split(' ').slice(0, -1).join(' ')}
                </span>
                <span className="block text-brand-600 dark:text-brand-400 mt-1 min-h-[1.1em]">
                  {displayText}
                  <span className="animate-pulse font-light">|</span>
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-ink/70 dark:text-paper/70 mb-8 max-w-xl animate-fade-in-up animate-delay-200">
                {t.landingHeroSubtitle}
              </p>
              <div className="animate-fade-in-up animate-delay-300">
                <StoreBadges t={t} location="hero" />
                <Link
                  to={primaryCta.to}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink/70 dark:text-paper/70 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group"
                  onClick={() => analyticsHelpers.logLandingCtaClicked('hero', !!currentUser)}
                >
                  {currentUser ? t.landingGoToApp : t.landingOrUseWeb}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 rtl:rotate-180 transition-transform" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="animate-fade-in-right animate-delay-200">
              <div className="relative mx-auto max-w-[420px] rounded-[2.5rem] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 px-8 pt-10 overflow-hidden shadow-2xl shadow-brand-600/25">
                <div className="relative mx-auto w-[78%] rounded-t-[2.6rem] border-[7px] border-b-0 border-ink bg-ink overflow-hidden translate-y-2">
                  <img
                    src={heroScreenshot}
                    alt={t.landingAppScreenshotAlt}
                    width={660}
                    height={1434}
                    className="block w-full h-auto rounded-t-[2.1rem] max-h-[520px] object-cover object-top"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section ref={featuresSectionRef} className="bg-white dark:bg-ink-soft py-20 lg:py-24 border-y border-ink/5 dark:border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`max-w-2xl mb-12 transition-opacity duration-700 ${isFeaturesVisible ? 'opacity-100 animate-fade-in-up' : 'opacity-0'}`}>
              <h2 className="text-3xl lg:text-4xl !font-semibold !tracking-tight mb-4">
                {t.landingFeaturesTitle}
              </h2>
              <p className="text-lg text-ink/70 dark:text-paper/70">
                {t.landingFeaturesSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-12">
              {features.map(({ icon: Icon, title, description }, index) => (
                <div
                  key={title}
                  className={`group rounded-3xl bg-paper dark:bg-ink p-7 sm:p-8 border border-ink/5 dark:border-white/5 hover:border-brand-300 dark:hover:border-brand-700 hover:-translate-y-0.5 transition-all duration-300 ${isFeaturesVisible ? `opacity-100 animate-fade-in-up animate-delay-${(index + 1) * 100}` : 'opacity-0'}`}
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/50 text-brand-600 dark:text-brand-300 mb-5 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl !font-semibold mb-2">{title}</h3>
                  <p className="text-ink/70 dark:text-paper/70 leading-relaxed">{description}</p>
                </div>
              ))}
            </div>

            <div className={`transition-opacity duration-700 ${isFeaturesVisible ? 'opacity-100 animate-fade-in-up animate-delay-500' : 'opacity-0'}`}>
              <Link
                to={primaryCta.to}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 hover:bg-brand-700 text-white px-7 py-3 text-base font-medium transition-all duration-200 hover:scale-[1.03] active:scale-95 group"
                onClick={() => analyticsHelpers.logLandingCtaClicked('features', !!currentUser)}
              >
                {primaryCta.label}
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 rtl:rotate-180 transition-transform" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Widget Demo Section */}
        <section ref={widgetSectionRef} className="py-20 lg:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`max-w-2xl mb-12 transition-opacity duration-700 ${isWidgetVisible ? 'opacity-100 animate-fade-in-up' : 'opacity-0'}`}>
              <h2 className="text-3xl lg:text-4xl !font-semibold !tracking-tight mb-4">
                {t.landingWidgetTitle}
              </h2>
              <p className="text-lg text-ink/70 dark:text-paper/70">
                {t.landingWidgetSubtitle}
              </p>
            </div>

            <div className={`grid lg:grid-cols-2 gap-6 items-center transition-opacity duration-700 ${isWidgetVisible ? 'opacity-100' : 'opacity-0'}`}>
              <div className={`${isWidgetVisible ? 'animate-fade-in-left' : ''}`}>
                <div className="rounded-3xl bg-white dark:bg-ink-soft p-6 border border-ink/5 dark:border-white/5 shadow-xl shadow-ink/5">
                  <h3 className="text-lg !font-semibold mb-4 flex items-center">
                    <BarChart3 className="h-5 w-5 me-2 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    {t.landingWidgetChartTitle}
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={demoExpensesByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={88}
                        paddingAngle={3}
                        stroke="none"
                        dataKey="value"
                      >
                        {demoExpensesByCategory.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value, baseCurrency)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2.5">
                    {demoExpensesByCategory.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                          <div
                            className="w-2.5 h-2.5 rounded-full me-2"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-ink/70 dark:text-paper/70">{item.name}</span>
                        </div>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(item.value, baseCurrency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`space-y-4 ${isWidgetVisible ? 'animate-fade-in-right' : ''}`}>
                {[
                  { icon: BarChart3, title: t.landingDetailedReportsTitle, description: t.landingDetailedReportsDesc },
                  { icon: Target, title: t.landingAutomaticInsightsTitle, description: t.landingAutomaticInsightsDesc },
                ].map(({ icon: Icon, title, description }) => (
                  <div key={title} className="rounded-3xl bg-white dark:bg-ink-soft p-6 border border-ink/5 dark:border-white/5">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 rounded-2xl bg-brand-100 dark:bg-brand-900/50 p-3 text-brand-600 dark:text-brand-300">
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="text-lg !font-semibold mb-1.5">{title}</h3>
                        <p className="text-ink/70 dark:text-paper/70">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section ref={securitySectionRef} className="bg-ink text-paper dark:bg-ink-soft py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`max-w-3xl mx-auto text-center transition-all duration-700 ${isSecurityVisible ? 'opacity-100 animate-fade-in-up' : 'opacity-0'}`}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-lime text-ink mb-5">
                <Shield className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="text-2xl lg:text-3xl !font-semibold !tracking-tight mb-4">
                {t.landingSecurityTitle}
              </h2>
              <p className="text-lg text-paper/70">
                {t.landingSecurityDescription}
              </p>
            </div>
          </div>
        </section>

        {/* Free Section */}
        <section ref={freeSectionRef} className="py-20 lg:py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`rounded-[2rem] bg-white dark:bg-ink-soft border border-ink/5 dark:border-white/5 p-8 sm:p-12 shadow-xl shadow-ink/5 transition-opacity duration-700 ${isFreeVisible ? 'opacity-100 animate-fade-in-up' : 'opacity-0'}`}>
              <div className="text-center mb-10">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-lime text-ink mb-4">
                  {t.landingFreeBadge}
                </div>
                <h2 className="text-3xl lg:text-4xl !font-semibold !tracking-tight mb-4">
                  {t.landingFreeTitle}
                </h2>
                <p className="text-lg text-ink/70 dark:text-paper/70 max-w-2xl mx-auto">
                  {t.landingFreeSubtitle}
                </p>
              </div>

              <ul className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto mb-10">
                {[
                  t.landingFreeItem1,
                  t.landingFreeItem2,
                  t.landingFreeItem3,
                  t.landingFreeItem4,
                  t.landingFreeItem5,
                  t.landingFreeItem6,
                ].map((item) => (
                  <li key={item} className="flex items-start">
                    <span className="me-3 mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-ink/80 dark:text-paper/80">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="text-center">
                <Link
                  to={primaryCta.to}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 hover:bg-brand-700 text-white px-7 py-3 text-base font-medium transition-all duration-200 hover:scale-[1.03] active:scale-95 group"
                  onClick={() => analyticsHelpers.logLandingCtaClicked('free', !!currentUser)}
                >
                  {primaryCta.label}
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 rtl:rotate-180 transition-transform" aria-hidden="true" />
                </Link>
                <p className="text-sm text-ink/50 dark:text-paper/50 mt-4">
                  {t.landingFreeNote}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section: get the app */}
        <section ref={ctaSectionRef} className="px-4 sm:px-6 lg:px-8 pb-20 lg:pb-24">
          <div className="relative max-w-6xl mx-auto overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 px-6 py-14 sm:px-12 sm:py-16 text-center">
            <RectaMark
              className="absolute left-10 bottom-10 h-28 w-auto text-white hidden sm:block"
              topColor="#FFFFFF"
              opacity={0.1}
            />
            <RectaMark
              className={`relative mx-auto h-10 w-auto text-white mb-6 transition-opacity duration-700 ${isCtaVisible ? 'opacity-100 animate-fade-in-up' : 'opacity-0'}`}
              topColor="#FFFFFF"
            />
            <h2 className={`relative text-3xl lg:text-4xl !font-semibold !tracking-tight text-white mb-4 transition-opacity duration-700 ${isCtaVisible ? 'opacity-100 animate-fade-in-up animate-delay-200' : 'opacity-0'}`}>
              {t.landingMobileTitle}
            </h2>
            <p className={`relative text-lg text-white/80 mb-8 max-w-2xl mx-auto transition-opacity duration-700 ${isCtaVisible ? 'opacity-100 animate-fade-in-up animate-delay-300' : 'opacity-0'}`}>
              {t.landingMobileDescription}
            </p>
            <div className={`relative flex flex-col items-center transition-opacity duration-700 ${isCtaVisible ? 'opacity-100 animate-fade-in-up animate-delay-400' : 'opacity-0'}`}>
              <StoreBadges t={t} location="final_cta" centered />
              <Link
                to={primaryCta.to}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white transition-colors group"
                onClick={() => analyticsHelpers.logLandingCtaClicked('final_cta', !!currentUser)}
              >
                {currentUser ? t.landingGoToApp : t.landingOrUseWeb}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 rtl:rotate-180 transition-transform" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer: same structure as the other oprimo.dev product sites (brand, product, legal, more apps, rights) */}
      <footer className="bg-ink text-paper/70 border-t border-white/5 pt-14 pb-9">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.2fr]">
          <div>
            <p className="mark-hover flex w-fit items-center gap-2.5 text-paper">
              <RectaMark className="h-5 w-auto text-paper" topColor="#8F7BFF" />
              <span className="text-lg font-semibold tracking-tight">Recta</span>
            </p>
            <p className="mt-3 max-w-[34ch] text-sm leading-relaxed">{t.footerTagline}</p>
            <div className="mt-4 max-w-[220px]">
              <SelectCombobox
                value={locale}
                onValueChange={(value) => setLocale(value as Locale)}
                options={languages.map((lang) => ({
                  value: lang.code,
                  label: `${lang.flag} ${lang.name}`
                }))}
                placeholder={t.selectLanguage}
              />
            </div>
          </div>

          <FooterColumn title={t.footerProduct}>
            <li><a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={footerLink}>App Store</a></li>
            <li><a href={GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer" className={footerLink}>Google Play</a></li>
            <li><Link to={currentUser ? '/app' : '/login'} className={footerLink}>{t.footerWebApp}</Link></li>
            <li><Link to="/support" className={footerLink}>{t.footerSupport}</Link></li>
            <li><a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer" className={footerLink}>{t.community}</a></li>
            <li><a href={FEEDBACK_BOARD_URL} target="_blank" rel="noopener noreferrer" className={footerLink}>{t.feedbackBoardNav}</a></li>
            <li><a href={`mailto:${SUPPORT_EMAIL}`} className={footerLink}>{SUPPORT_EMAIL}</a></li>
          </FooterColumn>

          <FooterColumn title={t.footerLegal}>
            <li><Link to="/privacy" className={footerLink}>{t.footerPrivacy}</Link></li>
            <li><Link to="/terms" className={footerLink}>{t.footerTerms}</Link></li>
          </FooterColumn>

          <FooterColumn title={t.footerMoreApps}>
            {OTHER_APPS.map((app) => (
              <li key={app.name}>
                <a href={app.href} target="_blank" rel="noopener" className={footerLink}>{app.name}</a>
                <span className="block text-[12.5px] text-paper/45">{t[app.blurbKey]}</span>
              </li>
            ))}
          </FooterColumn>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          <p className="border-t border-white/10 pt-5 text-[13px] text-paper/45">
            © {new Date().getFullYear()} PRIMODEV CONSULTORIA EM TI LTDA · oprimo.dev
          </p>
        </div>
      </footer>

      {/* Theme Toggle Button - Floating */}
      <button
        onClick={() => {
          toggleTheme();
          analyticsHelpers.logLandingThemeToggled(theme === 'dark' ? 'light' : 'dark');
        }}
        className="fixed bottom-6 right-6 z-50 p-3 bg-white dark:bg-ink-soft rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 border border-ink/10 dark:border-white/10"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-5 w-5 text-lime" />
        ) : (
          <Moon className="h-5 w-5 text-ink" />
        )}
      </button>

    </div>
  );
};

type LandingTranslations = ReturnType<typeof useI18n>['t'];

const footerLink = 'text-[14.5px] text-paper/70 hover:text-paper hover:underline underline-offset-2 transition-colors';

/** A titled link list in the footer, same typography as the other oprimo.dev sites. */
const FooterColumn = ({ title, children }: { title: string; children: ReactNode }) => (
  <nav aria-label={title}>
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-paper/45">{title}</h2>
    <ul className="space-y-2.5">{children}</ul>
  </nav>
);

/**
 * App Store and Google Play links, styled like the official badges: dark pill, store glyph,
 * two text lines.
 */
const StoreBadges = ({ t, location, centered = false }: { t: LandingTranslations; location: string; centered?: boolean }) => (
  <div className={`flex flex-wrap gap-3 ${centered ? 'justify-center' : ''}`}>
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-3 rounded-2xl bg-ink dark:bg-black text-white ps-4 pe-5 py-2.5 ring-1 ring-white/10 dark:ring-white/20 transition-transform duration-200 hover:scale-[1.03] active:scale-95"
      onClick={() => analyticsHelpers.logLandingNavClicked(`app_store_${location}`)}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
      </svg>
      <span className="flex flex-col text-start leading-tight">
        <span className="text-[11px] opacity-80">{t.landingDownloadOn}</span>
        <span className="text-lg font-semibold -mt-0.5">App Store</span>
      </span>
    </a>
    <a
      href={GOOGLE_PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-3 rounded-2xl bg-ink dark:bg-black text-white ps-4 pe-5 py-2.5 ring-1 ring-white/10 dark:ring-white/20 transition-transform duration-200 hover:scale-[1.03] active:scale-95"
      onClick={() => analyticsHelpers.logLandingNavClicked(`google_play_${location}`)}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
        <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
      </svg>
      <span className="flex flex-col text-start leading-tight">
        <span className="text-[11px] opacity-80">{t.landingGetItOn}</span>
        <span className="text-lg font-semibold -mt-0.5">Google Play</span>
      </span>
    </a>
  </div>
);

export default LandingPage;

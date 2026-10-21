import { Sun, Moon } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';

interface OnboardingStep2ThemeProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

export const OnboardingStep2Theme = ({ theme, onThemeChange }: OnboardingStep2ThemeProps) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h3 className="text-xl font-semibold text-content mb-2">
          {t.onboardingStep2ThemeTitle}
        </h3>
        <p className="text-content-secondary mb-6 animate-fade-in-up animate-delay-100">
          {t.onboardingStep2ThemeDescription}
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up animate-delay-200">
          <button
            type="button"
            onClick={() => onThemeChange('light')}
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
            onClick={() => onThemeChange('dark')}
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
  );
};

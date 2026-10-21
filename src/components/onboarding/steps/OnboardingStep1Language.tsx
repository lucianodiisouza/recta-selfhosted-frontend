import { useI18n, Locale } from '../../../context/I18nContext';
import SelectCombobox from '../../SelectCombobox';
import { LANGUAGES } from '../../../utils/onboardingData';

interface OnboardingStep1LanguageProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  errors?: { locale?: { message?: string } };
}

export const OnboardingStep1Language = ({ locale, onLocaleChange, errors }: OnboardingStep1LanguageProps) => {
  const { t } = useI18n();

  return (
    <form className="space-y-6">
      <div className="animate-fade-in-up">
        <h3 className="text-xl font-semibold text-content mb-2">
          {t.onboardingStep1Title}
        </h3>
        <p className="text-content-secondary mb-4 animate-fade-in-up animate-delay-100">
          {t.onboardingStep1Description}
        </p>
        <div className="animate-fade-in-up animate-delay-200">
          <SelectCombobox
            value={locale}
            onValueChange={(value) => onLocaleChange(value as Locale)}
            options={LANGUAGES.map(lang => ({ value: lang.code, label: lang.name }))}
            placeholder={t.selectLanguage}
            searchable={true}
          />
          {errors?.locale && (
            <p className="mt-2 text-sm text-negative" role="alert">
              {errors.locale.message}
            </p>
          )}
        </div>
      </div>
    </form>
  );
};

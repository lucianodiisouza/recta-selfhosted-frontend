import { useI18n } from '../../../context/I18nContext';
import { CurrencyCode } from '../../../context/CurrencyContext';
import SelectCombobox from '../../SelectCombobox';
import { COUNTRIES } from '../../../utils/onboardingData';
import { CURRENCY_LIST } from '../../../context/CurrencyContext';

interface OnboardingStep3CountryCurrencyProps {
  country: string;
  currency: CurrencyCode;
  onCountryChange: (country: string) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
  errors?: { country?: { message?: string }; currency?: { message?: string } };
}

export const OnboardingStep3CountryCurrency = ({
  country,
  currency,
  onCountryChange,
  onCurrencyChange,
  errors,
}: OnboardingStep3CountryCurrencyProps) => {
  const { t } = useI18n();

  return (
    <form className="space-y-6">
      <div className="animate-fade-in-up">
        <h3 className="text-xl font-semibold text-content mb-2">
          {t.onboardingStep3Title}
        </h3>
        <p className="text-content-secondary mb-4 animate-fade-in-up animate-delay-100">
          {t.onboardingStep3Description}
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              {t.countryLabel}
            </label>
            <div className="animate-fade-in-up animate-delay-200">
              <SelectCombobox
                value={country}
                onValueChange={onCountryChange}
                options={COUNTRIES.map(country => ({ value: country.code, label: country.name }))}
                placeholder={t.selectCountry}
                searchable={true}
              />
              {errors?.country && (
                <p className="mt-2 text-sm text-negative" role="alert">
                  {errors.country.message}
                </p>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-2">
              {t.currencyLabel}
            </label>
            <div className="animate-fade-in-up animate-delay-300">
              <SelectCombobox
                value={currency}
                onValueChange={(value) => onCurrencyChange(value as CurrencyCode)}
                options={CURRENCY_LIST.map(curr => ({ value: curr.code, label: `${curr.symbol} - ${curr.name} (${curr.code})` }))}
                placeholder={t.selectCurrency}
                searchable={true}
              />
              {errors?.currency && (
                <p className="mt-2 text-sm text-negative" role="alert">
                  {errors.currency.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

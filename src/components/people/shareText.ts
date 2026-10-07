import type { Translations } from '../../context/I18nContext';
import type { ShareDirection, SplitStrategy } from '../../hooks/api/usePeople';
import { fillText } from '../../utils/people';
import type { FormError, RowError } from '../../utils/shares';

// Turns the codes of utils/shares.ts into translated text (the pure module has no language).

export function directionText(t: Translations, direction: ShareDirection): string {
  return direction === 'THEY_OWE_ME' ? t.peopleDirectionTheyOweMe : t.peopleDirectionIOweThem;
}

export function strategyText(t: Translations, strategy: SplitStrategy): string {
  switch (strategy) {
    case 'equal':
      return t.peopleStrategyEqual;
    case 'exact':
      return t.peopleStrategyExact;
    case 'percent':
      return t.peopleStrategyPercent;
    case 'shares':
      return t.peopleStrategyShares;
  }
}

export function rowErrorText(t: Translations, error: RowError): string {
  switch (error) {
    case 'no-person':
      return t.peopleErrRowNoPerson;
    case 'duplicate':
      return t.peopleErrRowDuplicate;
    case 'amount':
      return t.peopleErrRowAmount;
    case 'percent':
      return t.peopleErrRowPercent;
    case 'shares':
      return t.peopleErrRowShares;
    case 'zero-part':
      return t.peopleErrRowZero;
  }
}

export function formErrorText(t: Translations, error: FormError, money: (cents: number) => string): string {
  switch (error.code) {
    case 'my-shares':
      return t.peopleErrMyShares;
    case 'percent-over':
      return t.peopleErrPercentOver;
    case 'too-many':
      return fillText(t.peopleMaxEntries, { max: error.max });
    case 'no-total':
      return t.peopleErrNoTotal;
    case 'sum-over':
      return fillText(t.peopleErrSumOver, { sum: money(error.sumCents), total: money(error.totalCents) });
  }
}

/** What is left of the transaction: my part when they owe me, the rest otherwise. */
export function restLabel(t: Translations, direction: ShareDirection): string {
  return direction === 'THEY_OWE_ME' ? t.peopleRestMine : t.peopleRestLeft;
}

import type { Translations } from '../../context/I18nContext';
import { balanceStatus, fillText } from '../../utils/people';
import type { BalanceKind, LedgerKind, PersonFormError } from '../../utils/people';

// Turns the codes of utils/people.ts into translated text. The pure module stays free of strings so it can be tested
// without a language; every visible string of the people screens comes from the i18n files.

export const BALANCE_TONE: Record<BalanceKind, string> = {
  'owes-me': 'text-green-600 dark:text-green-400',
  'i-owe': 'text-red-600 dark:text-red-400',
  settled: 'text-gray-600 dark:text-gray-400',
};

/** "Maria owes you R$ 10,00" / "You owe R$ 10,00 to Maria" / "All settled with Maria". */
export function balanceSentence(t: Translations, name: string, balance: number, money: (cents: number) => string): string {
  const status = balanceStatus(balance);
  if (status.kind === 'owes-me') return fillText(t.peopleOwesYou, { name, amount: money(status.cents) });
  if (status.kind === 'i-owe') return fillText(t.peopleYouOwe, { name, amount: money(status.cents) });
  return fillText(t.peopleSettledWith, { name });
}

export function ledgerKindText(t: Translations, kind: LedgerKind): string {
  switch (kind) {
    case 'their-share':
      return t.peopleKindTheirShare;
    case 'my-share':
      return t.peopleKindMyShare;
    case 'received':
      return t.peopleKindReceived;
    case 'paid':
      return t.peopleKindPaid;
  }
}

/** Null for an empty name: the disabled Save button is the cue, and an error before the first keystroke would only nag. */
export function personFormErrorText(t: Translations, error: PersonFormError): string | null {
  switch (error.code) {
    case 'name-required':
      return null;
    case 'name-too-long':
      return fillText(t.peopleErrNameTooLong, { max: error.max });
    case 'too-many-aliases':
      return fillText(t.peopleErrTooManyAliases, { max: error.max });
    case 'alias-too-long':
      return fillText(t.peopleErrAliasTooLong, { max: error.max });
    case 'name-taken':
      return fillText(t.peopleErrNameTaken, { label: error.label, name: error.owner });
  }
}

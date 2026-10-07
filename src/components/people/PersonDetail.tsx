import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useDeletePerson, usePersonLedger } from '../../hooks/api/usePeople';
import type { LedgerEntry, Person, PersonBalance } from '../../hooks/api/usePeople';
import { useToastContext } from '../../context/ToastContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency, formatDate, parseDateFromAPI } from '../../utils/format';
import { balanceStatus, fillText, ledgerKind, reaisToCents } from '../../utils/people';
import { BALANCE_TONE, balanceSentence, ledgerKindText } from './peopleText';
import {
  BOX_CLS, BTN_DANGER, BTN_SECONDARY, Chip, ERROR_CLS, H4_CLS, MUTED_CLS, TABLE_WRAP_CLS, TBODY_CLS, TD_CLS, TH_CLS, THEAD_ROW_CLS,
  getErrorMessage,
} from './ui';

interface PersonDetailProps {
  householdId: string | undefined;
  person: Person;
  /** Null for a person the balances endpoint leaves out (inactive with a zero balance). */
  balance: PersonBalance | null;
  canEdit: boolean;
  onEdit: (person: Person) => void;
  /** The person is gone (204): the page stops showing them. */
  onDeleted: () => void;
}

/** The person's detail: balance, actions and the ledger (cursor pages, running balance). */
const PersonDetail = ({ householdId, person, balance, canEdit, onEdit, onDeleted }: PersonDetailProps) => {
  const { t } = useI18n();
  const { success, error: showError } = useToastContext();
  const { baseCurrency } = useCurrency();
  const money = (cents: number): string => formatCurrency(cents / 100, baseCurrency);
  const signedMoney = (cents: number): string => `${cents > 0 ? '+' : cents < 0 ? '-' : ''}${money(Math.abs(cents))}`;

  const ledger = usePersonLedger(householdId, person.id);
  const deletePerson = useDeletePerson();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  // Opening the confirmation moves focus into it (on the safe choice), so a keyboard user lands on it
  useEffect(() => {
    if (confirmingDelete) cancelDeleteRef.current?.focus();
  }, [confirmingDelete]);

  const entries = useMemo<LedgerEntry[]>(() => ledger.data?.pages.flatMap((page) => page.data) ?? [], [ledger.data]);
  const total = ledger.data?.pages[ledger.data.pages.length - 1]?.pagination.total;
  const balanceValue = balance?.balance ?? 0;
  const status = balanceStatus(balanceValue);

  const handleDelete = async () => {
    setBusy(true);
    try {
      const result = await deletePerson.mutateAsync(person.id);
      setConfirmingDelete(false);
      if (result.deleted) {
        success(t.peopleDeleted);
        onDeleted();
      } else {
        success(t.peopleDeactivated);
      }
    } catch (err: unknown) {
      showError(getErrorMessage(err, t.peopleDeleteFailed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={fillText(t.peopleStatementAria, { name: person.name })} className="space-y-5 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-light tracking-tight text-gray-900 dark:text-white truncate">{person.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {!person.isActive && <Chip tone="gray">{t.peopleInactive}</Chip>}
            {person.aliases.map((alias) => <Chip key={alias} tone="blue" title={t.peopleAliasTitle}>{alias}</Chip>)}
          </div>
          <p className={`mt-2 text-base ${BALANCE_TONE[status.kind]}`}>{balanceSentence(t, person.name, balanceValue, money)}</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onEdit(person)} disabled={busy} className={BTN_SECONDARY}>
              <Pencil className="h-4 w-4 mr-2" aria-hidden="true" />
              {t.edit}
            </button>
            <button type="button" onClick={() => setConfirmingDelete(true)} disabled={busy} className={BTN_SECONDARY}>
              <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
              {t.delete}
            </button>
          </div>
        )}
      </div>

      {confirmingDelete && (
        <div role="alertdialog" aria-label={t.peopleDeleteConfirmAria} className={BOX_CLS}>
          <p className="text-sm text-gray-900 dark:text-white">{fillText(t.peopleDeleteConfirm, { name: person.name })}</p>
          <p className={`text-xs ${MUTED_CLS}`}>{t.peopleDeleteHint}</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => void handleDelete()} disabled={busy} className={BTN_DANGER}>{busy ? t.peopleDeleting : t.delete}</button>
            <button ref={cancelDeleteRef} type="button" onClick={() => setConfirmingDelete(false)} disabled={busy} className={BTN_SECONDARY}>{t.cancel}</button>
          </div>
        </div>
      )}

      {balance && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {([
            [t.peopleOwedToMe, balance.owedToMe],
            [t.peopleIOwe, balance.iOwe],
            [t.peopleStatReceived, balance.received],
            [t.peopleStatPaid, balance.paid],
          ] as const).map(([label, value]) => (
            <div key={label}>
              <dt className={`text-xs ${MUTED_CLS}`}>{label}</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{money(reaisToCents(value))}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="space-y-2">
        <h3 className={H4_CLS}>{t.peopleLedger}</h3>
        {ledger.isLoading && <p className={`text-sm ${MUTED_CLS}`} role="status">{t.loading}</p>}
        {ledger.isError && (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className={ERROR_CLS}>{getErrorMessage(ledger.error, t.peopleLedgerFailed)}</p>
            <button type="button" onClick={() => void ledger.refetch()} className={BTN_SECONDARY}>{t.peopleRetry}</button>
          </div>
        )}
        {!ledger.isLoading && !ledger.isError && entries.length === 0 && (
          <p className={`text-sm ${MUTED_CLS}`}>{t.peopleLedgerEmpty}</p>
        )}
        {entries.length > 0 && (
          <div className={TABLE_WRAP_CLS}>
            <table className="w-full text-sm">
              <thead>
                <tr className={THEAD_ROW_CLS}>
                  <th className={TH_CLS}>{t.date}</th>
                  <th className={TH_CLS}>{t.description}</th>
                  <th className={TH_CLS}>{t.type}</th>
                  <th className={`${TH_CLS} text-right`}>{t.amount}</th>
                  <th className={`${TH_CLS} text-right`}>{t.balance}</th>
                </tr>
              </thead>
              <tbody className={TBODY_CLS}>
                {entries.map((entry) => {
                  const signedCents = reaisToCents(entry.signed);
                  const after = balanceStatus(entry.balanceAfter);
                  // A settlement without a transaction has only the server's default (English) label: show the translated kind
                  const description = entry.kind === 'settlement' && !entry.transactionId ? ledgerKindText(t, ledgerKind(entry)) : entry.description;
                  return (
                    <tr key={`${entry.kind}-${entry.id}`} data-entry={entry.id}>
                      <td className={`${TD_CLS} whitespace-nowrap ${MUTED_CLS}`}>{formatDate(parseDateFromAPI(entry.date))}</td>
                      <td className={`${TD_CLS} max-w-[280px]`}>
                        <p className="truncate" title={description}>{description}</p>
                        {entry.kind === 'share' && entry.transactionAmount !== null && (
                          <p className={`text-xs ${MUTED_CLS}`}>{fillText(t.peopleOfAmount, { amount: money(reaisToCents(entry.transactionAmount)) })}</p>
                        )}
                        {entry.note && <p className={`text-xs ${MUTED_CLS} truncate`} title={entry.note}>{entry.note}</p>}
                      </td>
                      <td className={`${TD_CLS} whitespace-nowrap`}>{ledgerKindText(t, ledgerKind(entry))}</td>
                      <td className={`${TD_CLS} whitespace-nowrap text-right ${signedCents >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {signedMoney(signedCents)}
                      </td>
                      <td className={`${TD_CLS} whitespace-nowrap text-right`} title={balanceSentence(t, person.name, entry.balanceAfter, money)}>
                        <span className={BALANCE_TONE[after.kind]}>{signedMoney(reaisToCents(entry.balanceAfter))}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {entries.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {ledger.hasNextPage && (
              <button type="button" onClick={() => void ledger.fetchNextPage()} disabled={ledger.isFetchingNextPage} className={BTN_SECONDARY}>
                {ledger.isFetchingNextPage ? t.loading : t.peopleLoadMore}
              </button>
            )}
            <span className={`text-xs ${MUTED_CLS}`}>
              {total !== undefined ? fillText(t.peopleShowing, { shown: entries.length, total }) : fillText(t.peopleLoaded, { count: entries.length })}
            </span>
            {ledger.isFetchNextPageError && <span role="alert" className={ERROR_CLS}>{t.peopleLoadMoreFailed}</span>}
          </div>
        )}
      </div>
    </section>
  );
};

export default PersonDetail;

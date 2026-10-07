import { useEffect, useMemo, useRef, useState } from 'react';
import { HandCoins } from 'lucide-react';
import { useAccounts } from '../../hooks/api/useAccounts';
import { useTransactions } from '../../hooks/api/useTransactions';
import { CategoryType } from '../../lib/enums';
import { loadSettlementAccount, saveSettlementAccount, useCreateSettlement } from '../../hooks/api/usePeople';
import type { Person, SettlementDirection } from '../../hooks/api/usePeople';
import { useToastContext } from '../../context/ToastContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency, formatDate, parseDateFromAPI } from '../../utils/format';
import { fillText, reaisToCents } from '../../utils/people';
import { formatCentsInput } from '../../utils/shares';
import { balanceAfterSettlement, buildSettlementInput, defaultSettlementDraft, settlementAccounts, validateSettlement } from '../../utils/settlements';
import type { SettlementDraft, SettlementMode } from '../../utils/settlements';
import { balanceSentence } from './peopleText';
import { BTN_PRIMARY, BTN_SECONDARY, DialogShell, ERROR_CLS, INPUT_CLS, LABEL_CLS, LINK_CLS, MUTED_CLS, getErrorMessage } from './ui';

const MODES: SettlementMode[] = ['create', 'link', 'none'];

/** Today as YYYY-MM-DD in local time (the default date of a settlement). */
const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface SettlementDialogProps {
  open: boolean;
  onClose: () => void;
  householdId: string | undefined;
  person: Person | null;
  /** The person's current balance in reais (> 0: they owe me); the suggested amount. */
  balance: number;
}

/** Records a settlement: the amount defaults to the balance; creates the real transaction, links one, or just records it. */
const SettlementDialog = ({ open, onClose, householdId, person, balance }: SettlementDialogProps) => {
  const { t } = useI18n();
  const { success, error: showError } = useToastContext();
  const { baseCurrency } = useCurrency();
  const money = (cents: number): string => formatCurrency(cents / 100, baseCurrency);

  const { data: accountsData } = useAccounts({ householdId: householdId ?? '' });
  const accounts = useMemo(() => settlementAccounts(accountsData?.accounts ?? []), [accountsData]);
  const createMutation = useCreateSettlement();

  const descriptionFor = (name: string, direction: SettlementDirection): string =>
    fillText(direction === 'RECEIVED' ? t.peopleSettleDescReceived : t.peopleSettleDescPaid, { name });

  const [draft, setDraft] = useState<SettlementDraft | null>(null);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  // The description follows the direction until the user types their own.
  const descriptionEditedRef = useRef(false);
  const accountPickedRef = useRef(false);
  const personRef = useRef(person);
  personRef.current = person;
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const descriptionForRef = useRef(descriptionFor);
  descriptionForRef.current = descriptionFor;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Every opening starts over with the balance as the suggestion. The mode is "create the transaction" but on NO account
  // until the user picks one (or the one used last time in this household comes back): money is never booked on a guess.
  useEffect(() => {
    const current = personRef.current;
    if (!open || !current) return;
    descriptionEditedRef.current = false;
    accountPickedRef.current = false;
    const initial = defaultSettlementDraft(balanceRef.current, todayIso());
    setDraft({ ...initial, description: descriptionForRef.current(current.name, initial.direction) });
    setSearchText(current.name);
    setDebouncedSearch(current.name);
    setFormError(null);
  }, [open, person?.id]);

  // The account: only the one used last time in this household, when it still exists. Looked up once per opening, so
  // choosing "Select the account" afterwards is respected (the button then asks for an account).
  useEffect(() => {
    if (!open) accountPickedRef.current = false;
  }, [open]);
  useEffect(() => {
    if (!open || !draft || accountPickedRef.current || accounts.length === 0) return;
    accountPickedRef.current = true;
    const remembered = loadSettlementAccount(householdId);
    if (!accounts.some((a) => a.id === remembered)) return;
    setDraft((d) => (d && !d.accountId ? { ...d, accountId: remembered } : d));
  }, [open, draft, accounts, householdId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const linking = open && draft?.mode === 'link';
  const { data: candidatesData, isFetching: loadingCandidates } = useTransactions({
    householdId: linking ? householdId : undefined,
    type: draft?.direction === 'PAID' ? CategoryType.EXPENSE : CategoryType.INCOME,
    search: debouncedSearch.trim() || undefined,
    limit: 25,
  });
  const candidates = useMemo(() => (linking ? (candidatesData?.data ?? []) : []), [linking, candidatesData]);

  // The transaction to link is whatever the user sees chosen: after a new search a candidate that is no longer offered
  // is not chosen any more (the select would show "Select" while a hidden id still went in the request).
  const chosen = draft && candidates.some((c) => c.id === draft.transactionId) ? draft.transactionId : '';
  const effective = useMemo(() => (draft ? { ...draft, transactionId: draft.mode === 'link' ? chosen : '' } : null), [draft, chosen]);
  const check = effective ? validateSettlement(effective) : null;
  const amountCents = check?.amountCents ?? null;
  const balanceCents = reaisToCents(balance);
  const selectedCandidate = chosen ? candidates.find((c) => c.id === chosen) : undefined;
  const candidateCents = selectedCandidate ? reaisToCents(Number(selectedCandidate.amount)) : null;

  const patch = (fields: Partial<SettlementDraft>) => setDraft((d) => (d ? { ...d, ...fields } : d));

  const handleDirection = (direction: SettlementDirection) => {
    if (!person) return;
    patch({
      direction,
      transactionId: '',
      ...(descriptionEditedRef.current ? {} : { description: descriptionFor(person.name, direction) }),
    });
  };

  const handleSave = async () => {
    if (!draft || !effective || !person || !householdId || savingRef.current) return;
    const input = buildSettlementInput(effective, householdId);
    if (!input) {
      setFormError(t.peopleSettleReview);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      await createMutation.mutateAsync({ personId: person.id, input });
      if (draft.mode === 'create') saveSettlementAccount(householdId, draft.accountId);
      success(draft.mode !== 'create' ? t.peopleSettleSaved : draft.direction === 'RECEIVED' ? t.peopleSettleSavedIncome : t.peopleSettleSavedExpense);
      onClose();
    } catch (err: unknown) {
      const message = getErrorMessage(err, t.peopleSettleFailed);
      setFormError(message);
      showError(message);
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  const after = amountCents !== null && draft ? balanceAfterSettlement(balanceCents, draft.direction, amountCents) : null;
  const modeLabel = (mode: SettlementMode, direction: SettlementDirection): string => {
    if (mode === 'none') return t.peopleModeNone;
    if (mode === 'create') return direction === 'RECEIVED' ? t.peopleModeCreateIncome : t.peopleModeCreateExpense;
    return direction === 'RECEIVED' ? t.peopleModeLinkIncome : t.peopleModeLinkExpense;
  };

  return (
    <DialogShell open={open && !!person} onClose={onClose} canClose={!saving} titleId="settlement-dialog-title" widthClass="max-w-xl"
      title={person ? fillText(t.peopleSettleTitle, { name: person.name }) : t.peopleSettleAction}
      icon={<HandCoins className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0" aria-hidden="true" />}>
      {person && draft && check && (
        <div className="space-y-4 min-w-0">
          <p className={`text-sm ${MUTED_CLS}`}>
            {t.peopleSettleCurrent} <strong className="font-medium text-gray-900 dark:text-white">{balanceSentence(t, person.name, balance, money)}</strong>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="settle-direction" className={LABEL_CLS}>{t.peopleSettleWhat}</label>
              <select id="settle-direction" value={draft.direction} disabled={saving} className={INPUT_CLS}
                onChange={(e) => handleDirection(e.target.value as SettlementDirection)}>
                <option value="RECEIVED">{t.peopleSettleReceived}</option>
                <option value="PAID">{t.peopleSettlePaid}</option>
              </select>
            </div>
            <div>
              <label htmlFor="settle-amount" className={LABEL_CLS}>{t.amount}</label>
              <input id="settle-amount" type="text" inputMode="decimal" value={draft.amountText} disabled={saving} className={INPUT_CLS} placeholder="0,00"
                aria-invalid={check.errors.amount ? true : undefined} onChange={(e) => patch({ amountText: e.target.value })} />
              {check.errors.amount && <p role="alert" className={`mt-1 ${ERROR_CLS}`}>{t.peopleErrAmount}</p>}
            </div>
            <div>
              <label htmlFor="settle-date" className={LABEL_CLS}>{t.date}</label>
              <input id="settle-date" type="date" value={draft.date} disabled={saving} className={INPUT_CLS} onChange={(e) => patch({ date: e.target.value })} />
              {check.errors.date && <p role="alert" className={`mt-1 ${ERROR_CLS}`}>{t.peopleErrDate}</p>}
            </div>
            <div>
              <label htmlFor="settle-note" className={LABEL_CLS}>{t.peopleSettleNote}</label>
              <input id="settle-note" type="text" maxLength={200} value={draft.note} disabled={saving} className={INPUT_CLS} placeholder={t.optional}
                onChange={(e) => patch({ note: e.target.value })} />
            </div>
          </div>

          {after !== null && (
            <p className={`text-xs ${MUTED_CLS}`} aria-live="polite">
              {fillText(t.peopleSettleAfter, { sentence: balanceSentence(t, person.name, after / 100, money) })}
            </p>
          )}

          <fieldset className="space-y-2" disabled={saving}>
            <legend className={LABEL_CLS}>{t.peopleSettleTransaction}</legend>
            {MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100 cursor-pointer">
                <input type="radio" name="settle-mode" value={mode} checked={draft.mode === mode} onChange={() => patch({ mode, transactionId: '' })} />
                {modeLabel(mode, draft.direction)}
              </label>
            ))}
          </fieldset>

          {draft.mode === 'create' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="settle-account" className={LABEL_CLS}>{t.account}</label>
                <select id="settle-account" value={draft.accountId} disabled={saving} className={INPUT_CLS}
                  aria-invalid={check.errors.account ? true : undefined} onChange={(e) => patch({ accountId: e.target.value })}>
                  <option value="">{t.peopleSelectAccount}</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {check.errors.account && <p role="alert" className={`mt-1 ${ERROR_CLS}`}>{t.peopleErrAccount}</p>}
              </div>
              <div>
                <label htmlFor="settle-description" className={LABEL_CLS}>{t.peopleSettleDescription}</label>
                <input id="settle-description" type="text" maxLength={120} value={draft.description} disabled={saving} className={INPUT_CLS}
                  onChange={(e) => { descriptionEditedRef.current = true; patch({ description: e.target.value }); }} />
              </div>
            </div>
          )}

          {draft.mode === 'link' && (
            <div className="space-y-3">
              <div>
                <label htmlFor="settle-search" className={LABEL_CLS}>{t.peopleSettleSearch}</label>
                <input id="settle-search" type="text" value={searchText} disabled={saving} className={INPUT_CLS} placeholder={t.peopleSearchPlaceholder}
                  onChange={(e) => setSearchText(e.target.value)} />
              </div>
              <div>
                <label htmlFor="settle-transaction" className={LABEL_CLS}>{draft.direction === 'RECEIVED' ? t.income : t.expense}</label>
                <select id="settle-transaction" value={chosen} disabled={saving} className={INPUT_CLS}
                  aria-invalid={check.errors.transaction ? true : undefined} onChange={(e) => patch({ transactionId: e.target.value })}>
                  <option value="">{loadingCandidates ? t.peopleSearching : candidates.length === 0 ? t.peopleNoTransactions : t.peopleSelectTransaction}</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatDate(parseDateFromAPI(String(c.date)))} · {c.description} · {money(reaisToCents(Number(c.amount)))}
                    </option>
                  ))}
                </select>
                {check.errors.transaction && <p role="alert" className={`mt-1 ${ERROR_CLS}`}>{t.peopleErrTransaction}</p>}
                <p className={`mt-1 text-xs ${MUTED_CLS}`}>{t.peopleLinkedHint}</p>
              </div>
              {candidateCents !== null && amountCents !== null && candidateCents !== amountCents && (
                <p className={`text-xs ${MUTED_CLS}`}>
                  {fillText(t.peopleSettleMismatch, { transaction: money(candidateCents), amount: money(amountCents) })}{' '}
                  <button type="button" className={LINK_CLS} onClick={() => patch({ amountText: formatCentsInput(candidateCents) })}>{t.peopleUseTransactionAmount}</button>
                </p>
              )}
            </div>
          )}

          {draft.mode === 'none' && <p className={`text-xs ${MUTED_CLS}`}>{t.peopleSettleNoneHint}</p>}

          {formError && <p role="alert" className={ERROR_CLS}>{formError}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} disabled={saving} className={BTN_SECONDARY}>{t.cancel}</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || !check.ok} className={BTN_PRIMARY}>
              {saving ? t.peopleSettling : t.peopleSettleAction}
            </button>
          </div>
        </div>
      )}
    </DialogShell>
  );
};

export default SettlementDialog;

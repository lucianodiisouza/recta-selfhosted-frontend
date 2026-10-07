import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { usePeople, usePutTransactionShares, useSharesPreview, useTransactionShares } from '../../hooks/api/usePeople';
import type { Person, PutSharesInput, ShareDirection, SharesPreviewResponse, SplitStrategy } from '../../hooks/api/usePeople';
import { useToastContext } from '../../context/ToastContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import { fillText, reaisToCents } from '../../utils/people';
import {
  MAX_NOTE, MAX_SPLIT_ENTRIES, buildPutSharesInput, clearSharesInput, compareWithServer, computeSharePreview, convertDraftStrategy,
  draftFromServerPreview, draftFromShares, emptyDraft, emptyRow, initialDirection,
} from '../../utils/shares';
import type { ShareDraft, ShareDraftRow } from '../../utils/shares';
import PersonFormDialog from './PersonFormDialog';
import { directionText, formErrorText, restLabel, rowErrorText, strategyText } from './shareText';
import {
  BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, BTN_SECONDARY_SM, DialogShell, ERROR_CLS, INPUT_SM_CLS, LABEL_CLS, LINK_CLS, MUTED_CLS, NOTICE_BOX_CLS,
  getErrorMessage,
} from './ui';

const NEW_PERSON_VALUE = '__new__';
const STRATEGIES: SplitStrategy[] = ['equal', 'exact', 'percent', 'shares'];
const DIRECTIONS: ShareDirection[] = ['THEY_OWE_ME', 'I_OWE_THEM'];

export interface DivideTransactionTarget {
  id: string;
  description: string;
  /** Reais; the server amount takes over as soon as it arrives. */
  amount: number;
}

interface DivideTransactionDialogProps {
  open: boolean;
  onClose: () => void;
  householdId: string | undefined;
  transaction: DivideTransactionTarget | null;
}

interface ServerCheck {
  /** JSON of the input that was checked: the result only counts while the draft still produces it. */
  inputKey: string;
  result: SharesPreviewResponse | null;
  error: string | null;
}

/** Splits a transaction with people: direction, strategy, people and values, live preview, save with PUT. */
const DivideTransactionDialog = ({ open, onClose, householdId, transaction }: DivideTransactionDialogProps) => {
  const { t } = useI18n();
  const { success, error: showError } = useToastContext();
  const { baseCurrency } = useCurrency();
  const money = (cents: number): string => formatCurrency(cents / 100, baseCurrency);

  const transactionId = transaction?.id;
  const sharesQuery = useTransactionShares(transactionId, open);
  const { data: people } = usePeople(householdId);
  const putMutation = usePutTransactionShares();
  const previewMutation = useSharesPreview();

  const [draft, setDraft] = useState<ShareDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverCheck, setServerCheck] = useState<ServerCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [newPersonRow, setNewPersonRow] = useState<string | null>(null);
  // People created from this dialog: selectable at once, before the people list refetches.
  const [createdPeople, setCreatedPeople] = useState<Person[]>([]);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  // Latest-wins for the server check: a late answer of an older draft never replaces the newer one.
  const checkSeqRef = useRef(0);
  const rowSeqRef = useRef(1);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Every opening starts over; the draft is seeded once the stored split arrives (fresh, not the cached one).
  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setServerCheck(null);
    setChecking(false);
    setConfirmingClear(false);
    setNewPersonRow(null);
    checkSeqRef.current += 1;
    return () => {
      checkSeqRef.current += 1;
    };
  }, [open, transactionId]);

  const data = sharesQuery.data;
  const settled = open && !!data && data.transactionId === transactionId && !sharesQuery.isFetching && !sharesQuery.isError;
  useEffect(() => {
    if (!settled || draft || !data) return;
    const seeded = draftFromShares(data.shares, initialDirection(data.shares));
    rowSeqRef.current = seeded.rows.length + 1;
    setDraft(seeded);
  }, [settled, draft, data]);

  const totalCents = reaisToCents(data?.transactionAmount ?? transaction?.amount ?? 0);
  const preview = useMemo(() => (draft ? computeSharePreview(totalCents, draft) : null), [draft, totalCents]);
  const putInput = useMemo<PutSharesInput | null>(() => {
    if (!draft || !preview) return null;
    if (preview.isEmpty) return clearSharesInput(draft.direction);
    return buildPutSharesInput(totalCents, draft);
  }, [draft, preview, totalCents]);
  const existing = data?.shares ?? [];
  const existingInDirection = draft ? existing.filter((s) => s.direction === draft.direction) : [];
  const otherDirection = draft ? existing.filter((s) => s.direction !== draft.direction) : [];

  const activePeople = useMemo(() => {
    const list = [...(people ?? [])];
    for (const created of createdPeople) if (!list.some((p) => p.id === created.id)) list.push(created);
    return list;
  }, [people, createdPeople]);
  const personName = (id: string): string =>
    activePeople.find((p) => p.id === id)?.name ?? existing.find((s) => s.personId === id)?.personName ?? '—';

  const update = (fn: (current: ShareDraft) => ShareDraft) => {
    setDraft((current) => (current ? fn(current) : current));
    // The old server answer is about a draft that no longer exists.
    checkSeqRef.current += 1;
    setChecking(false);
  };
  const updateRow = (key: string, patch: Partial<ShareDraftRow>) =>
    update((d) => ({ ...d, rows: d.rows.map((row) => (row.key === key ? { ...row, ...patch } : row)) }));

  const handleDirection = (direction: ShareDirection) => {
    if (!data) return;
    update((d) => {
      const stored = draftFromShares(data.shares, direction);
      // Stored shares of that direction are shown as they are; otherwise a fresh draft with the same strategy.
      const next = data.shares.some((s) => s.direction === direction) ? stored : emptyDraft(direction, d.strategy);
      rowSeqRef.current = next.rows.length + 1;
      return next;
    });
  };
  const handleStrategy = (strategy: SplitStrategy) => update((d) => convertDraftStrategy(d, strategy, totalCents));
  const addRow = () => update((d) => {
    rowSeqRef.current += 1;
    return { ...d, rows: [...d.rows, emptyRow(`r${rowSeqRef.current}`)] };
  });
  const removeRow = (key: string) => update((d) => ({ ...d, rows: d.rows.filter((row) => row.key !== key) }));

  const handlePersonChange = (key: string, value: string) => {
    if (value === NEW_PERSON_VALUE) setNewPersonRow(key);
    else updateRow(key, { personId: value });
  };

  const requestInputKey = putInput ? JSON.stringify(putInput) : '';
  const check = serverCheck && serverCheck.inputKey === requestInputKey ? serverCheck : null;
  const comparison = check?.result && preview ? compareWithServer(preview, check.result) : null;

  const handleCheck = async () => {
    if (!transactionId || !putInput || !preview || preview.isEmpty) return;
    checkSeqRef.current += 1;
    const run = checkSeqRef.current;
    const inputKey = requestInputKey;
    setChecking(true);
    try {
      const result = await previewMutation.mutateAsync({ transactionId, input: putInput });
      if (!mountedRef.current || run !== checkSeqRef.current) return;
      setServerCheck({ inputKey, result, error: null });
    } catch (err: unknown) {
      if (!mountedRef.current || run !== checkSeqRef.current) return;
      setServerCheck({ inputKey, result: null, error: getErrorMessage(err, t.peopleCheckFailed) });
    } finally {
      if (mountedRef.current && run === checkSeqRef.current) setChecking(false);
    }
  };

  /** The toast after saving: what is left for me when they owe me, what I owe when it is the other way round. */
  const savedMessage = (direction: ShareDirection, result: { shares: ReadonlyArray<{ direction: string; amount: number }>; myPart: number }): string => {
    if (direction === 'THEY_OWE_ME') return fillText(t.peopleSavedMine, { amount: money(reaisToCents(result.myPart)) });
    const owed = result.shares.filter((s) => s.direction === direction).reduce((sum, s) => sum + reaisToCents(s.amount), 0);
    return fillText(t.peopleSavedOwe, { amount: money(owed) });
  };

  const handleSave = async () => {
    if (!transactionId || !putInput || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await putMutation.mutateAsync({ transactionId, input: putInput });
      success(putInput.entries.length === 0 ? t.peopleSplitRemoved : savedMessage(putInput.direction, result));
      onClose();
    } catch (err: unknown) {
      showError(getErrorMessage(err, t.peopleSaveSplitFailed));
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  // Clears the split of both directions: one PUT with no entries per direction that has shares.
  const handleClearAll = async () => {
    if (!transactionId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      for (const direction of DIRECTIONS) {
        if (existing.some((s) => s.direction === direction)) {
          await putMutation.mutateAsync({ transactionId, input: clearSharesInput(direction) });
        }
      }
      success(t.peopleSplitRemoved);
      onClose();
    } catch (err: unknown) {
      showError(getErrorMessage(err, t.peopleClearFailed));
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  const optionsFor = (row: ShareDraftRow): Array<Pick<Person, 'id' | 'name'>> => {
    const taken = new Set(draft?.rows.filter((r) => r.key !== row.key).map((r) => r.personId));
    const list: Array<Pick<Person, 'id' | 'name'>> = activePeople.filter((p) => !taken.has(p.id));
    if (row.personId && !list.some((p) => p.id === row.personId)) list.push({ id: row.personId, name: personName(row.personId) });
    return list;
  };

  const canSave = !saving && !!putInput && (!preview?.isEmpty || existingInDirection.length > 0);
  const strategy = draft?.strategy;

  return (
    <>
      <DialogShell open={open} onClose={onClose} canClose={!saving} titleId="divide-dialog-title" widthClass="max-w-3xl"
        title={t.peopleDivideTitle} icon={<Users className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0" aria-hidden="true" />}>
        <div className="space-y-4 min-w-0">
          {transaction && (
            <p className="text-sm text-gray-900 dark:text-white">
              <strong className="font-medium">{transaction.description}</strong>
              <span className={MUTED_CLS}> · {money(totalCents)}</span>
            </p>
          )}

          {sharesQuery.isError && (
            <div className="flex flex-wrap items-center gap-3">
              <p role="alert" className={ERROR_CLS}>{getErrorMessage(sharesQuery.error, t.peopleDivideLoadFailed)}</p>
              <button type="button" onClick={() => void sharesQuery.refetch()} className={BTN_SECONDARY_SM}>{t.peopleRetry}</button>
            </div>
          )}
          {!draft && !sharesQuery.isError && <p className={`text-sm ${MUTED_CLS}`} role="status">{t.loading}</p>}

          {draft && preview && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="divide-direction" className={LABEL_CLS}>{t.peopleDivideDirection}</label>
                  <select id="divide-direction" value={draft.direction} disabled={saving} className={INPUT_SM_CLS}
                    onChange={(e) => handleDirection(e.target.value as ShareDirection)}>
                    {DIRECTIONS.map((d) => <option key={d} value={d}>{directionText(t, d)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="divide-strategy" className={LABEL_CLS}>{t.peopleDivideHow}</label>
                  <select id="divide-strategy" value={draft.strategy} disabled={saving} className={INPUT_SM_CLS}
                    onChange={(e) => handleStrategy(e.target.value as SplitStrategy)}>
                    {STRATEGIES.map((s) => <option key={s} value={s}>{strategyText(t, s)}</option>)}
                  </select>
                </div>
              </div>

              {otherDirection.length > 0 && (
                <p className={`text-xs ${MUTED_CLS}`}>
                  {fillText(otherDirection.length === 1 ? t.peopleDivideOtherOne : t.peopleDivideOtherMany, {
                    count: otherDirection.length,
                    list: otherDirection.map((s) => `${s.personName} ${money(reaisToCents(s.amount))}`).join(', '),
                  })}
                </p>
              )}

              {strategy === 'shares' && (
                <div className="max-w-[12rem]">
                  <label htmlFor="divide-my-shares" className={LABEL_CLS}>{t.peopleMyShares}</label>
                  <input id="divide-my-shares" type="text" inputMode="numeric" value={draft.myShares} disabled={saving} className={INPUT_SM_CLS}
                    onChange={(e) => update((d) => ({ ...d, myShares: e.target.value }))} />
                </div>
              )}

              <ul className="space-y-3" aria-label={t.peopleDivideListAria}>
                {draft.rows.map((row, index) => {
                  const part = preview.parts[index];
                  return (
                    <li key={row.key} className="rounded-md border border-gray-200 dark:border-gray-800 p-3 space-y-2">
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="flex-1 min-w-[10rem]">
                          <label htmlFor={`divide-person-${row.key}`} className="sr-only">{fillText(t.peoplePersonN, { n: index + 1 })}</label>
                          <select id={`divide-person-${row.key}`} value={row.personId} disabled={saving} className={INPUT_SM_CLS}
                            aria-invalid={part?.error ? true : undefined} onChange={(e) => handlePersonChange(row.key, e.target.value)}>
                            <option value="">{t.peoplePickPerson}</option>
                            {optionsFor(row).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            <option value={NEW_PERSON_VALUE}>{t.peopleNewPersonOption}</option>
                          </select>
                        </div>
                        {strategy === 'exact' && (
                          <div className="w-32">
                            <label htmlFor={`divide-amount-${row.key}`} className="sr-only">{fillText(t.peopleAmountOf, { name: personName(row.personId) })}</label>
                            <input id={`divide-amount-${row.key}`} type="text" inputMode="decimal" placeholder="0,00" value={row.amountText}
                              disabled={saving} className={INPUT_SM_CLS} onChange={(e) => updateRow(row.key, { amountText: e.target.value })} />
                          </div>
                        )}
                        {strategy === 'percent' && (
                          <div className="w-28">
                            <label htmlFor={`divide-percent-${row.key}`} className="sr-only">{fillText(t.peoplePercentOf, { name: personName(row.personId) })}</label>
                            <input id={`divide-percent-${row.key}`} type="text" inputMode="decimal" placeholder="%" value={row.percentText}
                              disabled={saving} className={INPUT_SM_CLS} onChange={(e) => updateRow(row.key, { percentText: e.target.value })} />
                          </div>
                        )}
                        {strategy === 'shares' && (
                          <div className="w-24">
                            <label htmlFor={`divide-shares-${row.key}`} className="sr-only">{fillText(t.peopleSharesOf, { name: personName(row.personId) })}</label>
                            <input id={`divide-shares-${row.key}`} type="text" inputMode="numeric" placeholder={t.peopleSharesPlaceholder} value={row.sharesText}
                              disabled={saving} className={INPUT_SM_CLS} onChange={(e) => updateRow(row.key, { sharesText: e.target.value })} />
                          </div>
                        )}
                        <p className="w-28 pt-1.5 text-sm text-right text-gray-900 dark:text-white" aria-label={fillText(t.peoplePartN, { n: index + 1 })}>
                          {part?.cents != null ? money(part.cents) : '—'}
                        </p>
                        <button type="button" onClick={() => removeRow(row.key)} disabled={saving} aria-label={fillText(t.peopleRemovePersonN, { n: index + 1 })}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:opacity-70 disabled:opacity-40">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div>
                        <label htmlFor={`divide-note-${row.key}`} className="sr-only">{fillText(t.peopleNoteOfPart, { n: index + 1 })}</label>
                        <input id={`divide-note-${row.key}`} type="text" maxLength={MAX_NOTE} placeholder={t.peopleNotePlaceholder} value={row.note}
                          disabled={saving} className={INPUT_SM_CLS} onChange={(e) => updateRow(row.key, { note: e.target.value })} />
                      </div>
                      {part?.error && <p role="alert" className={ERROR_CLS}>{rowErrorText(t, part.error)}</p>}
                    </li>
                  );
                })}
              </ul>

              <button type="button" onClick={addRow} disabled={saving || draft.rows.length >= MAX_SPLIT_ENTRIES} className={`${LINK_CLS} inline-flex items-center gap-1`}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t.peopleAddPerson}
              </button>
              {draft.rows.length >= MAX_SPLIT_ENTRIES && <p className={`text-xs ${MUTED_CLS}`}>{fillText(t.peopleMaxEntries, { max: MAX_SPLIT_ENTRIES })}</p>}

              <dl className="grid grid-cols-3 gap-3 text-sm rounded-md bg-gray-50 dark:bg-gray-800/50 px-4 py-3" aria-label={t.peopleDivideSummaryAria}>
                <div>
                  <dt className={`text-xs ${MUTED_CLS}`}>{t.peopleTransactionAmount}</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{money(preview.totalCents)}</dd>
                </div>
                <div>
                  <dt className={`text-xs ${MUTED_CLS}`}>{draft.direction === 'THEY_OWE_ME' ? t.peopleDividedTheyOwe : t.peopleDividedIOwe}</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{money(preview.sumCents)}</dd>
                </div>
                <div>
                  <dt className={`text-xs ${MUTED_CLS}`}>{restLabel(t, draft.direction)}</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{preview.valid || preview.isEmpty ? money(preview.restCents) : '—'}</dd>
                </div>
              </dl>

              {preview.formError && <p role="alert" className={ERROR_CLS}>{formErrorText(t, preview.formError, money)}</p>}

              {check && (
                <div role="status" className={check.error || (comparison && (comparison.differences.length > 0 || comparison.restDiffers)) ? NOTICE_BOX_CLS : `text-sm ${MUTED_CLS}`}>
                  {check.error && <p>{check.error}</p>}
                  {comparison && comparison.differences.length === 0 && !comparison.restDiffers && <p>{t.peopleCheckSame}</p>}
                  {comparison && (comparison.differences.length > 0 || comparison.restDiffers) && (
                    <>
                      <p className="font-medium">{t.peopleCheckDiffers}</p>
                      <ul className="list-disc list-inside">
                        {comparison.differences.map((diff) => (
                          <li key={diff.personId}>
                            {fillText(t.peopleCheckDiffLine, {
                              name: personName(diff.personId),
                              server: diff.serverCents === null ? '—' : money(diff.serverCents),
                              local: diff.localCents === null ? '—' : money(diff.localCents),
                            })}
                          </li>
                        ))}
                        {comparison.restDiffers && check.result && (
                          <li>{fillText(t.peopleCheckRestLine, { label: restLabel(t, draft.direction), server: money(reaisToCents(check.result.myPart)) })}</li>
                        )}
                      </ul>
                      {check.result && (
                        <button type="button" className={LINK_CLS} onClick={() => update((d) => draftFromServerPreview(d, check.result as SharesPreviewResponse))}>
                          {t.peopleUseServerValues}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {confirmingClear && (
            <div role="alertdialog" aria-label={t.peopleClearConfirmAria} className={NOTICE_BOX_CLS}>
              <p className="font-medium">{t.peopleClearTitle}</p>
              <p>{t.peopleClearBody}</p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => void handleClearAll()} disabled={saving} className={BTN_DANGER}>{saving ? t.peopleClearing : t.peopleRemove}</button>
                <button type="button" onClick={() => setConfirmingClear(false)} disabled={saving} className={BTN_SECONDARY}>{t.peopleKeep}</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-between pt-2">
            <div className="flex gap-3">
              {existing.length > 0 && (
                <button type="button" onClick={() => setConfirmingClear(true)} disabled={saving || confirmingClear} className={BTN_SECONDARY}>{t.peopleClearAction}</button>
              )}
              {draft && preview && !preview.isEmpty && (
                <button type="button" onClick={() => void handleCheck()} disabled={saving || checking || !putInput} className={BTN_SECONDARY}>
                  {checking ? t.peopleChecking : t.peopleCheckAction}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={saving} className={BTN_SECONDARY}>{t.cancel}</button>
              <button type="button" onClick={() => void handleSave()} disabled={!canSave} className={BTN_PRIMARY}>
                {saving ? t.peopleFormSaving : preview?.isEmpty ? t.peopleRemoveShares : t.peopleSaveSplit}
              </button>
            </div>
          </div>
        </div>
      </DialogShell>
      <PersonFormDialog open={open && newPersonRow !== null} onClose={() => setNewPersonRow(null)} householdId={householdId} person={null}
        zClass="z-[70]" onSaved={(person) => {
          setCreatedPeople((list) => [...list, person]);
          if (newPersonRow) updateRow(newPersonRow, { personId: person.id });
        }} />
    </>
  );
};

export default DivideTransactionDialog;

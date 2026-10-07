import { useEffect, useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { usePeople, usePeopleBalances } from '../hooks/api/usePeople';
import type { Person } from '../hooks/api/usePeople';
import { formatCurrency } from '../utils/format';
import { balanceStatus, canWritePeople, fillText, mergePeopleRows, summarizeBalances } from '../utils/people';
import { usePeopleAvailable } from '../utils/peopleAvailability';
import { PageHeader } from '../components/PageHeader';
import { PageButton } from '../components/PageButton';
import PersonFormDialog from '../components/people/PersonFormDialog';
import PersonDetail from '../components/people/PersonDetail';
import { BALANCE_TONE, balanceSentence } from '../components/people/peopleText';
import { CHECKBOX_CLS, Chip, ERROR_CLS, MUTED_CLS, getErrorMessage } from '../components/people/ui';

/** People page: what each person owes me and what I owe, the net, and the statement of the person picked. */
const People = () => {
  const { t } = useI18n();
  const { baseCurrency } = useCurrency();
  const { householdId, household } = useDefaultHousehold();
  const available = usePeopleAvailable();
  // Writing needs EDITOR or more; a viewer only reads.
  const canEdit = canWritePeople(household);
  const money = (cents: number): string => formatCurrency(cents / 100, baseCurrency);

  const [showInactive, setShowInactive] = useState(false);
  const balancesQuery = usePeopleBalances(householdId);
  const peopleQuery = usePeople(householdId, showInactive);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);

  const balances = useMemo(() => balancesQuery.data ?? [], [balancesQuery.data]);
  const rows = useMemo(() => mergePeopleRows(balances, peopleQuery.data ?? [], showInactive), [balances, peopleQuery.data, showInactive]);
  const summary = useMemo(() => summarizeBalances(balances), [balances]);
  const selected = rows.find((row) => row.person.id === selectedId) ?? null;

  // Another household: the person selected there does not exist here.
  useEffect(() => {
    setSelectedId(null);
  }, [householdId]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  if (!available) {
    return (
      <div className="pb-8">
        <PageHeader title={t.peoplePage} description={t.peoplePageDescription} />
        <p role="status" className={`text-sm ${MUTED_CLS}`}>{t.peopleUnavailable}</p>
      </div>
    );
  }

  const loading = balancesQuery.isLoading || peopleQuery.isLoading;
  const netStatus = balanceStatus(summary.netCents / 100);

  return (
    <div className="pb-8">
      <PageHeader title={t.peoplePage} description={t.peoplePageDescription}>
        {canEdit && (
          <PageButton icon={Plus} onClick={openCreate}>
            {t.peopleNew}
          </PageButton>
        )}
      </PageHeader>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" aria-label={t.peopleSummaryAria}>
        <div className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md">
          <dt className={`text-xs ${MUTED_CLS}`}>{t.peopleOwedToMe}</dt>
          <dd className="mt-1 text-xl font-light text-green-600 dark:text-green-400">{money(summary.owedToMeCents)}</dd>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md">
          <dt className={`text-xs ${MUTED_CLS}`}>{t.peopleIOwe}</dt>
          <dd className="mt-1 text-xl font-light text-red-600 dark:text-red-400">{money(summary.iOweCents)}</dd>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md">
          <dt className={`text-xs ${MUTED_CLS}`}>{t.peopleNet}</dt>
          <dd className={`mt-1 text-xl font-light ${BALANCE_TONE[netStatus.kind]}`}>
            {summary.netCents < 0 ? '-' : ''}{money(Math.abs(summary.netCents))}
            <span className={`block text-xs ${MUTED_CLS}`}>
              {netStatus.kind === 'owes-me' ? t.peopleNetToReceive : netStatus.kind === 'i-owe' ? t.peopleNetToPay : t.peopleNetSettled}
            </span>
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-6">
        <section aria-label={t.peoplePage} className="space-y-3 min-w-0">
          <label htmlFor="people-show-inactive" className="inline-flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100 cursor-pointer">
            <input id="people-show-inactive" type="checkbox" checked={showInactive} className={CHECKBOX_CLS} onChange={(e) => setShowInactive(e.target.checked)} />
            {t.peopleShowInactive}
          </label>
          {loading && <p className={`text-sm ${MUTED_CLS}`} role="status">{t.loading}</p>}
          {balancesQuery.isError && <p role="alert" className={ERROR_CLS}>{getErrorMessage(balancesQuery.error, t.peopleLoadFailed)}</p>}
          {!loading && !balancesQuery.isError && rows.length === 0 && (
            <div className="px-4 py-8 text-center bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-md">
              <Users className="h-8 w-8 mx-auto text-gray-400" aria-hidden="true" />
              <p className="mt-2 text-sm text-gray-900 dark:text-white">{t.peopleEmptyTitle}</p>
              <p className={`text-xs ${MUTED_CLS}`}>{t.peopleEmptyHint}</p>
            </div>
          )}
          <ul className="space-y-2">
            {rows.map((row) => {
              const status = balanceStatus(row.balance?.balance ?? 0);
              const active = row.person.id === selectedId;
              return (
                <li key={row.person.id}>
                  <button type="button" onClick={() => setSelectedId(row.person.id)} aria-pressed={active}
                    className={`w-full text-left p-4 rounded-md border transition-colors ${active ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-900/10' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-base font-light text-gray-900 dark:text-white truncate">{row.person.name}</span>
                      {!row.person.isActive && <Chip tone="gray">{t.peopleInactive}</Chip>}
                    </span>
                    <span className={`block text-sm ${BALANCE_TONE[status.kind]}`}>{balanceSentence(t, row.person.name, row.balance?.balance ?? 0, money)}</span>
                    {row.balance && (
                      <span className={`block text-xs ${MUTED_CLS}`}>
                        {row.balance.openShares === 1 ? t.peopleSharesOne : fillText(t.peopleSharesMany, { count: row.balance.openShares })}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="min-w-0">
          {selected ? (
            <PersonDetail key={selected.person.id} householdId={householdId} person={selected.person} balance={selected.balance} canEdit={canEdit}
              onEdit={(person) => { setEditing(person); setFormOpen(true); }} onDeleted={() => setSelectedId(null)} />
          ) : (
            !loading && rows.length > 0 && <p className={`text-sm ${MUTED_CLS}`}>{t.peoplePickOne}</p>
          )}
        </div>
      </div>

      {formOpen && (
        <PersonFormDialog open={formOpen} onClose={() => setFormOpen(false)} householdId={householdId} person={editing}
          onSaved={(person) => { if (!editing) setSelectedId(person.id); }} />
      )}
    </div>
  );
};

export default People;

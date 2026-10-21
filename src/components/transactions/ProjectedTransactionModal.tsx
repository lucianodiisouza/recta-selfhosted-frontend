import { CalendarClock, Zap } from 'lucide-react';
import type { RecurringProjection } from '../../hooks/api/useRecurringTransactions';
import { useI18n } from '../../context/I18nContext';
import { getCategoryDisplayName } from '../../lib/enums';
import { parseDateFromAPI } from '../../utils/format';
import { Badge, Button, Modal, MoneyText } from '../ui';

interface ProjectedTransactionModalProps {
  projection: RecurringProjection | null;
  accounts: Array<{ id?: string; name: string; type?: string }>;
  baseCurrency: string;
  customCategories?: Array<{ id: string; name: string; icon?: string | null }>;
  /** Viewers only see the details, never the launch action. */
  canLaunch: boolean;
  /**
   * When this is not the rule's next due date: that date (YYYY-MM-DD). Launch always takes the next
   * due occurrence, so later ones explain it instead of offering the button.
   */
  launchFirstDate?: string | null;
  isLaunching: boolean;
  onLaunch: (projection: RecurringProjection) => void;
  onClose: () => void;
}

/** Details of a projected recurring occurrence, with "Launch now" for editors (fdbk #116). */
export const ProjectedTransactionModal = ({
  projection,
  accounts,
  baseCurrency,
  customCategories,
  canLaunch: canEdit,
  launchFirstDate,
  isLaunching,
  onLaunch,
  onClose,
}: ProjectedTransactionModalProps) => {
  const { t, locale } = useI18n();
  const tr = t as unknown as Record<string, string>;
  if (!projection) return null;

  const due = parseDateFromAPI(projection.date.slice(0, 10));
  const formatDay = (d: Date) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const dueLabel = formatDay(due);
  const canLaunch = canEdit && !launchFirstDate;
  const accountName = projection.account?.name ?? accounts.find((a) => a.id === projection.accountId)?.name;
  const categoryDisplay = getCategoryDisplayName(projection.categoryName, tr, customCategories);
  const frequencyLabel = tr[String(projection.frequency).toLowerCase()];
  // "The next due date stays on day N" only makes sense for monthly and yearly rules.
  const keepsDayOfMonth = projection.frequency === 'MONTHLY' || projection.frequency === 'YEARLY';
  const signedAmount = projection.type === 'INCOME' ? projection.amount : -projection.amount;

  const rows: Array<[string, string | undefined]> = [
    [t.account, accountName],
    [t.category, categoryDisplay],
    [t.frequency, frequencyLabel],
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      dismissible={!isLaunching}
      icon={CalendarClock}
      iconTone="info"
      title={projection.description || t.noDescription}
      description={t.projectedDueOn.replace('{date}', dueLabel)}
      size="sm"
      footer={
        <>
          <Button variant="tertiary" onClick={onClose} disabled={isLaunching}>
            {canLaunch ? t.cancel : t.close}
          </Button>
          {canLaunch && (
            <Button icon={Zap} isLoading={isLaunching} onClick={() => onLaunch(projection)}>
              {t.projectedLaunchNow}
            </Button>
          )}
        </>
      }
    >
      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-sunken px-4 py-3">
        <MoneyText value={signedAmount} currency={baseCurrency} sign="always" tone="neutral" size="lg" className="text-content-secondary" />
        <Badge tone="info">{t.projected}</Badge>
      </div>
      <dl className="mt-4 divide-y divide-line-subtle text-sm">
        {rows.filter(([, value]) => !!value).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-content-secondary">{label}</dt>
            <dd className="truncate font-medium text-content">{value}</dd>
          </div>
        ))}
      </dl>
      {canEdit && launchFirstDate && (
        <p className="mt-4 text-[13px] text-content-secondary">
          {t.projectedLaunchEarlierFirst.replace('{date}', formatDay(parseDateFromAPI(launchFirstDate.slice(0, 10))))}
        </p>
      )}
      {canLaunch && (
        <p className="mt-4 text-[13px] text-content-secondary">
          {keepsDayOfMonth
            ? t.projectedLaunchHint.replace('{day}', String(due.getDate()))
            : t.projectedLaunchHintNoDay}
        </p>
      )}
    </Modal>
  );
};

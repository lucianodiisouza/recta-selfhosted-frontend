import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, Home, Inbox, Pencil, Plus, ShoppingCart, Trash2, Utensils } from 'lucide-react';
import { AccountType } from '../../lib/enums';
import { useToastContext } from '../../context/ToastContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  AmountInput, Badge, BrandCard, Button, Card, Chip, EmptyState, ErrorState, Field, IconBadge, IconButton, Input,
  ListGroup, ListRow, Modal, MoneyText, PaymentCard, SectionHeader, SegmentedControl, Select, Skeleton, SkeletonRow, Switch, Textarea,
} from '../../components/ui';

/**
 * Internal catalog of the design system components (design rework F1.10), like the iOS
 * preview gallery. Routed only in development builds. Copy here is placeholder, not UI text.
 */
const UiGallery = () => {
  const [segment, setSegment] = useState<'out' | 'in'>('out');
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [chip, setChip] = useState('food');
  const [on, setOn] = useState(true);
  const [modal, setModal] = useState<null | 'form' | 'confirm'>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToastContext();
  const [category, setCategory] = useState('food');
  const [month, setMonth] = useState('');
  const [balance, setBalance] = useState(51137.47);

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-rounded text-3xl font-bold text-content">UI gallery</h1>
        <p className="text-content-secondary">Design rework F1. Toggle dark mode in Settings to check both themes.</p>
      </header>

      <section>
        <SectionHeader title="Buttons" />
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={Plus}>Primary</Button>
            <Button variant="secondary" icon={Pencil}>Secondary</Button>
            <Button variant="tertiary">Tertiary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive" icon={Trash2}>Destructive</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button isLoading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }}>Loading</Button>
            <Button disabled>Disabled</Button>
            <IconButton icon={Pencil} label="Edit" />
            <IconButton icon={Plus} label="Add" variant="primary" />
            <IconButton icon={Trash2} label="Delete" variant="tertiary" size="sm" />
          </div>
          <Button fullWidth size="lg" trailingIcon={ChevronRight}>Full width</Button>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <SectionHeader title="Cards" action={{ label: 'See all', onClick: () => undefined }} />
          <div className="space-y-4">
            <BrandCard>
              <p className="text-sm text-white/80">Total balance</p>
              <MoneyText value={balance} size="display" animate className="text-white" />
              <button type="button" className="mt-2 text-sm text-white/80 underline" onClick={() => setBalance((b) => b + 1234.56)}>+1.234,56 (count-up)</button>
            </BrandCard>
            <Card interactive>
              <p className="text-content-secondary text-sm">Interactive card</p>
              <MoneyText value={-2148.96} size="xl" tone="semantic" />
            </Card>
          </div>
        </div>
        <div>
          <SectionHeader title="Payment cards" />
          <div className="space-y-4">
            <PaymentCard title="Conta Corrente" subtitle="Checking" type={AccountType.CHECKING} amount={<MoneyText value={6684.39} size="xl" className="text-white" />} />
            <div className="grid grid-cols-2 gap-3">
              <PaymentCard compact title="Cartão" subtitle="Credit card" type={AccountType.CREDIT} amount={<MoneyText value={2148.96} className="text-white" />} onClick={() => undefined} />
              <PaymentCard compact title="Reserva" subtitle="Savings" type={AccountType.SAVINGS} color="#E8590C" amount={<MoneyText value={22855.27} className="text-white" />} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="List rows" />
        <ListGroup>
          <ListRow leading={<IconBadge icon={Utensils} color="#F59E0B" />} title="Restaurante" subtitle="Alimentação · Nubank" trailing={<MoneyText value={-86.5} sign="always" tone="semantic" />} onClick={() => undefined} />
          <ListRow leading={<IconBadge icon={ArrowDownLeft} color="#12B76A" />} title="Salário" subtitle={<span className="inline-flex items-center gap-1.5">Salário <Badge tone="warning">Pendente</Badge></span>} trailing={<MoneyText value={100} sign="always" tone="semantic" />} />
          <ListRow leading={<IconBadge icon={Home} />} title="Aluguel com um nome bem comprido para testar o corte do texto" subtitle="Moradia" trailing={<MoneyText value={-2200} sign="always" tone="semantic" />} />
          <SkeletonRow />
        </ListGroup>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <SectionHeader title="Controls" />
          <Card className="space-y-5">
            <SegmentedControl label="Type" value={segment} onChange={setSegment} fullWidth options={[{ value: 'out', label: 'Saída' }, { value: 'in', label: 'Entrada' }]} />
            <SegmentedControl label="Period" size="sm" value={period} onChange={setPeriod} options={[{ value: 'month', label: 'Month' }, { value: 'quarter', label: 'Quarter' }, { value: 'year', label: 'Year' }]} />
            <div className="flex flex-wrap gap-2">
              {[{ id: 'food', label: 'Food', icon: Utensils }, { id: 'market', label: 'Market', icon: ShoppingCart }, { id: 'home', label: 'Home', icon: Home }].map((c) => (
                <Chip key={c.id} icon={c.icon} selected={chip === c.id} onClick={() => setChip(c.id)}>{c.label}</Chip>
              ))}
              <Chip color="#E8590C" selected>Custom</Chip>
              <Chip color="#0EA5E9">Custom idle</Chip>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge><Badge tone="brand">Brand</Badge><Badge tone="positive" icon={Check}>Paid</Badge>
              <Badge tone="negative">Late</Badge><Badge tone="warning">Pending</Badge><Badge tone="info">Info</Badge>
            </div>
            <label className="flex items-center justify-between">
              <span className="text-content">Switch</span>
              <Switch checked={on} onChange={setOn} label="Switch" />
            </label>
          </Card>
        </div>
        <div>
          <SectionHeader title="Fields" />
          <Card className="space-y-4">
            <AmountInput currencySymbol="R$" placeholder="0,00" aria-label="Amount" />
            <Field label="Description" hint="What was it for?"><Input placeholder="Mercado" /></Field>
            <Field label="Search"><Input icon={Inbox} placeholder="Search" /></Field>
            <Field label="Category" required><Select value={category} onChange={setCategory} options={[{ value: 'food', label: 'Alimentação', icon: Utensils, color: '#F59E0B' }, { value: 'home', label: 'Moradia', icon: Home, color: '#5B3DF5' }, { value: 'market', label: 'Mercado', icon: ShoppingCart, color: '#12B76A' }]} /></Field>
            <Field label="Long list (search)"><Select value={month} onChange={setMonth} placeholder="Pick a month" options={['January','February','March','April','May','June','July','August','September','October','November','December'].map((m) => ({ value: m, label: m }))} /></Field>
            <Field label="Amount" error="Enter a value above zero"><Input suffix="BRL" defaultValue="0" /></Field>
            <Field label="Notes"><Textarea placeholder="Optional" /></Field>
            <Field label="Disabled"><Input disabled value="Locked" readOnly /></Field>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card padding="none"><EmptyState icon={Inbox} title="No transactions" description="Transactions you add show up here." action={{ label: 'Add transaction', onClick: () => undefined, icon: Plus }} /></Card>
        <Card padding="none"><ErrorState title="Couldn't load" description="Check your connection." retryLabel="Try again" onRetry={() => undefined} /></Card>
      </section>

      <section>
        <SectionHeader title="Money and skeletons" />
        <Card className="flex flex-wrap items-end gap-6">
          <MoneyText value={1234.5} size="sm" />
          <MoneyText value={1234.5} sign="always" tone="semantic" size="lg" />
          <MoneyText value={-1234.5} tone="semantic" size="xl" />
          <MoneyText value={98765.43} size="display" />
          <div className="flex-1 space-y-2 min-w-[160px]"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
        </Card>
      </section>

      <section>
        <SectionHeader title="Loader" />
        <Card><LoadingSpinner size={56} className="py-8" /></Card>
      </section>

      <section>
        <SectionHeader title="Modals" />
        <div className="flex gap-3">
          <Button variant="tertiary" onClick={() => setModal('form')}>Form modal</Button>
          <Button variant="tertiary" onClick={() => setModal('confirm')}>Confirm modal</Button>
          <Button variant="tertiary" onClick={() => { toast.success('Transaction saved'); toast.error('Could not delete the account'); toast.info('Syncing in the background'); }}>Toasts</Button>
        </div>
        <Modal
          isOpen={modal === 'form'}
          onClose={() => setModal(null)}
          title="New transaction"
          icon={ArrowUpRight}
          size="lg"
          footer={<><Button variant="tertiary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={() => setModal(null)}>Save</Button></>}
        >
          <div className="space-y-4">
            <SegmentedControl label="Type" value={segment} onChange={setSegment} fullWidth options={[{ value: 'out', label: 'Saída' }, { value: 'in', label: 'Entrada' }]} />
            <AmountInput currencySymbol="R$" placeholder="0,00" aria-label="Amount" />
            <Field label="Description"><Input placeholder="Mercado" /></Field>
            <Field label="Category"><Select value={category} onChange={setCategory} options={[{ value: 'food', label: 'Alimentação' }, { value: 'home', label: 'Moradia' }]} /></Field>
          </div>
        </Modal>
        <Modal
          isOpen={modal === 'confirm'}
          onClose={() => setModal(null)}
          title="Delete account?"
          description="This removes the account and its transactions. It can't be undone."
          icon={Trash2}
          iconTone="negative"
          size="sm"
          footer={<><Button variant="tertiary" onClick={() => setModal(null)}>Cancel</Button><Button variant="destructive" onClick={() => setModal(null)}>Delete</Button></>}
        />
      </section>
    </div>
  );
};

export default UiGallery;

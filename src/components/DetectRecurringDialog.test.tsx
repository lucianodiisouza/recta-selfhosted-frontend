// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enUS from '../i18n/en-US.json';
import type { RecurringApplyInput, RecurringApplyResult, RecurringCandidate, RecurringDetectResponse } from '../hooks/api/useDetectRecurring';
import DetectRecurringDialog from './DetectRecurringDialog';

const mocks = vi.hoisted(() => ({
  detect: vi.fn(),
  apply: vi.fn(),
  success: vi.fn(),
  showToast: vi.fn(),
}));

// The dialog runs against its real helpers and the real en-US strings; only the data layer, contexts and formatters are
// replaced. The apply mock keeps a real pending state, so the dialog sees "applying" while the request is in flight.
vi.mock('../hooks/api/useDetectRecurring', async () => {
  const { useState } = await import('react');
  return {
    useDetectRecurring: () => ({ mutateAsync: (input: unknown) => mocks.detect(input) }),
    useApplyDetectedRecurring: () => {
      const [isPending, setPending] = useState(false);
      return {
        isPending,
        mutateAsync: async (input: unknown) => {
          // React Query reports `isPending` to the component a tick after the call, like this: a second click right after
          // the first still sees `isPending === false`.
          const timer = setTimeout(() => setPending(true), 0);
          try {
            return await mocks.apply(input);
          } finally {
            clearTimeout(timer);
            setPending(false);
          }
        },
      };
    },
  };
});
vi.mock('../context/ToastContext', () => ({ useToastContext: () => ({ success: mocks.success, showToast: mocks.showToast }) }));
vi.mock('../context/CurrencyContext', () => ({ useCurrency: () => ({ baseCurrency: 'BRL' }) }));
vi.mock('../context/I18nContext', () => ({ useI18n: () => ({ t: enUS }) }));
// The real formatters pull in the currency table, which pulls in Firebase; the dialog only needs a stable rendering.
vi.mock('../utils/format', () => ({
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
  formatDate: (date: Date) => date.toISOString().slice(0, 10),
  parseDateFromAPI: (date: string) => new Date(`${date.slice(0, 10)}T00:00:00.000Z`),
}));

// Invented data only.
const cand = (id: string, description: string, o: Partial<RecurringCandidate> = {}): RecurringCandidate => ({
  id, accountId: 'acc-main', accountName: 'Main account', description, categoryName: 'ENTERTAINMENT', amount: 100, medianAmount: 100, minAmount: 100, maxAmount: 100,
  dayOfMonth: 10, monthsSeen: 6, windowMonths: 12, lastMonth: '2026-09', kind: 'stable', confidence: 0.9, defaultSelected: true, followLastAmount: true,
  examples: [{ transactionId: `${id}-t1`, date: '2026-09-10', amount: 100, description }], ...o,
});
const STREAM = cand('c-stream', 'Streaming Alfa', {
  amount: 39.9, medianAmount: 39.9, minAmount: 39.9, maxAmount: 39.9, dayOfMonth: 5, monthsSeen: 10,
  examples: [
    { transactionId: 'e1', date: '2026-09-05', amount: 39.9, description: 'STREAMING ALFA 09' },
    { transactionId: 'e2', date: '2026-08-05', amount: 39.9, description: 'STREAMING ALFA 08' },
  ],
});
const GYM = cand('c-gym', 'Gym Beta', { amount: 120, dayOfMonth: 12, defaultSelected: false, confidence: 0.55 });
const POWER = cand('c-power', 'Power bill', { kind: 'bill', amount: 187.43, minAmount: 150.1, maxAmount: 210, medianAmount: 180, dayOfMonth: 20, confidence: 0.7, monthsSeen: 9, accountName: 'House account' });
const WATER = cand('c-water', 'Water bill', { kind: 'bill', amount: 64.5, dayOfMonth: 15, defaultSelected: false });
const ALL = [STREAM, GYM, POWER, WATER];
const SKIPPED = { alreadyRecurring: 2, installments: 1, sparse: 0, consumption: 7 };
const detection = (candidates: RecurringCandidate[] = ALL, skipped = SKIPPED): RecurringDetectResponse => ({ candidates, skipped });
const applied = (o: Partial<RecurringApplyResult> = {}): RecurringApplyResult => ({ created: 2, skipped: 0, linkedTransactions: 12, warnings: [], ...o });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const httpError = (status: number, message: string, code?: string) => Object.assign(new Error(message), { status, code });

function setup(props: Partial<React.ComponentProps<typeof DetectRecurringDialog>> = {}) {
  const onClose = vi.fn();
  const utils = render(<DetectRecurringDialog open onClose={onClose} householdId="h1" canWrite {...props} />);
  return { onClose, ...utils };
}

const box = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const row = (id: string) => document.querySelector<HTMLElement>(`tr[data-candidate="${id}"]`)!;
const createButton = () => screen.getByRole('button', { name: /^(Create recurrences|Creating…)/ }) as HTMLButtonElement;
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const summary = () => document.querySelector('[data-summary]')?.textContent ?? null;
const blocker = () => document.getElementById('detect-recurring-blocker')?.textContent ?? null;
const ticks = () => Object.fromEntries(ALL.map((c) => [c.id, box(`Create recurrence: ${c.description}`).checked]));

async function ready() {
  await screen.findByText(/seem to repeat every month/);
}

beforeEach(() => {
  mocks.detect.mockResolvedValue(detection());
  mocks.apply.mockResolvedValue(applied());
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  document.body.style.overflow = '';
});

describe('DetectRecurringDialog: detection', () => {
  it('renders nothing while closed and does not detect', () => {
    render(<DetectRecurringDialog open={false} onClose={vi.fn()} householdId="h1" canWrite />);

    expect(screen.queryByText(enUS.detectRecTitle)).toBeNull();
    expect(mocks.detect).not.toHaveBeenCalled();
  });

  it('detects once on opening with the household only, creates nothing, and lists the candidates by kind', async () => {
    setup();
    await ready();

    expect(mocks.detect).toHaveBeenCalledTimes(1);
    expect(mocks.detect).toHaveBeenCalledWith({ householdId: 'h1' });
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(screen.getByText(/Stable amount \(2\)/)).toBeTruthy();
    expect(screen.getByText(/Monthly bill \(2\)/)).toBeTruthy();
    const stream = row('c-stream').textContent ?? '';
    expect(stream).toContain('Main account');
    expect(stream).toContain('10 of 12');
    expect(stream).toContain('stable');
    expect(stream).toContain('90%');
    expect(field('Amount of Streaming Alfa').value).toBe('39,90');
    expect(field('Day of the month of Streaming Alfa').value).toBe('5');
    expect(row('c-stream').querySelector('[data-range]')).toBeNull();
    expect(row('c-power').querySelector('[data-range]')?.textContent).toBe('BRL 150.10 – BRL 210.00');
    expect(screen.getByText('Left out: Already recurring: 2, Installments: 1, Variable spending: 7.')).toBeTruthy();
  });

  it('ticks the candidates the server marked and builds the summary from the rows that would be sent', async () => {
    setup();
    await ready();

    expect(ticks()).toEqual({ 'c-stream': true, 'c-gym': false, 'c-power': true, 'c-water': false });
    expect(summary()).toBe('2 to create (1 stable, 1 bills) · BRL 227.33 per month · 2 follow the last value');

    fireEvent.click(box('Create recurrence: Gym Beta'));

    expect(summary()).toBe('3 to create (2 stable, 1 bills) · BRL 347.33 per month · 3 follow the last value');
    expect(createButton().textContent).toBe('Create recurrences (3)');
  });

  it('expands the examples of one candidate at a time, dates as sent', async () => {
    setup();
    await ready();

    expect(document.querySelector('tr[data-examples]')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Show examples of Streaming Alfa' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);

    const examples = document.querySelector<HTMLElement>('tr[data-examples="c-stream"]')!;
    expect(examples.textContent).toContain('2026-09-05');
    expect(examples.textContent).toContain('STREAMING ALFA 08');
    expect(examples.textContent).toContain('BRL 39.90');
    expect(document.querySelector('tr[data-examples="c-power"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show examples of Streaming Alfa' }));
    expect(document.querySelector('tr[data-examples]')).toBeNull();
  });

  it('bulk selection touches only its own kind and flips to "Unselect"', async () => {
    setup();
    await ready();

    fireEvent.click(screen.getByRole('button', { name: 'Select all stable' }));
    expect(ticks()).toEqual({ 'c-stream': true, 'c-gym': true, 'c-power': true, 'c-water': false });
    fireEvent.click(screen.getByRole('button', { name: 'Select all bills' }));
    expect(ticks()).toEqual({ 'c-stream': true, 'c-gym': true, 'c-power': true, 'c-water': true });
    fireEvent.click(screen.getByRole('button', { name: 'Unselect all bills' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unselect all stable' }));

    expect(ticks()).toEqual({ 'c-stream': false, 'c-gym': false, 'c-power': false, 'c-water': false });
    expect(summary()).toBe('Nothing selected.');
    expect(createButton().disabled).toBe(true);
    expect(blocker()).toBe('Select at least one expense.');
  });

  it('shows what was left out and detects again when nothing is new', async () => {
    mocks.detect.mockResolvedValue(detection([], { alreadyRecurring: 1, installments: 0, sparse: 3, consumption: 0 }));
    setup();

    expect(await screen.findByText(enUS.detectRecEmpty)).toBeTruthy();
    expect(screen.getByText('Left out: Already recurring: 1, Too many gaps: 3.')).toBeTruthy();

    mocks.detect.mockResolvedValue(detection([STREAM]));
    fireEvent.click(screen.getByRole('button', { name: enUS.detectRecAgain }));
    await screen.findByText(/seems to repeat every month/);
    expect(mocks.detect).toHaveBeenCalledTimes(2);
  });

  it('says so when detection fails on open and the retry works', async () => {
    mocks.detect.mockRejectedValueOnce(new Error('Network down'));
    setup();

    expect((await screen.findByRole('alert')).textContent).toBe('Network down');
    expect(mocks.showToast).toHaveBeenCalledWith('Network down', 'error', 10000);

    fireEvent.click(screen.getByRole('button', { name: enUS.detectRecRetry }));
    await ready();
    expect(mocks.detect).toHaveBeenCalledTimes(2);
  });

  it('hands over to the caller when the server has no detection route (framework 404, no app code)', async () => {
    mocks.detect.mockRejectedValueOnce(httpError(404, 'Route POST:/recurring-transactions/detect not found'));
    const onUnavailable = vi.fn();
    setup({ onUnavailable });

    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1));
    expect(mocks.showToast).not.toHaveBeenCalled();
  });

  it('treats a 404 that carries an app code as a plain error, not as a missing route', async () => {
    mocks.detect.mockRejectedValueOnce(httpError(404, 'Household not found', 'NOT_FOUND'));
    const onUnavailable = vi.fn();
    setup({ onUnavailable });

    expect((await screen.findByRole('alert')).textContent).toBe('Household not found');
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it('keeps the newest detection when an older, slower one lands afterwards', async () => {
    setup();
    await ready();
    const slow = deferred<RecurringDetectResponse>();
    mocks.detect.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(detection([GYM]));

    // Two re-detections: the first is slow, the second answers at once. The slow one must not overwrite the newer list.
    fireEvent.click(screen.getByRole('button', { name: enUS.detectRecAgain }));
    fireEvent.click(screen.getByRole('button', { name: enUS.detectRecAgain }));
    await waitFor(() => expect(row('c-gym')).toBeTruthy());
    expect(document.querySelector('tr[data-candidate="c-stream"]')).toBeNull();

    await act(async () => {
      slow.resolve(detection([WATER]));
      await slow.promise;
    });

    expect(document.querySelector('tr[data-candidate="c-water"]')).toBeNull();
    expect(row('c-gym')).toBeTruthy();
  });

  it('starts over when closed and reopened: a fresh detection and no leftover choices', async () => {
    const { rerender, onClose } = setup();
    await ready();
    fireEvent.click(box('Create recurrence: Gym Beta'));
    expect(box('Create recurrence: Gym Beta').checked).toBe(true);

    rerender(<DetectRecurringDialog open={false} onClose={onClose} householdId="h1" canWrite />);
    rerender(<DetectRecurringDialog open onClose={onClose} householdId="h1" canWrite />);
    await ready();

    expect(mocks.detect).toHaveBeenCalledTimes(2);
    expect(box('Create recurrence: Gym Beta').checked).toBe(false);
  });

  it('ignores a detection that finishes after the dialog closed', async () => {
    const late = deferred<RecurringDetectResponse>();
    mocks.detect.mockReturnValueOnce(late.promise);
    const { rerender, onClose } = setup();
    await waitFor(() => expect(mocks.detect).toHaveBeenCalledTimes(1));

    rerender(<DetectRecurringDialog open={false} onClose={onClose} householdId="h1" canWrite />);
    await act(async () => {
      late.resolve(detection());
      await late.promise;
    });
    rerender(<DetectRecurringDialog open onClose={onClose} householdId="h1" canWrite />);
    await ready();

    // The reopening ran its own detection; the stale answer did not fill the list before it.
    expect(mocks.detect).toHaveBeenCalledTimes(2);
  });
});

describe('DetectRecurringDialog: adjustments', () => {
  it('validates amount, day and description, blocks creating with the reason, and unblocks on the fix', async () => {
    setup();
    await ready();
    expect(createButton().disabled).toBe(false);

    type(field('Amount of Streaming Alfa'), 'abc');
    expect(row('c-stream').textContent).toContain(enUS.detectRecErrAmountInvalid);
    expect(createButton().disabled).toBe(true);
    expect(blocker()).toBe(enUS.detectRecBlockInvalid);
    type(field('Amount of Streaming Alfa'), '0');
    expect(row('c-stream').textContent).toContain(enUS.detectRecErrAmountZero);
    type(field('Amount of Streaming Alfa'), '');
    expect(row('c-stream').textContent).toContain(enUS.detectRecErrAmountEmpty);
    type(field('Amount of Streaming Alfa'), '41,90');
    expect(row('c-stream').textContent).not.toContain('Invalid amount');

    type(field('Day of the month of Power bill'), '32');
    expect(row('c-power').textContent).toContain(enUS.detectRecErrDay);
    type(field('Description of Power bill'), '   ');
    expect(row('c-power').textContent).toContain(enUS.detectRecErrDescEmpty);
    expect(createButton().disabled).toBe(true);

    type(field('Day of the month of Power bill'), '31');
    type(field('Description of Power bill'), 'Energy');
    expect(createButton().disabled).toBe(false);
    expect(blocker()).toBeNull();
    expect(summary()).toContain('BRL 229.33 per month');
  });

  it('is not blocked by an invalid adjustment on a candidate that is not ticked', async () => {
    setup();
    await ready();

    type(field('Day of the month of Gym Beta'), '99');

    expect(row('c-gym').textContent).toContain(enUS.detectRecErrDay);
    expect(createButton().disabled).toBe(false);
  });

  it('lets the user turn "follow the last value" on or off per row and for all', async () => {
    setup();
    await ready();

    fireEvent.click(box('Follow the last value: Streaming Alfa'));
    expect(box('Follow the last value: Streaming Alfa').checked).toBe(false);
    expect(summary()).toContain('1 follow the last value');
    fireEvent.click(screen.getByRole('button', { name: enUS.detectRecFollowAllOn }));
    expect(box('Follow the last value: Streaming Alfa').checked).toBe(true);
    expect(summary()).toContain('2 follow the last value');
    fireEvent.click(screen.getByRole('button', { name: enUS.detectRecFollowAllOff }));
    expect(box('Follow the last value: Gym Beta').checked).toBe(false);
    expect(summary()).toContain('0 follow the last value');
  });
});

describe('DetectRecurringDialog: creating', () => {
  it('sends one request with the ticked ids and only the adjusted fields, then shows the result', async () => {
    setup();
    await ready();
    type(field('Amount of Power bill'), '195,50');
    type(field('Day of the month of Power bill'), '25');
    type(field('Description of Power bill'), ' Home energy ');
    fireEvent.click(box('Follow the last value: Power bill'));

    fireEvent.click(createButton());

    await screen.findByText(enUS.detectRecResultTitle);
    expect(mocks.apply).toHaveBeenCalledTimes(1);
    expect(mocks.apply).toHaveBeenCalledWith({
      householdId: 'h1',
      items: [{ id: 'c-stream' }, { id: 'c-power', amount: 195.5, dayOfMonth: 25, description: 'Home energy', followLastAmount: false }],
    } satisfies RecurringApplyInput);
    expect(mocks.success).toHaveBeenCalledWith('Recurrences created: 2 History transactions linked: 12');
    expect(screen.getByText('Recurrences created: 2')).toBeTruthy();
    expect(screen.getByText('History transactions linked: 12')).toBeTruthy();
  });

  it('translates the warnings the server returns by code', async () => {
    mocks.apply.mockResolvedValue(applied({
      skipped: 1,
      warnings: [
        { code: 'duplicate-in-call', description: 'Combo' },
        { code: 'already-active', description: 'Club' },
        { code: 'short-month-day', description: 'Rent', dayOfMonth: 31 },
      ],
    }));
    setup();
    await ready();

    fireEvent.click(createButton());

    await screen.findByText(enUS.detectRecResultTitle);
    expect(screen.getByText('“Combo” skipped: an equal recurrence was created in this same request.')).toBeTruthy();
    expect(screen.getByText('“Club” skipped: an active recurrence with this description already exists on this account.')).toBeTruthy();
    expect(screen.getByText('“Rent”: day 31; in shorter months it runs on the last day of the month.')).toBeTruthy();
    expect(screen.getByText('Items skipped (already recurring or no longer detected): 1')).toBeTruthy();
  });

  it('after a failed apply keeps the choices, blocks creating until the list is detected again, and says what may have happened', async () => {
    mocks.apply.mockRejectedValueOnce(new Error('Gateway timeout'));
    setup();
    await ready();
    fireEvent.click(box('Create recurrence: Gym Beta'));

    fireEvent.click(createButton());

    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    const message = `Gateway timeout. ${enUS.detectRecApplyPartial}`;
    expect(screen.getByText(message)).toBeTruthy();
    expect(mocks.showToast).toHaveBeenCalledWith(message, 'error', 10000);
    expect(box('Create recurrence: Gym Beta').checked).toBe(true);
    expect(createButton().disabled).toBe(true);
    expect(blocker()).toBe(enUS.detectRecBlockRefresh);

    fireEvent.click(screen.getAllByRole('button', { name: enUS.detectRecAgain })[0]);
    await waitFor(() => expect(mocks.detect).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(createButton().disabled).toBe(false));
    expect(box('Create recurrence: Gym Beta').checked).toBe(true);
  });

  it('says nothing was created when the server refused (4xx)', async () => {
    mocks.apply.mockRejectedValueOnce(httpError(403, 'No permission'));
    setup();
    await ready();

    fireEvent.click(createButton());

    expect(await screen.findByText(`No permission. ${enUS.detectRecApplyRefused}`)).toBeTruthy();
  });

  it('sends one request on a double click', async () => {
    const pending = deferred<RecurringApplyResult>();
    mocks.apply.mockReturnValueOnce(pending.promise);
    setup();
    await ready();

    const button = createButton();
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => {
      pending.resolve(applied());
      await pending.promise;
    });

    await screen.findByText(enUS.detectRecResultTitle);
    expect(mocks.apply).toHaveBeenCalledTimes(1);
  });

  it('cannot be closed while the recurrences are being created, and can afterwards', async () => {
    const pending = deferred<RecurringApplyResult>();
    mocks.apply.mockReturnValueOnce(pending.promise);
    const { onClose } = setup();
    await ready();
    fireEvent.click(createButton());
    await waitFor(() => expect(createButton().textContent).toBe(enUS.detectRecCreating));

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(document.querySelector('div[aria-hidden="true"]')!);
    const closeX = screen.getByLabelText(enUS.close);
    expect((closeX as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(closeX);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve(applied());
      await pending.promise;
    });
    await screen.findByText(enUS.detectRecResultTitle);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DetectRecurringDialog: viewer', () => {
  it('sees the candidates but has no way to choose, adjust or create', async () => {
    setup({ canWrite: false });
    await ready();

    const table = within(row('c-stream'));
    expect(table.queryAllByRole('textbox')).toHaveLength(0);
    expect(row('c-stream').textContent).toContain('BRL 39.90');
    expect(document.querySelector('[data-summary]')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Create recurrences/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select all stable' })).toBeNull();
    expect(box('Follow the last value: Streaming Alfa').disabled).toBe(true);
  });
});

describe('DetectRecurringDialog: keyboard focus', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>opener</button>
        <DetectRecurringDialog open={open} onClose={() => setOpen(false)} householdId="h1" canWrite />
      </>
    );
  }
  const openIt = async () => {
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    fireEvent.click(opener);
    await ready();
    return opener;
  };

  it('moves the focus into the dialog when it opens', async () => {
    render(<Harness />);
    await openIt();

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('keeps Tab inside the dialog: from the last control to the first, and Shift+Tab back', async () => {
    render(<Harness />);
    await openIt();
    const dialog = screen.getByRole('dialog');
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')];
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    last.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('pulls the focus back in when Tab is pressed with the focus outside', async () => {
    render(<Harness />);
    const opener = await openIt();

    opener.focus();
    fireEvent.keyDown(window, { key: 'Tab' });

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('gives the focus back to the control that opened it when it closes', async () => {
    render(<Harness />);
    const opener = await openIt();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });
});

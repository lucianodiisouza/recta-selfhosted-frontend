// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enUS from '../../i18n/en-US.json';
import type { MergeCategoryResult } from '../../hooks/api/useCategories';
import CategoryManager from './CategoryManager';

// A small stateful stand-in for the categories API, written independently of the client: it keeps the categories and the
// rows that use them, computes the usage counts and performs the merge itself. The hooks of useCategories are replaced by
// functions over it; the dialogs, helpers and en-US strings are the real ones.
const server = vi.hoisted(() => {
  type Row = { table: 'transactions' | 'recurring' | 'budgets'; categoryName: string };
  const state = {
    categories: [] as Array<{ id: string; name: string; type: 'INCOME' | 'EXPENSE'; color: string | null; isSystem: boolean }>,
    rows: [] as Row[],
    withUsage: true,
    listeners: new Set<() => void>(),
    version: 0,
    nextId: 1,
    calls: [] as Array<{ kind: string; payload: unknown }>,
    holds: {} as Record<string, { promise: Promise<void>; release: () => void }>,
    failures: {} as Record<string, unknown>,
    previewTargetOverride: null as null | { id: string; name: string; isSystem: boolean },
  };
  const notify = () => {
    state.version += 1;
    state.listeners.forEach((l) => l());
  };
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const usageOf = (name: string) => ({
    transactions: state.rows.filter((r) => r.table === 'transactions' && r.categoryName === name).length,
    recurringTransactions: state.rows.filter((r) => r.table === 'recurring' && r.categoryName === name).length,
    budgets: state.rows.filter((r) => r.table === 'budgets' && r.categoryName === name).length,
  });
  const err = (status: number, code: string | undefined, message: string) => Object.assign(new Error(message), { status, code });
  const hold = (key: string) => {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => { release = resolve; });
    state.holds[key] = { promise, release };
    return state.holds[key];
  };
  const gate = async (key: string) => {
    if (state.holds[key]) await state.holds[key].promise;
    if (state.failures[key]) {
      const failure = state.failures[key];
      delete state.failures[key];
      throw failure;
    }
  };
  return { state, notify, norm, usageOf, err, hold, gate };
});

vi.mock('../../hooks/api/useCategories', async () => {
  const { useState, useSyncExternalStore } = await import('react');
  const useServerVersion = () => useSyncExternalStore(
    (listener) => { server.state.listeners.add(listener); return () => server.state.listeners.delete(listener); },
    () => server.state.version,
  );
  const list = () => server.state.categories.map((c) => ({
    ...c,
    ...(server.state.withUsage && { usage: server.usageOf(c.isSystem ? c.id : `CUSTOM:${c.id}`) }),
  }));
  function useMutationLike<TIn, TOut>(kind: string, run: (input: TIn) => Promise<TOut>) {
    const [isPending, setPending] = useState(false);
    return {
      isPending,
      mutateAsync: async (input: TIn): Promise<TOut> => {
        server.state.calls.push({ kind, payload: input });
        // Like React Query, the pending flag reaches the component a tick after the call.
        const timer = setTimeout(() => setPending(true), 0);
        try {
          await server.gate(kind);
          return await run(input);
        } finally {
          clearTimeout(timer);
          setPending(false);
        }
      },
    };
  }
  const merge = (sourceId: string, body: { targetCategoryId?: string; targetSystemName?: string }, write: boolean): MergeCategoryResult => {
    const source = server.state.categories.find((c) => c.id === sourceId && !c.isSystem);
    if (!source) throw server.err(404, 'NOT_FOUND', 'Category not found');
    const target = server.state.categories.find((c) => c.id === (body.targetCategoryId ?? body.targetSystemName));
    if (!target) throw server.err(404, 'NOT_FOUND', 'Target category not found');
    if (target.type !== source.type) throw server.err(400, 'CATEGORY_MERGE_TYPE_MISMATCH', 'type');
    const from = `CUSTOM:${source.id}`;
    const to = target.isSystem ? target.id : `CUSTOM:${target.id}`;
    const counts = {
      transactions: server.state.rows.filter((r) => r.table === 'transactions' && r.categoryName === from).length,
      recurringTransactions: server.state.rows.filter((r) => r.table === 'recurring' && r.categoryName === from).length,
      budgets: server.state.rows.filter((r) => r.table === 'budgets' && r.categoryName === from).length,
      budgetsCombined: 0,
    };
    if (write) {
      server.state.rows.forEach((r) => { if (r.categoryName === from) r.categoryName = to; });
      server.state.categories = server.state.categories.filter((c) => c.id !== source.id);
      server.notify();
    }
    const answered = !write && server.state.previewTargetOverride ? server.state.previewTargetOverride : { id: target.id, name: target.name, isSystem: target.isSystem };
    return { preview: !write, sourceId, sourceName: source.name, type: source.type as MergeCategoryResult["type"], target: answered, counts };
  };
  return {
    useCategories: () => {
      useServerVersion();
      return { data: list(), isLoading: false, isError: false };
    },
    useCreateCategory: () => useMutationLike('create', async (input: { householdId: string; name: string; type: 'INCOME' | 'EXPENSE'; color?: string | null }) => {
      const clash = server.state.categories.find((c) => c.type === input.type && server.norm(c.name) === server.norm(input.name));
      if (clash) throw server.err(409, 'CATEGORY_NAME_TAKEN', 'taken');
      const made = { id: `c-new-${server.state.nextId++}`, name: input.name, type: input.type, color: input.color ?? null, isSystem: false };
      server.state.categories.push(made);
      server.notify();
      return made;
    }),
    useUpdateCategory: () => useMutationLike('update', async (input: { id: string; name?: string; color?: string | null }) => {
      const row = server.state.categories.find((c) => c.id === input.id)!;
      if (input.name) {
        const clash = server.state.categories.find((c) => c.id !== row.id && c.type === row.type && server.norm(c.name) === server.norm(input.name!));
        if (clash) throw server.err(409, 'CATEGORY_NAME_TAKEN', 'taken');
        row.name = input.name;
      }
      if (input.color !== undefined) row.color = input.color;
      server.notify();
      return row;
    }),
    useDeleteCategory: () => useMutationLike('delete', async (id: string) => {
      if (server.usageOf(`CUSTOM:${id}`).transactions > 0) throw server.err(400, 'CATEGORY_IN_USE', 'in use');
      server.state.categories = server.state.categories.filter((c) => c.id !== id);
      server.notify();
    }),
    useMergeCategory: () => useMutationLike('merge', async (input: { sourceId: string; body: { targetCategoryId?: string; targetSystemName?: string } }) => merge(input.sourceId, input.body, true)),
    previewMergeCategory: async (sourceId: string, body: { targetCategoryId?: string; targetSystemName?: string }) => {
      server.state.calls.push({ kind: 'preview', payload: { sourceId, body } });
      await server.gate(`preview:${body.targetCategoryId ?? body.targetSystemName}`);
      return merge(sourceId, body, false);
    },
  };
});

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const invalidate = vi.hoisted(() => vi.fn());
vi.mock('../../context/ToastContext', () => ({ useToastContext: () => toast }));
vi.mock('../../context/I18nContext', () => ({ useI18n: () => ({ t: enUS, locale: 'en-US' }) }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: invalidate }) }));

// Invented data only.
function seed(withUsage = true) {
  server.state.withUsage = withUsage;
  server.state.nextId = 1;
  server.state.calls = [];
  server.state.holds = {};
  server.state.failures = {};
  server.state.previewTargetOverride = null;
  server.state.categories = [
    { id: 'SALARY', name: 'Salary', type: 'INCOME', color: '#888888', isSystem: true },
    { id: 'INVESTMENTS', name: 'Investments', type: 'INCOME', color: '#888888', isSystem: true },
    { id: 'FOOD', name: 'Food', type: 'EXPENSE', color: '#888888', isSystem: true },
    { id: 'TRANSFER', name: 'Transfer', type: 'EXPENSE', color: '#888888', isSystem: true },
    { id: 'c-inv', name: 'Test Investment', type: 'INCOME', color: '#3B82F6', isSystem: false },
    { id: 'c-yield', name: 'Test Yield', type: 'INCOME', color: null, isSystem: false },
    { id: 'c-empty', name: 'Test Empty', type: 'EXPENSE', color: null, isSystem: false },
    { id: 'c-fun', name: 'Test Fun', type: 'EXPENSE', color: null, isSystem: false },
  ];
  server.state.rows = [
    ...Array.from({ length: 3 }, () => ({ table: 'transactions' as const, categoryName: 'CUSTOM:c-inv' })),
    { table: 'recurring', categoryName: 'CUSTOM:c-inv' },
    ...Array.from({ length: 2 }, () => ({ table: 'transactions' as const, categoryName: 'CUSTOM:c-yield' })),
    { table: 'budgets', categoryName: 'CUSTOM:c-yield' },
    { table: 'transactions', categoryName: 'INVESTMENTS' },
    { table: 'transactions', categoryName: 'CUSTOM:c-fun' },
  ];
}

const t = enUS as Record<string, string>;
const calls = (kind: string) => server.state.calls.filter((c) => c.kind === kind);
const row = (name: string) => screen.getByText(name).closest('li') as HTMLElement;
const dialog = () => screen.getByRole('dialog');
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const openForm = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));
const openMerge = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Merge ${name} with…` }));

function setup(props: Partial<React.ComponentProps<typeof CategoryManager>> = {}) {
  return render(<CategoryManager householdId="h1" canEdit {...props} />);
}

beforeEach(() => seed());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.style.overflow = '';
});

describe('CategoryManager: listing', () => {
  it('lists income and expense, system rows as read-only with the Default badge, custom rows with their usage', () => {
    setup();

    const income = screen.getByRole('region', { name: t.income });
    expect(within(income).getByText('Test Investment')).toBeTruthy();
    expect(row('Test Investment').textContent).toContain('3 transactions and 1 recurrence');
    expect(row('Test Yield').textContent).toContain('2 transactions and 1 budget');
    expect(row('Test Empty').textContent).toContain(t.categoryUsageNone);
    const salary = row('Salary');
    expect(salary.textContent).toContain(t.categoryManagerDefaultBadge);
    expect(within(salary).queryByRole('button')).toBeNull();
    expect(row('Investments').textContent).toContain('1 transaction');
    expect(screen.queryByText('Transfer')).toBeNull();
  });

  it('shows a viewer the list but no way to create, edit, merge or delete', () => {
    setup({ canEdit: false });

    expect(screen.getByText('Test Investment')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.addCategory })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Merge / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
  });

  it('degrades against a server without usage counts: no usage text and no merge, but it still edits and deletes', () => {
    seed(false);
    setup();

    expect(screen.getByText('Test Investment')).toBeTruthy();
    expect(row('Test Investment').textContent).not.toContain('transaction');
    expect(screen.queryByRole('button', { name: /^Merge / })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Test Investment' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Test Investment' })).toBeTruthy();
  });
});

describe('CategoryManager: create and rename', () => {
  it('creates a category of the chosen type with one request for the household, refreshes the list and closes', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: t.addCategory }));
    type(screen.getByLabelText(t.name), '  Meal   vouchers ');
    type(screen.getByLabelText(t.type), 'INCOME');
    fireEvent.click(within(dialog()).getByRole('button', { name: t.create }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls('create')).toEqual([{ kind: 'create', payload: { householdId: 'h1', name: 'Meal vouchers', type: 'INCOME', color: null } }]);
    expect(screen.getByText('Meal vouchers')).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith(t.categoryFormCreated);
  });

  it('refuses a name equal to a system or custom category before any request, with the reason', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: t.addCategory }));
    type(screen.getByLabelText(t.type), 'INCOME');

    type(screen.getByLabelText(t.name), 'investments');
    expect(screen.getByRole('alert').textContent).toBe('A default category “Investments” already exists. Use it or pick another name.');
    expect((within(dialog()).getByRole('button', { name: t.create }) as HTMLButtonElement).disabled).toBe(true);
    type(screen.getByLabelText(t.name), ' TEST   investment');
    expect(screen.getByRole('alert').textContent).toBe('A category “Test Investment” already exists. Pick another name or merge the two.');
    expect(calls('create')).toHaveLength(0);
  });

  it('shows the server refusal in words and keeps the dialog open', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: t.addCategory }));
    type(screen.getByLabelText(t.name), 'Brand new');
    server.state.failures.create = server.err(409, 'CATEGORY_NAME_TAKEN', 'CATEGORY_NAME_TAKEN');

    fireEvent.click(within(dialog()).getByRole('button', { name: t.create }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(t.categoryFailNameTaken));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith(t.categoryFailNameTaken);
  });

  it('renames sending only the name, recolors sending only the color, and keeps Save off while nothing changed', async () => {
    setup();
    openForm('Test Investment');
    const save = () => within(dialog()).getByRole('button', { name: t.save }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);

    type(screen.getByLabelText(t.name), 'Test Capital');
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls('update')[0].payload).toEqual({ id: 'c-inv', name: 'Test Capital' });

    openForm('Test Capital');
    fireEvent.click(screen.getByRole('button', { name: 'Color #22C55E' }));
    fireEvent.click(save());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls('update')[1].payload).toEqual({ id: 'c-inv', color: '#22C55E' });
  });

  it('cannot be closed while saving and saves once', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: t.addCategory }));
    type(screen.getByLabelText(t.name), 'Slow one');
    const gate = server.hold('create');
    const submit = within(dialog()).getByRole('button', { name: t.create });

    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(within(dialog()).getByRole('button', { name: t.categoryFormSaving })).toBeTruthy());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText(t.close) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => { gate.release(); await gate.promise; });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls('create')).toHaveLength(1);
  });
});

describe('CategoryManager: delete', () => {
  it('offers delete only for an unused category, after a confirmation, with one request', async () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Delete Test Investment' })).toBeNull();
    expect(row('Test Investment').textContent).toContain(t.categoryManagerInUse);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Test Empty' }));
    expect(screen.getByText('Delete “Test Empty”? No transaction uses this category.')).toBeTruthy();
    expect(calls('delete')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: t.delete, hidden: false }));

    await waitFor(() => expect(calls('delete')).toHaveLength(1));
    expect(calls('delete')[0].payload).toBe('c-empty');
    await waitFor(() => expect(screen.queryByText('Test Empty')).toBeNull());
    expect(toast.success).toHaveBeenCalledWith(t.categoryManagerDeleted);
  });

  it('says the category is in use when the server refuses', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Test Empty' }));
    // Used by someone else after the list was loaded: only the server knows.
    server.state.rows.push({ table: 'transactions', categoryName: 'CUSTOM:c-empty' });
    fireEvent.click(screen.getByRole('button', { name: t.delete, hidden: false }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.categoryDeleteInUse));
  });
});

describe('CategoryManager: merge', () => {
  const pick = (value: string) => fireEvent.change(screen.getByLabelText(t.categoryMergeKeep), { target: { value } });
  const confirm = () => within(dialog()).getByRole('button', { name: t.categoryMergeConfirm }) as HTMLButtonElement;

  it('offers targets of the same type, shows what moves, and merges on confirm', async () => {
    setup();
    openMerge('Test Investment');
    const select = screen.getByLabelText<HTMLSelectElement>(t.categoryMergeKeep);
    expect([...select.options].map((o) => o.value)).toEqual(['', 'custom:c-yield', 'system:INVESTMENTS', 'system:SALARY']);
    expect(confirm().disabled).toBe(true);

    pick('custom:c-yield');

    await screen.findByText('Moves to Test Yield: 3 transactions and 1 recurrence.');
    expect(calls('preview')[0].payload).toEqual({ sourceId: 'c-inv', body: { targetCategoryId: 'c-yield' } });
    expect(calls('merge')).toHaveLength(0);
    fireEvent.click(confirm());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls('merge')[0].payload).toEqual({ sourceId: 'c-inv', body: { targetCategoryId: 'c-yield' } });
    expect(screen.queryByText('Test Investment')).toBeNull();
    expect(row('Test Yield').textContent).toContain('5 transactions, 1 recurrence, and 1 budget');
    expect(toast.success).toHaveBeenCalledWith('“Test Investment” was merged into “Test Yield”.');
  });

  it('names a system target by its enum value', async () => {
    setup();
    openMerge('Test Investment');
    pick('system:INVESTMENTS');
    await screen.findByText(/^Moves to Investments/);

    fireEvent.click(confirm());

    await waitFor(() => expect(calls('merge')).toHaveLength(1));
    expect(calls('merge')[0].payload).toEqual({ sourceId: 'c-inv', body: { targetSystemName: 'INVESTMENTS' } });
  });

  it('keeps only the answer of the newest pick when an earlier preview is slower', async () => {
    setup();
    openMerge('Test Investment');
    const slow = server.hold('preview:c-yield');

    pick('custom:c-yield');
    pick('system:INVESTMENTS');
    await screen.findByText(/^Moves to Investments/);
    await act(async () => { slow.release(); await slow.promise; });

    expect(screen.queryByText(/^Moves to Test Yield/)).toBeNull();
    expect(screen.getByText(/^Moves to Investments/)).toBeTruthy();
  });

  it('cannot be closed or fired twice while the merge runs', async () => {
    setup();
    openMerge('Test Investment');
    pick('custom:c-yield');
    await screen.findByText(/^Moves to Test Yield/);
    const gate = server.hold('merge');

    const button = confirm();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(within(dialog()).getByRole('button', { name: t.categoryMergeMerging })).toBeTruthy());
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(document.querySelector('div[aria-hidden="true"]')!);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText(t.close) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => { gate.release(); await gate.promise; });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls('merge')).toHaveLength(1);
  });

  it('says the category is gone and refreshes the list when it was merged elsewhere before the preview', async () => {
    setup();
    openMerge('Test Investment');
    server.state.categories = server.state.categories.filter((c) => c.id !== 'c-inv');

    pick('custom:c-yield');

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(t.categoryFailNotFound));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['categories'] });
    expect(confirm().disabled).toBe(true);
    expect(calls('merge')).toHaveLength(0);
  });

  it('never shows or confirms a preview that belongs to another target than the one picked now', async () => {
    setup();
    openMerge('Test Investment');
    server.state.previewTargetOverride = { id: 'c-empty', name: 'Test Empty', isSystem: false };

    pick('custom:c-yield');

    await waitFor(() => expect(calls('preview')).toHaveLength(1));
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText(/^Moves to /)).toBeNull();
    expect(confirm().disabled).toBe(true);
    expect(calls('merge')).toHaveLength(0);
  });

  it('says the feature is not available when the server has no merge route (framework 404 without an app code)', async () => {
    setup();
    openMerge('Test Investment');
    server.state.failures['preview:c-yield'] = server.err(404, undefined, 'Route POST:/categories/c-inv/merge not found');

    pick('custom:c-yield');

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(t.categoryFailUnavailable));
    expect(invalidate).not.toHaveBeenCalled();
    expect(confirm().disabled).toBe(true);
  });

  it('shows a refusal of the merge itself in words and stays open', async () => {
    setup();
    openMerge('Test Investment');
    pick('custom:c-yield');
    await screen.findByText(/^Moves to Test Yield/);
    server.state.failures.merge = server.err(400, 'CATEGORY_MERGE_TYPE_MISMATCH', 'CATEGORY_MERGE_TYPE_MISMATCH');

    fireEvent.click(confirm());

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(t.categoryFailTypeMismatch));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

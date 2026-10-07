// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import enUS from '../i18n/en-US.json';
import { TransactionType } from '../lib/enums';
import CategoryCombobox from './CategoryCombobox';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  categories: [] as Array<Record<string, unknown>>,
}));

vi.mock('../hooks/api/useCategories', () => ({
  useCategories: () => ({ data: mocks.categories }),
  useCreateCategory: () => ({ mutateAsync: mocks.create }),
}));
vi.mock('../context/I18nContext', () => ({ useI18n: () => ({ t: enUS, locale: 'en-US' }) }));

const t = enUS as Record<string, string>;

// Radix Popover measures its trigger; jsdom has no layout engine.
beforeAll(() => {
  class FakeResizeObserver { observe() {} unobserve() {} disconnect() {} }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.hasPointerCapture = () => false;
});

let current = '';
function Harness(props: Partial<React.ComponentProps<typeof CategoryCombobox>>) {
  const [value, setValue] = useState('');
  current = value;
  return <CategoryCombobox value={value} onValueChange={setValue} type={TransactionType.EXPENSE} householdId="h1" {...props} />;
}

const trigger = () => screen.getByText(t.selectCategory).closest('button') as HTMLButtonElement;
const openPopover = async () => {
  const button = trigger();
  fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse' });
  fireEvent.click(button);
  return screen.findByPlaceholderText(t.searchCategory);
};
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

beforeEach(() => {
  current = '';
  mocks.categories = [
    { id: 'c-voucher', name: 'Test Voucher', type: 'EXPENSE', isSystem: false, color: null, icon: null },
  ];
  mocks.create.mockImplementation(async (input: { name: string; type: string }) => ({ id: 'c-new', name: input.name, type: input.type, color: null, icon: null }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CategoryCombobox inline create', () => {
  it('offers Create for text that matches nothing and creates a category of the form type, selecting it by name', async () => {
    render(<Harness allowCreate />);
    const search = await openPopover();

    type(search, '  Meal   vouchers ');
    fireEvent.click(screen.getByRole('button', { name: 'Create “Meal vouchers”' }));

    await waitFor(() => expect(current).toBe('CUSTOM:c-new'));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith({ householdId: 'h1', name: 'Meal vouchers', type: 'EXPENSE' });
    expect(screen.getByText('Meal vouchers')).toBeTruthy();
    expect(screen.queryByPlaceholderText(t.searchCategory)).toBeNull();
  });

  it('does not offer Create for an existing name (case and accents), empty text, or without allowCreate', async () => {
    const { unmount } = render(<Harness allowCreate />);
    const search = await openPopover();
    type(search, 'test VOUCHER');
    expect(screen.queryByRole('button', { name: /^Create “/ })).toBeNull();
    type(search, '   ');
    expect(screen.queryByRole('button', { name: /^Create “/ })).toBeNull();
    unmount();

    render(<Harness />);
    type(await openPopover(), 'Something new');
    expect(screen.queryByRole('button', { name: /^Create “/ })).toBeNull();
  });

  it('does not offer Create in a filter without a type', async () => {
    render(<Harness allowCreate type={undefined} />);
    type(await openPopover(), 'Something new');

    expect(screen.queryByRole('button', { name: /^Create “/ })).toBeNull();
  });

  it('creates on Enter when nothing matches, and a double activation creates once', async () => {
    let resolve!: (value: unknown) => void;
    mocks.create.mockImplementationOnce(() => new Promise((res) => { resolve = res; }));
    render(<Harness allowCreate />);
    const search = await openPopover();
    type(search, 'Brand new');

    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(screen.getByRole('button', { name: t.categoryComboCreating })).toBeTruthy();
    await act(async () => { resolve({ id: 'c-new', name: 'Brand new', type: 'EXPENSE', color: null, icon: null }); });

    await waitFor(() => expect(current).toBe('CUSTOM:c-new'));
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it('keeps the popover open, says why in words and selects nothing when the create fails', async () => {
    mocks.create.mockRejectedValueOnce(Object.assign(new Error('CATEGORY_NAME_TAKEN'), { status: 409, code: 'CATEGORY_NAME_TAKEN' }));
    render(<Harness allowCreate />);
    const search = await openPopover();
    type(search, 'Brand new');

    fireEvent.click(screen.getByRole('button', { name: 'Create “Brand new”' }));

    expect((await screen.findByRole('alert')).textContent).toBe(t.categoryFailNameTaken);
    expect(current).toBe('');
    expect(screen.getByPlaceholderText(t.searchCategory)).toBeTruthy();
    type(search, 'Brand new two');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

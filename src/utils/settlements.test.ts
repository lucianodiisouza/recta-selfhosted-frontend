import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import * as settlements from './settlements'
import * as shares from './shares'

// Invented names and amounts only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const P: any = { ...shares, ...settlements }

describe('settlements logic', () => {
  it('suggestSettlement: the balance is the default amount; the sign decides the direction', () => {
    assert.deepEqual(P.suggestSettlement(25.4), { direction: 'RECEIVED', amountCents: 2540 });
    assert.deepEqual(P.suggestSettlement(-8), { direction: 'PAID', amountCents: 800 });
    assert.deepEqual(P.suggestSettlement(0), { direction: 'RECEIVED', amountCents: 0 });
  });

  it('balanceAfterSettlement: RECEIVED lowers what she owes, PAID raises it', () => {
    assert.equal(P.balanceAfterSettlement(2540, 'RECEIVED', 2540), 0);
    assert.equal(P.balanceAfterSettlement(2540, 'RECEIVED', 3000), -460, 'overpaying flips the sign');
    assert.equal(P.balanceAfterSettlement(-800, 'PAID', 800), 0);
  });

  it('defaultSettlementDraft: amount from the balance, create mode, no account guessed', () => {
    const d = P.defaultSettlementDraft(25.4, '2026-10-05')
    assert.deepEqual(d, {
      direction: 'RECEIVED', amountText: '25,40', date: '2026-10-05', note: '', mode: 'create', accountId: '', description: '', transactionId: '',
    })
    assert.equal(P.defaultSettlementDraft(0, '2026-10-05').amountText, '')
    assert.equal(P.defaultSettlementDraft(-3, '2026-10-05').direction, 'PAID')
  })

  it('validateSettlement: amount, date, and what the mode needs', () => {
    const base = { ...P.defaultSettlementDraft(10, '2026-10-05'), accountId: 'acc-1', description: 'Settlement from Ana' };
    assert.equal(P.validateSettlement(base).ok, true);
    assert.equal(P.validateSettlement({ ...base, amountText: '0' }).errors.amount, true);
    assert.equal(P.validateSettlement({ ...base, amountText: 'x' }).ok, false);
    assert.equal(P.validateSettlement({ ...base, date: '2026-02-30' }).errors.date, true);
    assert.equal(P.validateSettlement({ ...base, accountId: '' }).errors.account, true);
    assert.equal(P.validateSettlement({ ...base, mode: 'link' }).errors.transaction, true);
    assert.equal(P.validateSettlement({ ...base, mode: 'link', transactionId: 't1', accountId: '' }).ok, true, 'no account needed to link');
    assert.equal(P.validateSettlement({ ...base, mode: 'none', accountId: '' }).ok, true);
    assert.equal(P.isValidIsoDate('2026-02-28'), true);
    assert.equal(P.isValidIsoDate('2026-13-01'), false);
    assert.equal(P.isValidIsoDate('05/10/2026'), false);
  });

  it('buildSettlementInput: only the fields of the chosen mode (create / link / none)', () => {
    const base = { ...P.defaultSettlementDraft(25.4, '2026-10-05'), accountId: 'acc-1', description: 'Settlement from Ana', note: '  pix  ' };
    assert.deepEqual(P.buildSettlementInput(base, 'h1'), {
      householdId: 'h1', direction: 'RECEIVED', amount: 25.4, date: '2026-10-05', note: 'pix',
      createTransaction: { accountId: 'acc-1', description: 'Settlement from Ana' },
    });
    assert.deepEqual(P.buildSettlementInput({ ...base, mode: 'link', transactionId: 't9', note: '' }, 'h1'), {
      householdId: 'h1', direction: 'RECEIVED', amount: 25.4, date: '2026-10-05', transactionId: 't9',
    });
    assert.deepEqual(P.buildSettlementInput({ ...base, mode: 'none', note: '' }, 'h1'), { householdId: 'h1', direction: 'RECEIVED', amount: 25.4, date: '2026-10-05' });
    assert.deepEqual(P.buildSettlementInput({ ...base, description: '  ' }, 'h1').createTransaction, { accountId: 'acc-1' }, 'blank description: the server default');
    assert.equal(P.buildSettlementInput({ ...base, amountText: '' }, 'h1'), null);
    assert.equal(P.buildSettlementInput({ ...base, direction: 'PAID', amountText: '3,30' }, 'h1').amount, 3.3);
  });

  it('remembered account: per household, corrupt values replaced, other households kept', () => {
    const raw = P.mergeSavedSettlementAccount(null, 'h1', 'a1');
    assert.equal(P.parseSavedSettlementAccount(raw, 'h1'), 'a1');
    assert.equal(P.parseSavedSettlementAccount(raw, 'h2'), '');
    const both = P.mergeSavedSettlementAccount(raw, 'h2', 'a2');
    assert.equal(P.parseSavedSettlementAccount(both, 'h1'), 'a1');
    assert.equal(P.parseSavedSettlementAccount(both, 'h2'), 'a2');
    assert.equal(P.parseSavedSettlementAccount('{oops', 'h1'), '');
    assert.equal(P.parseSavedSettlementAccount('[1]', 'h1'), '');
    assert.equal(P.parseSavedSettlementAccount(null, 'h1'), '');
    assert.equal(P.parseSavedSettlementAccount(P.mergeSavedSettlementAccount('{oops', 'h1', 'a9'), 'h1'), 'a9');
  });

  it('settlementAccounts: active, not a credit card', () => {
    const out = P.settlementAccounts([{ id: 1, type: 'CHECKING' }, { id: 2, type: 'CREDIT' }, { id: 3, type: 'SAVINGS', isActive: false }, { id: 4, type: 'CASH', isActive: true }]);
    assert.deepEqual(out.map((a: Any) => a.id), [1, 4]);
  });

  console.log('\n[P6] person form');
})

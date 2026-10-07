// A small stateful fake of the people endpoints: the HTTP contract, not the real backend. It is written independently
// of the client logic (balances and the ledger are computed here from the stored rows), so a test can compare what a
// screen shows with what the server would answer. Every name and amount is invented.
import type { LedgerEntry, Person, PersonBalance } from '../../hooks/api/usePeople';

const norm = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cents = (reais: number): number => Math.round(reais * 100 + 1e-6);
const reais = (c: number): number => c / 100;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface FakeTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
}

interface FakeShare {
  id: string;
  seq: number;
  transactionId: string;
  personId: string;
  direction: 'THEY_OWE_ME' | 'I_OWE_THEM';
  amount: number;
  note: string | null;
}

interface FakeSettlement {
  id: string;
  seq: number;
  personId: string;
  direction: 'RECEIVED' | 'PAID';
  amount: number;
  date: string;
  transactionId: string | null;
  note: string | null;
}

export interface FakeResponse {
  status: number;
  body?: unknown;
}

type Match = (method: string, url: string, payload: Record<string, unknown> | undefined) => boolean;

export function createPeopleServer(seed: { people?: Person[]; transactions?: FakeTransaction[] } = {}) {
  const state = {
    people: clone(seed.people ?? []),
    transactions: clone(seed.transactions ?? []),
    shares: [] as FakeShare[],
    settlements: [] as FakeSettlement[],
    seq: 0,
  };
  const intercepts: Array<{ match: Match; error: Error; times: number }> = [];
  const gates: Array<{ match: Match; used: boolean; promise: Promise<void> }> = [];
  const nextId = (prefix: string): string => `${prefix}${(state.seq += 1)}`;

  const personById = (id: string): Person | undefined => state.people.find((p) => p.id === id);
  const txById = (id: string): FakeTransaction | undefined => state.transactions.find((t) => t.id === id);

  function balanceOf(person: Person): PersonBalance {
    const mine = state.shares.filter((s) => s.personId === person.id);
    const sets = state.settlements.filter((s) => s.personId === person.id);
    const sum = (list: Array<{ amount: number }>): number => list.reduce((a, x) => a + x.amount, 0);
    const owedToMe = sum(mine.filter((s) => s.direction === 'THEY_OWE_ME'));
    const iOwe = sum(mine.filter((s) => s.direction === 'I_OWE_THEM'));
    const received = sum(sets.filter((s) => s.direction === 'RECEIVED'));
    const paid = sum(sets.filter((s) => s.direction === 'PAID'));
    return {
      person: clone(person),
      owedToMe: reais(owedToMe),
      iOwe: reais(iOwe),
      received: reais(received),
      paid: reais(paid),
      balance: reais(owedToMe - iOwe - received + paid),
      openShares: mine.length,
    };
  }

  function ledgerOf(person: Person): LedgerEntry[] {
    const rows: Array<LedgerEntry & { seq: number; signedC: number }> = [];
    for (const s of state.shares.filter((x) => x.personId === person.id)) {
      const tx = txById(s.transactionId)!;
      const signedC = s.direction === 'THEY_OWE_ME' ? s.amount : -s.amount;
      rows.push({
        seq: s.seq, kind: 'share', id: s.id, date: tx.date, description: tx.description, direction: s.direction, amount: reais(s.amount),
        signed: reais(signedC), signedC, balanceAfter: 0, transactionId: tx.id, transactionAmount: tx.amount, note: s.note,
      });
    }
    for (const s of state.settlements.filter((x) => x.personId === person.id)) {
      const tx = s.transactionId ? txById(s.transactionId) : undefined;
      const signedC = s.direction === 'RECEIVED' ? -s.amount : s.amount;
      rows.push({
        seq: s.seq, kind: 'settlement', id: s.id, date: s.date, description: tx ? tx.description : 'Settlement', direction: s.direction,
        amount: reais(s.amount), signed: reais(signedC), signedC, balanceAfter: 0, transactionId: s.transactionId,
        transactionAmount: tx ? tx.amount : null, note: s.note,
      });
    }
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq));
    let running = 0;
    return rows.map(({ seq: _seq, signedC, ...row }) => {
      running += signedC;
      return { ...row, balanceAfter: reais(running) };
    });
  }

  async function route(method: string, url: string, payload: Record<string, unknown> | undefined): Promise<FakeResponse> {
    let m: RegExpExecArray | null;
    if (method === 'GET' && url === '/people') {
      const includeInactive = payload?.includeInactive === true;
      return { status: 200, body: { success: true, data: clone(state.people.filter((p) => includeInactive || p.isActive)) } };
    }
    if (method === 'GET' && url === '/people/balances') {
      const rows = state.people.map(balanceOf).filter((b) => b.person.isActive || b.balance !== 0);
      return { status: 200, body: { success: true, data: rows } };
    }
    if (method === 'POST' && url === '/people') {
      const name = String(payload?.name);
      const aliases = (payload?.aliases as string[] | undefined) ?? [];
      const taken = (label: string): boolean => state.people.some((p) => norm(p.name) === norm(label) || p.aliases.some((a) => norm(a) === norm(label)));
      if (taken(name) || aliases.some(taken)) throw new HttpError(409, 'That name or alias is already used by another person', 'CONFLICT');
      const person: Person = { id: nextId('p-new-'), householdId: String(payload?.householdId), name, aliases, userId: null, isActive: true };
      state.people.push(person);
      return { status: 201, body: { success: true, data: clone(person) } };
    }
    if ((m = /^\/people\/([^/]+)$/.exec(url)) && method === 'PATCH') {
      const person = personById(m[1]!);
      if (!person) throw new HttpError(404, 'Person not found', 'NOT_FOUND');
      Object.assign(person, payload);
      return { status: 200, body: { success: true, data: clone(person) } };
    }
    if ((m = /^\/people\/([^/]+)$/.exec(url)) && method === 'DELETE') {
      const person = personById(m[1]!);
      if (!person) throw new HttpError(404, 'Person not found', 'NOT_FOUND');
      const hasData = state.shares.some((s) => s.personId === person.id) || state.settlements.some((s) => s.personId === person.id);
      if (!hasData) {
        state.people = state.people.filter((p) => p.id !== person.id);
        return { status: 204 };
      }
      person.isActive = false;
      return { status: 200, body: { success: true, data: clone(person) } };
    }
    if ((m = /^\/people\/([^/]+)\/ledger$/.exec(url)) && method === 'GET') {
      const person = personById(m[1]!);
      if (!person) throw new HttpError(404, 'Person not found', 'NOT_FOUND');
      // Like the server: newest first; the running balance is chronological either way.
      const all = [...ledgerOf(person)].reverse();
      const offset = payload?.cursor ? Number(String(payload.cursor).slice(1)) : 0;
      const limit = Number(payload?.limit ?? 25);
      const hasMore = offset + limit < all.length;
      return {
        status: 200,
        body: { success: true, data: all.slice(offset, offset + limit), pagination: { nextCursor: hasMore ? `c${offset + limit}` : null, hasMore, total: all.length } },
      };
    }
    throw new HttpError(404, `HTTP 404`);
  }

  return {
    state,
    /** Answers a request like the API client would: the parsed body, or a status-bearing error. */
    async handle(method: string, url: string, payload?: Record<string, unknown>): Promise<FakeResponse> {
      const gate = gates.find((g) => !g.used && g.match(method, url, payload));
      if (gate) {
        gate.used = true;
        await gate.promise;
      }
      const hit = intercepts.find((i) => i.times > 0 && i.match(method, url, payload));
      if (hit) {
        hit.times -= 1;
        throw hit.error;
      }
      return route(method, url, payload);
    },
    /** The next `times` requests matching fail with `error`. */
    failNext(match: Match, error: Error, times = 1): void {
      intercepts.push({ match, error, times });
    },
    /** Holds the first request matching until `ok()` is called. */
    gate(match: Match): { ok: () => void } {
      let release: () => void = () => undefined;
      const gate = { match, used: false, promise: new Promise<void>((resolve) => { release = resolve; }) };
      gates.push(gate);
      return { ok: () => release() };
    },
    addTransaction(tx: FakeTransaction): void {
      state.transactions.push(clone(tx));
    },
    addShare(txId: string, personId: string, amountReais: number, direction: FakeShare['direction'] = 'THEY_OWE_ME', note: string | null = null): void {
      state.shares.push({ id: nextId('sh-'), seq: state.seq, transactionId: txId, personId, direction, amount: cents(amountReais), note });
    },
    addSettlement(personId: string, amountReais: number, date: string, direction: FakeSettlement['direction'] = 'RECEIVED'): void {
      state.settlements.push({ id: nextId('st-'), seq: state.seq, personId, direction, amount: cents(amountReais), date, transactionId: null, note: null });
    },
  };
}

export type PeopleServer = ReturnType<typeof createPeopleServer>;

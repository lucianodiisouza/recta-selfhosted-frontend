import { useSyncExternalStore } from 'react';

// Whether the server has the people routes. There is no version or capability call to ask, so the answer comes from use:
// the first framework 404/405 on a people route marks them missing for the rest of the session, and the menu entry goes
// away. A page reload (or a new session) probes again.
let missing = false;
const listeners = new Set<() => void>();

export function markPeopleMissing(): void {
  if (missing) return;
  missing = true;
  listeners.forEach((listener) => listener());
}

export function isPeopleMissing(): boolean {
  return missing;
}

/** Test hook: forgets what was learned about the server. */
export function resetPeopleMissing(): void {
  missing = false;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** False once the server answered a people route with the framework's 404/405. */
export function usePeopleAvailable(): boolean {
  return !useSyncExternalStore(subscribe, isPeopleMissing, isPeopleMissing);
}

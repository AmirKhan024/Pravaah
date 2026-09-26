import { useRef, useSyncExternalStore } from 'react';

type Listener = () => void;

export interface Store<T> {
  getState: () => T;
  setState: (patch: Partial<T> | ((s: T) => Partial<T>)) => void;
  subscribe: (l: Listener) => () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    setState: (patch) => {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const shallowEqual = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a),
    kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
};

/** subscribe to a slice; re-renders only when the (shallow) slice changes */
export function useSlice<T, S>(store: Store<T>, selector: (s: T) => S): S {
  const cache = useRef<{ v: S } | null>(null);
  return useSyncExternalStore(
    store.subscribe,
    () => {
      const next = selector(store.getState());
      if (cache.current && shallowEqual(cache.current.v, next)) return cache.current.v;
      cache.current = { v: next };
      return next;
    },
    () => selector(store.getState()),
  );
}

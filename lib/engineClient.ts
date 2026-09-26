'use client';
import * as Comlink from 'comlink';
import type { EngineApi } from '@/worker/engine.worker';

let api: Comlink.Remote<EngineApi> | null = null;
let worker: Worker | null = null;

export function engine(): Comlink.Remote<EngineApi> {
  if (!api) {
    worker = new Worker(new URL('../worker/engine.worker.ts', import.meta.url), { type: 'module' });
    api = Comlink.wrap<EngineApi>(worker);
  }
  return api;
}

export function resetEngine() {
  worker?.terminate();
  worker = null;
  api = null;
}

export const proxy = Comlink.proxy;

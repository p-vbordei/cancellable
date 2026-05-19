/**
 * Wrap any promise so it rejects when the provided `AbortSignal` aborts.
 *
 * Note: the underlying work isn't actually canceled — only your view of it.
 * For real cancellation, the underlying API must support `AbortSignal` itself
 * (e.g. `fetch(url, { signal })`).
 */
export function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error("aborted"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new Error("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

export class TimeoutError extends Error {
  override readonly name = "TimeoutError";
  constructor(public readonly timeoutMs: number, message?: string) {
    super(message ?? `timed out after ${timeoutMs}ms`);
  }
}

/**
 * Reject with `TimeoutError` if `promise` does not settle within `ms`. Optionally
 * also abortable via an `AbortSignal`.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new Error("aborted"));
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new TimeoutError(ms));
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(signal!.reason ?? new Error("aborted"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => { cleanup(); resolve(value); },
      (err) => { cleanup(); reject(err); },
    );
  });
}

/**
 * `setTimeout` that respects an `AbortSignal`. Resolves after `ms`, or rejects
 * immediately if the signal aborts.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new Error("aborted"));
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason ?? new Error("aborted"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  /** True once resolved or rejected. */
  settled: boolean;
}

/**
 * Create a deferred — a promise plus its resolve/reject functions, useful for
 * bridging callback APIs.
 */
export function deferred<T>(): Deferred<T> {
  const d: Partial<Deferred<T>> = { settled: false };
  d.promise = new Promise<T>((resolve, reject) => {
    d.resolve = (value: T) => {
      if (d.settled) return;
      d.settled = true;
      resolve(value);
    };
    d.reject = (reason?: unknown) => {
      if (d.settled) return;
      d.settled = true;
      reject(reason);
    };
  });
  return d as Deferred<T>;
}

/**
 * Combine multiple `AbortSignal`s into one that fires when *any* of them aborts.
 * Returns `{ signal, dispose }`. Call `dispose()` to detach the listeners.
 */
export function anySignal(signals: readonly AbortSignal[]): { signal: AbortSignal; dispose: () => void } {
  const ac = new AbortController();
  const handlers: Array<{ s: AbortSignal; h: () => void }> = [];
  const dispose = () => {
    for (const { s, h } of handlers) s.removeEventListener("abort", h);
  };
  for (const s of signals) {
    if (s.aborted) {
      ac.abort(s.reason);
      dispose();
      return { signal: ac.signal, dispose: () => {} };
    }
    const h = () => {
      ac.abort(s.reason);
      dispose();
    };
    s.addEventListener("abort", h, { once: true });
    handlers.push({ s, h });
  }
  return { signal: ac.signal, dispose };
}

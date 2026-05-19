# cancellable

[![ci](https://github.com/p-vbordei/cancellable/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/cancellable/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/%40p-vbordei%2Fcancellable.svg)](https://www.npmjs.com/package/@p-vbordei/cancellable)
[![downloads](https://img.shields.io/npm/dm/%40p-vbordei%2Fcancellable.svg)](https://www.npmjs.com/package/@p-vbordei/cancellable)
[![bundle](https://img.shields.io/bundlejs/size/%40p-vbordei%2Fcancellable)](https://bundlejs.com/?q=%40p-vbordei%2Fcancellable)

> Promise utilities for `AbortSignal`. Wrap any promise so it rejects on abort, add timeouts, sleep abortably, build deferreds, combine multiple signals into one. Zero dependencies.

```ts
import { cancellable, withTimeout, sleep, deferred, anySignal, TimeoutError } from "@p-vbordei/cancellable";

await cancellable(longRunning(), abortSignal);

await withTimeout(fetch(url), 5000);   // throws TimeoutError after 5s

await sleep(1000, abortSignal);

const d = deferred<number>();
eventBus.once("done", (n) => d.resolve(n));
const result = await d.promise;

const { signal, dispose } = anySignal([userSignal, AbortSignal.timeout(10_000)]);
await doWork(signal);
dispose();
```

## Install

```sh
npm install @p-vbordei/cancellable
```

Works with Node 20+, browsers, Bun, Deno. ESM + CJS.

## Why

`AbortSignal` is the standard cancellation primitive in modern JS, but most of your code interacts with promises that don't accept one. `cancellable` bridges the gap:

- **Wrap any promise** so it rejects when a signal aborts
- **Add deadlines** with `withTimeout`
- **Abortable sleep** without leaking zombie timers
- **Combine multiple signals** so the first one to abort wins
- **Deferreds** for callback-to-promise bridging

These are the four or five missing pieces every async codebase ends up reinventing.

## Recipes

### Add a timeout to any promise

```ts
import { withTimeout } from "@p-vbordei/cancellable";

const result = await withTimeout(slowOperation(), 5000);
```

### Race a user-cancel signal against a fetch deadline

```ts
import { anySignal } from "@p-vbordei/cancellable";

function fetchWithUserCancel(url: string, userCancel: AbortSignal) {
  const { signal, dispose } = anySignal([userCancel, AbortSignal.timeout(10_000)]);
  return fetch(url, { signal }).finally(dispose);
}
```

### Abortable polling

```ts
import { sleep } from "@p-vbordei/cancellable";

async function pollUntil(predicate: () => Promise<boolean>, signal: AbortSignal) {
  while (!signal.aborted) {
    if (await predicate()) return;
    await sleep(1000, signal);
  }
}
```

### Bridge callback API to promise

```ts
import { deferred } from "@p-vbordei/cancellable";

function once<T>(emitter: EventEmitter, event: string): Promise<T> {
  const d = deferred<T>();
  emitter.once(event, (data) => d.resolve(data));
  emitter.once("error", (err) => d.reject(err));
  return d.promise;
}

const message = await once<Message>(ws, "message");
```

### Cancel a non-AbortSignal-aware library

```ts
import { cancellable } from "@p-vbordei/cancellable";

// This third-party library doesn't accept AbortSignal:
const ac = new AbortController();
button.addEventListener("click", () => ac.abort());

try {
  const result = await cancellable(legacyLib.doWork(), ac.signal);
} catch (err) {
  if (ac.signal.aborted) console.log("user cancelled");
  else throw err;
}
// NOTE: legacyLib.doWork() still runs to completion in the background.
// cancellable only stops YOU from waiting for it.
```

## API

### `cancellable(promise, signal): Promise`

Wrap a promise so it rejects with `signal.reason` if `signal` aborts before the promise settles. The underlying work isn't truly canceled — only your *view* of it. For true cancellation, the underlying API must accept `AbortSignal` itself.

### `withTimeout(promise, ms, signal?): Promise`

Reject with `TimeoutError` after `ms`. If a `signal` is also provided, abort fires first.

### `sleep(ms, signal?): Promise<void>`

Like `setTimeout` but as a promise. Aborts cleanly on signal — no zombie timers.

### `deferred<T>(): Deferred<T>`

```ts
type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  settled: boolean;
};
```

Subsequent calls to `resolve` / `reject` after the first one are no-ops. Useful for callback-to-promise bridges.

### `anySignal(signals[]): { signal, dispose }`

Returns an `AbortSignal` that fires when *any* of the inputs aborts. Call `dispose()` when you no longer need it, to detach listeners from the source signals.

### `class TimeoutError`

Thrown by `withTimeout`. Has a `timeoutMs` property.

## Caveats

- **`cancellable` doesn't truly cancel work** — only your view of it. The underlying promise continues executing. For actual cancellation, the underlying operation must accept `AbortSignal` (e.g., `fetch`, `node:fs.promises`, modern DB drivers).
- **`anySignal`** allocates listeners on every input signal — call `dispose()` to avoid leaks in long-lived contexts.

## License

Apache-2.0 © Vlad Bordei

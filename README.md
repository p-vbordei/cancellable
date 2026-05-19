# cancellable

[![ci](https://github.com/p-vbordei/cancellable/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/cancellable/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/%40p-vbordei%2Fcancellable.svg)](https://www.npmjs.com/package/@p-vbordei/cancellable)
[![downloads](https://img.shields.io/npm/dm/%40p-vbordei%2Fcancellable.svg)](https://www.npmjs.com/package/@p-vbordei/cancellable)
[![bundle](https://img.shields.io/bundlejs/size/%40p-vbordei%2Fcancellable)](https://bundlejs.com/?q=%40p-vbordei%2Fcancellable)

Promise utilities for `AbortSignal`. Wrap any promise so it rejects on abort, add timeouts, sleep abortably, build deferreds, combine multiple signals into one. Zero dependencies.

```ts
import { cancellable, withTimeout, sleep, deferred, anySignal, TimeoutError } from "@p-vbordei/cancellable";

// Make any promise abortable
await cancellable(longRunning(), abortSignal);

// Add a deadline
await withTimeout(fetch(url), 5000);   // throws TimeoutError after 5s

// AbortSignal-aware sleep
await sleep(1000, abortSignal);

// Externally-resolvable promise
const d = deferred<number>();
eventBus.once("done", (n) => d.resolve(n));
const result = await d.promise;

// Combine signals
const { signal, dispose } = anySignal([userSignal, AbortSignal.timeout(10_000)]);
await doWork(signal);
dispose();
```

## Install

```sh
npm install @p-vbordei/cancellable
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

## License

Apache-2.0 © Vlad Bordei

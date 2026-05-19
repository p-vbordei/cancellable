import { describe, it, expect } from "vitest";
import { cancellable, withTimeout, sleep, deferred, anySignal, TimeoutError } from "../src/index.js";

const delay = (ms: number, value?: unknown) => new Promise((r) => setTimeout(() => r(value), ms));

describe("cancellable", () => {
  it("resolves when promise resolves first", async () => {
    const ac = new AbortController();
    expect(await cancellable(delay(10, "ok"), ac.signal)).toBe("ok");
  });

  it("rejects when signal aborts first", async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(new Error("nope")), 5);
    await expect(cancellable(delay(50, "ok"), ac.signal)).rejects.toThrow("nope");
  });

  it("rejects immediately if already aborted", async () => {
    const ac = new AbortController();
    ac.abort(new Error("pre"));
    await expect(cancellable(delay(50, "ok"), ac.signal)).rejects.toThrow("pre");
  });

  it("propagates promise rejection", async () => {
    const ac = new AbortController();
    await expect(cancellable(Promise.reject(new Error("inner")), ac.signal)).rejects.toThrow("inner");
  });
});

describe("withTimeout", () => {
  it("resolves when fast enough", async () => {
    expect(await withTimeout(delay(5, 42), 100)).toBe(42);
  });

  it("rejects with TimeoutError on timeout", async () => {
    await expect(withTimeout(delay(50), 10)).rejects.toBeInstanceOf(TimeoutError);
  });

  it("rejects with abort reason if signal fires first", async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(new Error("aborted")), 5);
    await expect(withTimeout(delay(100), 50, ac.signal)).rejects.toThrow("aborted");
  });

  it("propagates underlying rejection", async () => {
    await expect(withTimeout(Promise.reject(new Error("x")), 100)).rejects.toThrow("x");
  });
});

describe("sleep", () => {
  it("resolves after duration", async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it("aborts via signal", async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(new Error("stop")), 5);
    await expect(sleep(100, ac.signal)).rejects.toThrow("stop");
  });

  it("rejects immediately if already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(sleep(100, ac.signal)).rejects.toThrow();
  });
});

describe("deferred", () => {
  it("resolves externally", async () => {
    const d = deferred<number>();
    d.resolve(42);
    expect(await d.promise).toBe(42);
    expect(d.settled).toBe(true);
  });

  it("rejects externally", async () => {
    const d = deferred<number>();
    d.reject(new Error("nope"));
    await expect(d.promise).rejects.toThrow("nope");
  });

  it("subsequent calls are no-ops", async () => {
    const d = deferred<number>();
    d.resolve(1);
    d.resolve(2);
    d.reject(new Error("late"));
    expect(await d.promise).toBe(1);
  });
});

describe("anySignal", () => {
  it("fires when any input aborts", async () => {
    const a = new AbortController();
    const b = new AbortController();
    const { signal } = anySignal([a.signal, b.signal]);
    expect(signal.aborted).toBe(false);
    b.abort(new Error("b done"));
    expect(signal.aborted).toBe(true);
    expect(signal.reason instanceof Error && signal.reason.message).toBe("b done");
  });

  it("returns already-aborted signal when one input is aborted", () => {
    const a = new AbortController();
    a.abort(new Error("pre"));
    const b = new AbortController();
    const { signal } = anySignal([a.signal, b.signal]);
    expect(signal.aborted).toBe(true);
  });

  it("dispose removes listeners", async () => {
    const a = new AbortController();
    const b = new AbortController();
    const { signal, dispose } = anySignal([a.signal, b.signal]);
    dispose();
    a.abort();
    expect(signal.aborted).toBe(false);
  });
});

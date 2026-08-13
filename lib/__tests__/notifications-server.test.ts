import { describe, it, expect } from "vitest";
import { applyRead } from "../notifications-shared";
import type { NotificationItem } from "../types";

function item(id: string, read = false): NotificationItem {
  return {
    id,
    type: "cheer",
    title: "You were cheered! 🌿",
    message: "Keep going!",
    read,
    createdAt: "2026-08-13T00:00:00.000Z"
  };
}

describe("applyRead", () => {
  it("marks every unread item read when opts.all", () => {
    const list = [item("a"), item("b", true), item("c")];
    const { next, changed } = applyRead(list, { all: true });

    expect(next.every((n) => n.read)).toBe(true);
    expect(changed).toBe(2);
  });

  it("marks only the matching id when opts.id", () => {
    const list = [item("a"), item("b"), item("c")];
    const { next, changed } = applyRead(list, { id: "b" });

    expect(next.find((n) => n.id === "b")?.read).toBe(true);
    expect(next.find((n) => n.id === "a")?.read).toBe(false);
    expect(next.find((n) => n.id === "c")?.read).toBe(false);
    expect(changed).toBe(1);
  });

  it("returns changed 0 and leaves items untouched when the id is not found", () => {
    const list = [item("a")];
    const { next, changed } = applyRead(list, { id: "zzz" });

    expect(changed).toBe(0);
    expect(next.map((n) => n.read)).toEqual([false]);
  });

  it("handles an empty array", () => {
    expect(applyRead([], { all: true })).toEqual({ next: [], changed: 0 });
    expect(applyRead([], { id: "x" })).toEqual({ next: [], changed: 0 });
  });

  it("is idempotent on already-read items", () => {
    const list = [item("a", true), item("b", true)];
    const all = applyRead(list, { all: true });
    expect(all.changed).toBe(0);
    expect(all.next.every((n) => n.read)).toBe(true);

    const one = applyRead(list, { id: "a" });
    expect(one.changed).toBe(0);
    expect(one.next[0].read).toBe(true);
  });

  it("preserves array length", () => {
    const list = [item("a"), item("b"), item("c"), item("d")];
    expect(applyRead(list, { all: true }).next.length).toBe(list.length);
    expect(applyRead(list, { id: "b" }).next.length).toBe(list.length);
  });

  it("does not mutate the input array or its items", () => {
    const list = [item("a"), item("b")];
    const snapshot = list.map((n) => ({ ...n }));

    applyRead(list, { all: true });

    expect(list).toEqual(snapshot);
    expect(list[0].read).toBe(false);
    expect(list[1].read).toBe(false);
  });

  it("does nothing when neither all nor id is set", () => {
    const list = [item("a"), item("b")];
    const { next, changed } = applyRead(list, {});
    expect(changed).toBe(0);
    expect(next).toBe(list);
  });
});